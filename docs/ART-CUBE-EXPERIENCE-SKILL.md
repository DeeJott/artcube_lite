# ART.CUBE — Experience Creation Skill

> **The definitive Creative Engineering Bible for designing and building interactive Art Cube experiences.**
>
> This document is the single source of truth for AI coding agents creating new experiences.
> Every experience must be visually stunning, technically excellent, immersive, original, performant, maintainable, and emotionally unforgettable.
>
> **No generic demos. No boilerplate. No mediocrity.**

---

## 1. Project Identity & Philosophy

ART.CUBE is a traveling immersive art installation that transforms human movement into unique digital art NFTs. Two participants (host and guest) interact with a shared real-time generative visual experience, and leave with a one-of-a-kind video NFT of their collaborative creation.

### Core Values

- **Immersive**: The screen is a window into a living world.
- **Original**: Every experience needs a unique visual identity, interaction model, and emotional arc.
- **Performant**: 60fps desktop, 30fps mobile. GPU-first. No stutter.
- **Emotional**: Evoke wonder, awe, playfulness, or contemplation.
- **Collaborative**: Two people interact simultaneously via PeerJS sync.
- **Recordable**: Final 10 seconds recorded as 1080x1080 square video NFT.
- **Maintainable**: Clean, modular, self-contained.

### Quality Bar

Museum installation. Conference demo that drops jaws. Award-winning portfolio piece.

---

## 2. Architecture & File Structure

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| 3D Engine | Three.js 0.184+ (WebGL & WebGPU) |
| GPU Compute | GPUComputationRenderer, TSL, WebGPU compute |
| Fluid Sim | three-fluid-fx |
| P2P | PeerJS |
| Audio | Web Audio API (AnalyserNode, FFT) |
| Recording | MediaRecorder → Cloudinary |

### Directory Structure

```
app/
├── page.tsx                      # Experience-agnostic shell
├── components/                   # Shell UI (StartScreen, ExperienceBar, Timer, etc.)
├── hooks/                        # useAudioEngine, usePeerJS, useMediaRecorder
├── lib/
│   ├── experience-types.ts       # Core interfaces
│   ├── constants.ts              # Canvas dims, audio config
│   ├── types.ts                  # Peer message types
│   └── three/                    # Shared: postProcessing, cinematicCamera, flareShader
└── experiences/                  # ALL EXPERIENCES LIVE HERE
    ├── index.ts                  # Registry (EXPERIENCES array)
    ├── aurora/                   # Each is a self-contained folder
    ├── mycelium/
    ├── crystal/
    ├── tidal/
    ├── spectralmix/
    ├── fluid/
    ├── flow/                     # + mlsMpmSimulator.ts, structuredArray.ts
    ├── particles2d/              # + flowParticles.ts
    └── berlinparticles/          # + berlinSkyline.ts
```

### Adding a New Experience

1. Create `app/experiences/<name>/` directory
2. Create `index.ts` exporting an `ExperienceDefinition`
3. Create `<Name>Canvas.tsx` with a component satisfying `ExperienceComponentProps`
4. Add to `EXPERIENCES` array in `app/experiences/index.ts`

---

## 3. Experience Interface & Lifecycle

### Core Types (`app/lib/experience-types.ts`)

```typescript
interface ExperienceRendererAPI {
  start: () => void;
  handlePeerMessage?: (msg: PeerMessage) => void;
}

interface ExperienceComponentProps {
  isRunning: boolean;
  elapsed: number;
  elapsedRef: MutableRefObject<number>;
  intensity: number;      // 0-1 overall audio intensity
  bass: number;           // 0-1 bass band
  mid: number;            // 0-1 mid band
  treble: number;         // 0-1 treble band
  lastBeatTime: number;   // timestamp of last beat
  isMobile: boolean;
  isRecording: boolean;
  isHost: boolean;
  myName: string;
  sendInteraction: (kind: string, data: Record<string, unknown>) => void;
  onCanvasesReady: (flare: HTMLCanvasElement, star: HTMLCanvasElement) => void;
  onRendererReady: (api: ExperienceRendererAPI) => void;
}

interface ExperienceDefinition {
  id: string;
  title: string;
  description: string;
  duration: number;       // seconds
  Component: ComponentType<ExperienceComponentProps>;
  getHUDText?: (elapsed: number) => string | null;
}
```

### Lifecycle

1. User selects experience on StartScreen, clicks Start
2. Shell calls `startAudio()`, sets `shellStartTimeRef`, calls `experienceRendererRef.start()`
3. Shell RAF loop: updates audio values, tracks elapsed, records last 10s, uploads at end
4. Experience component mounts, initializes Three.js in `useEffect`, calls `onCanvasesReady` and `onRendererReady`
5. `start()` begins the `requestAnimationFrame` render loop
6. Each frame: update uniforms from audio refs → compute → render
7. Pointer events → visual effect + `sendInteraction()` → peer receives via `handlePeerMessage()`
8. Cleanup: `cancelAnimationFrame`, dispose all Three.js resources

### Critical Contract

Every experience MUST:
- Call `onCanvasesReady(canvas, canvas)` during init
- Call `onRendererReady(api)` with `start()` and optionally `handlePeerMessage()`
- `start()` must begin the animation loop
- Dispose ALL resources in the useEffect return
- Use `'use client'` directive

---

## 4. Technical Foundations

### Renderer Setup

```typescript
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
});
renderer.setSize(1920, 1080, false);
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
```

- `setSize(1920, 1080, false)` — `false` prevents style mutation; CSS handles display
- Fixed 1920x1080 internal resolution; CSS scales to display
- Recording crops center 1080x1080 — keep critical visuals centered

### Scene & Fog

```typescript
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(clearColor, fogDensity);
```

Fog adds atmospheric depth. Strongly recommended.

### Coordinate Normalization

```typescript
const rect = canvas.getBoundingClientRect();
const rx = (clientX - rect.left) / rect.width;   // 0-1
const ry = (clientY - rect.top) / rect.height;    // 0-1
const wx = (rx - 0.5) * ASPECT;  // world space
const wy = 0.5 - ry;
```

---

## 5. Shader & GPU Programming

### GLSL Conventions

- Embed as template strings with `/* glsl */` prefix
- Uniforms: `u` prefix (`uTime`, `uBass`, `uIntensity`)
- Varyings: `v` prefix (`vColor`, `vAlpha`, `vUv`)
- Use `smoothstep` for transitions, never raw `step` for visual effects
- Guard against division by zero, NaN

### Essential Shader Functions

**Hash/Noise:**
```glsl
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
```

**FBM:**
```glsl
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
```

**Curl Noise:**
```glsl
vec2 curl(vec2 p, float t) {
  float n = noise(p + t);
  return vec2(noise(p+vec2(0,3.7)+t)-n, n-noise(p+vec2(4.1,0)-t));
}
```

**Cosine Palette:**
```glsl
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}
```

### GPGPU with GPUComputationRenderer

For particle systems (Mycelium, SpectralMix):

```typescript
const gpuCompute = new GPUComputationRenderer(TEX_SIZE, TEX_SIZE, renderer);
const posVar = gpuCompute.addVariable('texturePosition', POS_SHADER, posTex0);
const velVar = gpuCompute.addVariable('textureVelocity', VEL_SHADER, velTex0);
gpuCompute.setVariableDependencies(posVar, [posVar, velVar]);
gpuCompute.setVariableDependencies(velVar, [velVar, posVar]);
velVar.material.uniforms.uTime = { value: 0 };
gpuCompute.init();

// In loop:
gpuCompute.compute();
const posTexture = gpuCompute.getCurrentRenderTarget(posVar).texture;
```

- TEX_SIZE² = particle count
- CPU readback via `renderer.readRenderTargetPixels()` for CPU-side computation
- Spawn queue pattern: write spawn data to DataTextures, GPU reads to respawn dead particles

### WebGPU / TSL (Advanced)

For complex physics (Flow's MLS-MPM fluid). Use when: complex physics, >50k particles with inter-particle forces, compute shaders, atomic operations.

Use WebGL/GLSL for: most experiences, post-processing, custom visual shaders, GPUComputationRenderer particle systems.

### Fluid Simulation (three-fluid-fx)

```typescript
import { FluidSimulation, DensityTintOverlayPass } from 'three-fluid-fx';
const fluid = new FluidSimulation(renderer, {
  profile: 'balanced', splatRadius: 0.001, splatForce: 6,
  pressureIterations: 8, curlStrength: 0.2,
});
fluid.addSplat(x, y, vx, vy, { radius: 0.002 });
fluid.step(dt);
// fluid.velocityTexture for particle coupling
```

### Custom Fluid (GLSL Navier-Stokes)

Pipeline: advection → vorticity → divergence → pressure (Jacobi, 20-25 iterations) → gradient subtraction → dye advection. Uses double-buffered ping-pong render targets.

---

## 6. Post-Processing Pipeline

### Shared Factory

```typescript
import { createPostProcessing } from '../../lib/three/postProcessing';
const composer = createPostProcessing(renderer, scene, cam, {
  bloomStrength: 1.2, bloomRadius: 0.6, bloomThreshold: 0.08,
  filmIntensity: 0.12, vignette: true, chromaticAberration: false,
});
```

### Pipeline Order

1. RenderPass → 2. UnrealBloomPass → 3. ChromaticAberration (optional) → 4. FilmPass → 5. Vignette → 6. OutputPass

### Bloom Tuning

| Effect | Strength | Radius | Threshold |
|--------|----------|--------|-----------|
| Subtle | 0.6-0.9 | 0.4-0.5 | 0.15-0.2 |
| Standard | 1.0-1.2 | 0.5-0.6 | 0.08-0.1 |
| Intense | 1.4-1.8 | 0.6-0.8 | 0.04-0.06 |
| Dreamlike | 2.0+ | 0.8+ | 0.02-0.04 |

Audio-reactive bloom: `bloomPass.strength = 0.6 + intensity * 0.8 + beatPulse * 0.5;`

---

## 7. Camera Choreography

### Cinematic Camera

```typescript
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
const cam = createCinematicCamera(ASPECT); // 50° FOV, pos (0,0,1.2)
// In loop:
updateCinematicCamera(cam, time, mouseX, mouseY, driftScale);
```

- `driftScale`: 0 = static, 1 = default, 0.5 = subtle
- Gentle sinusoidal drift + mouse parallax
- Never nauseating — keep drift slow
- Mouse parallax in 0.04-0.08 range
- Always `cam.lookAt()` after position changes

---

## 8. Audio Reactivity

### Audio Values from Shell

- `intensity` (0-1): overall energy from bass+low-mid
- `bass` (0-1): low frequency band
- `mid` (0-1): mid frequency band
- `treble` (0-1): high frequency band
- `lastBeatTime`: timestamp of last detected beat

### Pattern: Refs for Audio Values

```typescript
const intensityRef = useRef(0);
const bassRef = useRef(0);
const beatPulseRef = useRef(0);

useEffect(() => { intensityRef.current = intensity; }, [intensity]);
useEffect(() => { bassRef.current = bass; }, [bass]);

useEffect(() => {
  if (lastBeatTime && lastBeatTime !== prevBeatRef.current) {
    prevBeatRef.current = lastBeatTime;
    beatPulseRef.current = 1.0;
  }
}, [lastBeatTime]);

// In loop:
beatPulseRef.current *= 0.90;
const pulse = 1.0 + beatPulseRef.current * 0.7 + bassRef.current * 0.3;
```

### Audio Mapping Guide

| Audio Value | Visual Response |
|------------|-----------------|
| `bass` | Particle speed, bloom strength, scale pulses |
| `mid` | Color saturation, flow turbulence, connection brightness |
| `treble` | Sparkle/shimmer, point size, chromatic aberration |
| `intensity` | Overall energy multiplier, ambient spawning rate |
| `beatPulse` | Impact effects — explosions, flashes, scale jumps |

**Rules:** Always decay beatPulse (0.88-0.92/frame). Subtle is better than obvious. Test with silence.

---

## 9. Interaction & Peer Synchronization

### Interaction Pattern

```typescript
const handlePointer = useCallback((clientX: number, clientY: number) => {
  if (!isStartedRef.current) return;
  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;
  const rx = (clientX - rect.left) / rect.width;
  const ry = (clientY - rect.top) / rect.height;
  spawnEffect(rx, ry);
  sendInteraction('EXPERIENCE_KIND', { rx, ry });
}, [sendInteraction]);

const api: ExperienceRendererAPI = {
  start: () => { isStartedRef.current = true; animate(); },
  handlePeerMessage: (msg) => {
    const m = msg as unknown as Record<string, unknown>;
    if (m.type === 'INTERACTION' && m.kind === 'EXPERIENCE_KIND') {
      spawnEffect(m.rx as number ?? 0.5, m.ry as number ?? 0.5);
    }
  },
};
```

### Best Practices

- Throttle peer sync (50ms minimum interval)
- Normalize coordinates (0-1) for peer sync
- Use unique `kind` strings per experience
- Handle both click/touch and drag/pointer-move
- Apply peer effects identically to local effects
- Add ambient spawning so the scene is never static

---

## 10. Experience Design Framework

### Design Checklist (Before Coding)

1. **Emotional Goal**: What feeling? (wonder, serenity, excitement, mystery)
2. **Visual Identity**: Color palette, shapes, textures, atmosphere
3. **Interaction Model**: Touch-spawn, drag-paint, click-ripple
4. **Animation Language**: Flowing, explosive, organic, geometric
5. **Color & Lighting**: Palette, bloom, fog, background
6. **Camera**: Static, drifting, orbital
7. **Pacing**: Scene labels, escalation over duration
8. **Sound Response**: Which bands affect which parameters
9. **Technical Approach**: WebGL vs WebGPU, particle count
10. **Optimization**: Mobile fallbacks, particle limits

### Scene Labels & Pacing

```typescript
const SCENE_LABELS: [number, string][] = [
  [0,   'OPENING'],
  [60,  'INTERACT'],
  [130, 'ESCALATION'],
  [200, 'CLIMAX'],
  [260, 'RESOLUTION'],
];
```

### Duration

- Standard: 300s (5 min). Short: 180s (3 min).
- Last 10 seconds always recorded for NFT.
- Keep critical visuals centered for 1080x1080 square crop.

---

## 11. Creative Direction

### Color Philosophy

- **Dark backgrounds** — deep blacks, midnight blues, forest greens
- **Vibrant accents** — neon, bioluminescent, spectral colors
- **Limited palettes** — 3-6 core colors are more striking than rainbow chaos
- **Audio-reactive color shifts** — shift hue with bass, saturation with intensity
- **Additive blending** for glow — particles should feel like light

### Visual Atmosphere

- **Fog** for depth and mystery
- **Bloom** for luminosity and dreaminess
- **Film grain** for analog texture
- **Vignette** for focus and intimacy
- **Chromatic aberration** for surreal quality (use sparingly)

### Movement Philosophy

- **Organic** over mechanical — natural curves, easing, noise-driven
- **Layered** motion — macro drift + micro jitter
- **Responsive** — everything reacts to audio and touch
- **Never static** — the scene always breathes
- **Smooth transitions** — `smoothstep`, `mix`, exponential decay

### Particle Design

- **Glow textures**: radial gradient sprites for soft luminous points
- **Size variation**: multiple render passes (glow + core)
- **Color from data**: each particle carries its own color
- **Life cycles**: fade in/out, age-based brightness, death and respawn
- **Connection lines**: proximity-based lines between particles

### Glow Texture Generator

```typescript
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
```

---

## 12. Inspiration Library

### Categories

**Nature & Organic:** Aurora borealis, bioluminescent ocean, fungal networks, coral growth, sand dunes, cloud formations, lava flows, ice crystallization, root systems, vine growth

**Cosmic & Celestial:** Nebulae, black holes, gravitational lensing, solar flares, star nurseries, supernovae, gravitational waves, accretion disks

**Fluid & Liquid:** Ink in water, oil slicks, mercury pools, liquid metals, rain on glass, ocean waves, whirlpools, tidal patterns, viscous fluids, superfluids

**Geometric & Architectural:** Crystal lattices, fractal geometry, Voronoi patterns, Islamic geometric patterns, Brutalist structures, origami folding, kaleidoscopic reflections

**Urban & Cultural:** City skylines from particles, neon signs, traffic flows, subway maps as light trails, calligraphy, street art, architectural projections

**Abstract & Emotional:** Memory fragments, thought patterns, emotional spectra, sound as geometry, music as architecture, dreams, meditation states

**Scientific:** DNA helix, molecular bonds, quantum field fluctuations, neural networks, data flows, chaos theory, strange attractors, phase transitions

### Reference Standards

- **Three.js official examples** — gold standard for technique
- **Shadertoy** — shader inspiration
- **Awwwards / FWA** — interaction and motion design
- **Refik Anadol** — data-driven generative art
- **teamLab** — immersive installation art

---

## 13. Quality & Performance Standards

### Performance Targets

| Platform | FPS | Resolution | Particles |
|----------|-----|-----------|-----------|
| Desktop | 60 | 1920x1080 | Up to 16k (128²) |
| Mobile | 30 | 1920x1080 (scaled) | 40% of desktop |

### Optimization Techniques

1. **GPU-first**: All particle simulation on GPU
2. **Instanced rendering**: `InstancedMesh` or `Points` with data textures
3. **Ping-pong render targets**: Double-buffered FBOs for simulation
4. **Depth write**: `depthWrite: false` for transparent/additive particles
5. **Blending**: `AdditiveBlending` for glow, `NormalBlending` for solid
6. **Mobile detection**: Reduce particle counts, texture sizes
7. **Delta time clamping**: `const dt = Math.min(now - lastTime, 32);`
8. **Resource disposal**: Always dispose geometries, materials, textures, render targets
9. **Readback minimization**: `readRenderTargetPixels` is expensive — only when needed

### Quality Checklist

- [ ] Visually stunning at first frame
- [ ] Responds to touch within 1 frame
- [ ] Audio reactivity is subtle and enhances
- [ ] Looks good in silence (ambient activity)
- [ ] Looks good in 1080x1080 square crop
- [ ] No visible stuttering on desktop
- [ ] All resources disposed on unmount
- [ ] Peer sync works
- [ ] HUD text guides user through phases
- [ ] Unique visual identity

---

## 14. Experience Generation Rules

### Originality Rules

1. **Never clone** an existing experience. Distinct visual identity required.
2. **Borrow patterns, not appearances**. Reuse techniques — make the result look different.
3. **Combine techniques in new ways**. Fluid + particles + raycasting + audio = new experience.
4. **Start from the emotion**, not the technique.

### Generation Process

1. Choose an inspiration category
2. Define the emotional goal in one sentence
3. Design the visual identity: color palette, shapes, atmosphere
4. Choose the interaction model
5. Select technical approach: WebGL/GLSL or WebGPU/TSL, GPGPU or custom shaders
6. Write the `index.ts` with metadata and scene labels
7. Build the canvas component following the skeleton
8. Add audio reactivity via refs
9. Add interaction + peer sync
10. Add ambient activity
11. Tune post-processing
12. Test, optimize, polish

---

## 15. Code Conventions & Patterns

### Component Skeleton

```typescript
'use client';
import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { createPostProcessing } from '../../lib/three/postProcessing';
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

const ASPECT = 1920 / 1080;

export function MyCanvas({ isRunning, intensity, bass, mid, treble, lastBeatTime, sendInteraction, onCanvasesReady, onRendererReady }: ExperienceComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(0);
  const bassRef = useRef(0);
  const isStartedRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { bassRef.current = bass; }, [bass]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(1920, 1080, false);
    renderer.setClearColor(0x000000, 1);

    const cam = createCinematicCamera(ASPECT);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.3);

    const composer = createPostProcessing(renderer, scene, cam, {
      bloomStrength: 1.2, bloomRadius: 0.6, bloomThreshold: 0.08,
    });

    // ... build scene, shaders, particles ...

    onCanvasesReady(canvas, canvas);

    let rafId = 0;
    let lastTime = performance.now();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(now - lastTime, 32);
      lastTime = now;

      // Update uniforms from audio refs
      // Compute (GPGPU, fluid step, etc.)
      // Update camera
      updateCinematicCamera(cam, now / 1000, mouseRef.current.x, mouseRef.current.y);
      composer.render();
    };

    const api: ExperienceRendererAPI = {
      start: () => { isStartedRef.current = true; animate(); },
      handlePeerMessage: (msg) => { /* handle peer interactions */ },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      composer.dispose();
      // dispose all geometries, materials, textures
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambient activity
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => { /* ambient spawn */ }, 3000);
    return () => clearInterval(id);
  }, [isRunning]);

  return (
    <div className="absolute inset-0" onClick={(e) => { /* handle pointer */ }}>
      <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ aspectRatio: '16/9' }} />
    </div>
  );
}
```

### index.ts Pattern

```typescript
import { MyCanvas } from './MyCanvas';
import type { ExperienceDefinition } from '../../lib/experience-types';

const DURATION = 300;
const SCENE_LABELS: [number, string][] = [
  [0, 'OPENING'], [60, 'INTERACT'], [130, 'ESCALATION'], [200, 'CLIMAX'], [260, 'RESOLUTION'],
];

export const myExperience: ExperienceDefinition = {
  id: 'myexp',
  title: 'MY EXP',
  description: 'One sentence description',
  duration: DURATION,
  Component: MyCanvas,
  getHUDText: (elapsed) => {
    let label = SCENE_LABELS[0][1];
    for (const [t, text] of SCENE_LABELS) { if (elapsed >= t) label = text; }
    return label;
  },
};
```

### Conventions

- `'use client'` at top of every canvas component
- `eslint-disable-next-line react-hooks/exhaustive-deps` on the main useEffect (intentional single-run)
- All Three.js setup inside one `useEffect(() => { ... }, [])`
- Audio values via refs, not state (avoid re-renders)
- `isStartedRef` gates interaction
- Canvas: `className="w-full h-full object-contain"` with `style={{ aspectRatio: '16/9' }}`
- Wrapper div: `className="absolute inset-0"`
- Unique interaction `kind` strings (e.g., `MY_EXP_TOUCH`)
- Dispose everything: renderer, composer, geometries, materials, textures, GPU compute

---

## 16. Existing Experience Analysis

### Aurora
- **Tech**: WebGL, custom GLSL ribbon shaders, additive blending, post-processing (bloom + chromatic aberration)
- **Visual**: Flowing aurora ribbons with starfield, cinematic camera
- **Interaction**: Pointer triggers ribbon spawning, peer sync
- **Audio**: Reactive intensity, bass, treble on ribbon brightness/size
- **Strengths**: Elegant ribbon shader, beautiful color palette
- **Pattern**: Multiple ribbon meshes with custom shader, starfield background

### Mycelium
- **Tech**: WebGL, GPUComputationRenderer (1024 particles), CPU readback for connection lines
- **Visual**: Bioluminescent fungal network growing from touch, connection lines between nearby nodes
- **Interaction**: Touch spawns particle clusters, peer sync, ambient spawning
- **Audio**: Beat pulse, bass, mid, treble on brightness and connections
- **Strengths**: GPU spawn queue pattern, CPU-GPU hybrid (GPU sim + CPU connection lines)
- **Pattern**: Spawn queue → DataTexture → GPU respawn dead particles; readback for proximity lines

### Crystal
- **Tech**: WebGL, custom polygon geometry, glow sprites, beam connections
- **Visual**: Growing crystalline structures with prismatic light beams between crystals
- **Interaction**: Touch spawns crystals, peer sync
- **Audio**: Reactive growth, brightness
- **Strengths**: Unique crystal geometry, beam connections
- **Pattern**: Object pool of crystals with life cycles, beams between nearby pairs

### Tidal
- **Tech**: WebGL, single ShaderMaterial on PlaneGeometry, uniform array for ripples
- **Visual**: Water surface with wave interference, ripples from touch
- **Interaction**: Click/touch spawns ripples, peer sync, ambient ripples
- **Audio**: Amplitude reacts to intensity and bass
- **Strengths**: Pure shader approach (no GPGPU), beautiful wave interference math
- **Pattern**: Uniform array of ripple parameters, fragment shader computes interference

### SpectralMix
- **Tech**: WebGL, GPUComputationRenderer (16k particles), stroke-based force fields
- **Visual**: Dense particle field with curl noise, stroke-driven motion fields, gravity slider
- **Interaction**: Drag to paint force strokes, peer sync, gravity UI control
- **Audio**: Bass/mid/treble on curl noise, damping, color
- **Strengths**: Stroke uniform arrays in shader, gravity slider UI, rich curl noise
- **Pattern**: Stroke array in GLSL uniforms, blending multiple motion fields

### Fluid
- **Tech**: WebGL, custom Navier-Stokes solver (advection, vorticity, pressure, dye)
- **Visual**: Real-time fluid with dye injection, bloom, vignette
- **Interaction**: Pointer splats inject velocity + color, peer sync
- **Audio**: Bass-driven splats, intensity-driven ambient flow
- **Strengths**: Full custom fluid solver in GLSL, most technically complex WebGL experience
- **Pattern**: Multiple render targets (velocity, pressure, divergence, vorticity, dye), ping-pong

### Flow
- **Tech**: WebGPU, TSL, MLS-MPM fluid simulator, instanced glossy shards, procedural HDR environment
- **Visual**: Liquid metal particles with glossy reflections, dynamic lighting
- **Interaction**: Raycasting mouse interaction, audio-driven forces, peer sync
- **Audio**: Bass/mid/treble on simulation forces
- **Strengths**: Most advanced experience — WebGPU compute, MLS-MPM physics, TSL node materials
- **Pattern**: StructuredArray for GPU buffers, compute kernels, instanced rendering with TSL

### Particles2D
- **Tech**: WebGL, three-fluid-fx fluid simulation, custom GPGPU particle system (flowParticles.ts)
- **Visual**: Fluid-driven particle cloud with spring-damper physics, palette switching
- **Interaction**: Pointer velocity splats (push/swirl/pull modes), palette selector UI, peer sync
- **Audio**: Beat splats, treble shimmer, ambient flow, bloom reactivity
- **Strengths**: Fluid-particle coupling, interaction mode UI, palette system, billboard particle rendering
- **Pattern**: Fluid velocity texture → particle velocity pass → position pass → instanced billboard render

### BerlinParticles
- **Tech**: WebGL, three-fluid-fx, particle destinations forming Berlin skyline silhouette
- **Visual**: Particles form Berlin landmarks, fluid-driven dispersion, audio-reactive beat splats
- **Interaction**: Pointer splats, peer sync, audio-driven landmark splats
- **Audio**: Beat triggers splats at landmark positions
- **Strengths**: Data-driven particle destinations (berlinSkyline.ts), landmark-specific audio response
- **Pattern**: Custom destination arrays for particle formation, fluid coupling

---

## 17. Continuous Improvement

### Study Existing Experiences

Before building a new experience, study the existing ones. Each demonstrates different techniques:
- **Aurora**: Custom ribbon shaders, starfield
- **Mycelium**: GPGPU spawn queue, CPU readback for connections
- **Crystal**: Object pools, beam connections
- **Tidal**: Pure shader approach, uniform arrays
- **SpectralMix**: Stroke force fields, curl noise, UI controls
- **Fluid**: Custom Navier-Stokes solver, ping-pong render targets
- **Flow**: WebGPU/TSL, MLS-MPM, StructuredArray
- **Particles2D**: Fluid-particle coupling, billboard rendering, palette system
- **BerlinParticles**: Data-driven destinations, landmark formation

### Reuse Patterns

- **Spawn queue**: Mycelium's DataTexture spawn pattern for GPGPU particle respawn
- **Stroke arrays**: SpectralMix's uniform array approach for interaction force fields
- **Fluid coupling**: Particles2D/BerlinParticles pattern for fluid → particle velocity
- **Connection lines**: Mycelium's CPU readback + LineSegments for proximity connections
- **Glow textures**: Radial gradient CanvasTexture for particle sprites
- **Post-processing**: Shared `createPostProcessing` factory
- **Camera**: Shared `createCinematicCamera` / `updateCinematicCamera`

### Refactoring Opportunities

- Extract common patterns into `app/lib/three/` utilities (e.g., glow texture, spawn queue)
- Consider a shared particle system utility for GPGPU-based experiences
- Unify interaction throttling into a shared hook
- Standardize mobile detection and quality scaling

### Incorporating New Capabilities

- **WebGPU adoption**: More experiences can use WebGPU/TSL for advanced compute
- **New Three.js features**: Track Three.js releases for new post-processing, materials, geometry
- **New shader techniques**: Study Shadertoy and Three.js examples for new visual effects
- **Audio improvements**: Consider Web Audio API advanced features (spatial audio, convolution)
- **Interaction models**: Explore multi-touch, gesture recognition, device orientation

---

*This document is a living reference. Update it as new experiences are built, new patterns emerge, and new techniques are discovered. The goal is always: visually stunning, technically excellent, immersive, original, performant, maintainable, and emotionally unforgettable.*
