# Alcohol Ink Effect: Three.js & Custom Shader Reference

This reference documents how to recreate the visual style of **Alcohol Ink / Fluid Art** using Three.js with custom GLSL `ShaderMaterial`. The technique produces organic, marble-like, agate-banded structures with translucent layering – suitable for premium interactive art installations.

---

## 1. Visual Target & Style Analysis

### What Defines the Alcohol Ink Look

Three visual phenomena must be present simultaneously for the effect to read as authentic:

| Phenomenon | Visual Result | Physical Cause |
| :--- | :--- | :--- |
| **Concentric Banding** | Dark lines forming agate-like ring patterns | Pigment concentrates at evaporation fronts |
| **Dual Edge Quality** | Sharp pigment-lines *beside* soft diffused gradients | Marangoni effect (surface tension gradients from alcohol) |
| **Translucent Layering** | Deeper color layers visible through semi-transparent upper layers | Multiple drying phases with varying pigment density |

### Why Standard Fluid Simulation Fails

A Navier-Stokes fluid solver (advection + pressure + vorticity) produces smooth smoke or water. It **cannot** generate:
- The **sharp concentric edge-lines** (no evaporation model)
- The **mineral banding** (no pigment concentration at boundaries)
- The **layered translucency** (single density field, no multi-phase drying)

**Do not use fluid simulation to achieve this look.** Use **Domain-Warped FBM** instead.

### Visual Quality Checklist

Before shipping an alcohol ink effect, verify these visual markers are present:
- [ ] Smooth, flowing marble-like pattern (not noisy static)
- [ ] At least 3 distinct color bands visible in the gradient
- [ ] Dark concentrated edge-lines between color zones
- [ ] Soft, feathered edges where ink meets the black background
- [ ] No visible grid artifacts or repeating tile boundaries
- [ ] Slow, organic breathing animation (not mechanical rotation)

---

## 2. Core Algorithm – Domain-Warped FBM

The entire effect rests on a single concept: **feeding noise into itself** to create naturally mineral/marble structures. This technique was formalized by Inigo Quilez as "domain warping."

### Escalation Levels

#### Level 1 – Plain FBM (Base Texture)
Stack multiple octaves of Simplex noise with increasing frequency and decreasing amplitude. Produces cloud-like soft textures.
```
result = fbm(p)
```
*Visual: Soft clouds. Not enough structure.*

#### Level 2 – Single Warp (First Marble Patterns)
Use one FBM call to distort the input coordinates of another FBM call. The output begins to show flowing, stretched patterns.
```
q = vec2(fbm(p + offset_a), fbm(p + offset_b))
result = fbm(p + warpStrength * q)
```
*Visual: Stretched marble veins. Getting closer.*

#### Level 3 – Double Warp (Full Agate Banding)
Feed the warped result back into another layer of warping. This produces the characteristic concentric banding of agate slices and alcohol ink.
```
q = vec2(fbm(p + offset_a), fbm(p + offset_b))
r = vec2(fbm(p + warpStrength * q + offset_c), fbm(p + warpStrength * q + offset_d))
result = fbm(p + warpStrength * r)
```
*Visual: Full agate/alcohol-ink structure with concentric bands, flowing forms, and organic layering.*

### Critical Parameters

| Parameter | Effect | Typical Range |
| :--- | :--- | :--- |
| `warpStrength` | Controls intensity of the marbling distortion | 2.0 – 6.0 |
| `noiseScale` | Zoom level of the pattern | 1.0 – 4.0 |
| `octaves` | Detail richness of the FBM | 4 – 6 |
| `offset_a..d` | Decorrelation offsets (prevent symmetry) | Arbitrary constants like `vec2(5.2, 1.3)` |
| `timeSpeed` | Animation rate applied to offsets | 0.01 – 0.05 (very slow) |

---

## 3. Complete GLSL Shader Code

### Vertex Shader
```glsl
// alcohol_ink_vert.glsl
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### Fragment Shader
```glsl
// alcohol_ink_frag.glsl
precision highp float;

varying vec2 vUv;

// --- Uniforms ---
uniform float uTime;
uniform float uWarpStrength;    // 2.0 - 6.0
uniform float uNoiseScale;      // 1.0 - 4.0
uniform float uEdgeIntensity;   // 0.0 - 2.0
uniform float uLayerOpacity;    // 0.3 - 0.7 for second layer
uniform vec2  uResolution;
uniform vec2  uMouse;           // Normalized mouse position (0-1)
uniform float uBass;            // Audio: low frequency energy
uniform float uMid;             // Audio: mid frequency energy
uniform float uTreble;          // Audio: high frequency energy

// Palette colors (configurable via uniforms)
uniform vec3 uColor1;  // Darkest  (e.g., black)
uniform vec3 uColor2;  // Dark accent (e.g., aubergine)
uniform vec3 uColor3;  // Mid tone (e.g., crimson)
uniform vec3 uColor4;  // Light accent (e.g., rosé)
uniform vec3 uColor5;  // Brightest (e.g., white)

// --- Simplex 3D Noise ---
// Adapted from Ashima Arts (MIT License)
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x  = x_ * ns.x + ns.yyyy;
    vec4 y  = y_ * ns.x + ns.yyyy;
    vec4 h  = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// --- FBM (Fractional Brownian Motion) ---
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    // Using 5 octaves for rich detail
    for (int i = 0; i < 5; i++) {
        value += amplitude * snoise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// --- Domain Warping (Double Warp) ---
float alcoholInkPattern(vec2 p, float time) {
    float scale = uNoiseScale;
    float warp = uWarpStrength + uBass * 1.5;
    vec3 pos = vec3(p * scale, time * 0.03);

    // First warp layer
    vec2 q = vec2(
        fbm(pos + vec3(0.0, 0.0, 0.0)),
        fbm(pos + vec3(5.2, 1.3, 0.0))
    );

    // Second warp layer (creates the agate banding)
    vec2 r = vec2(
        fbm(pos + warp * vec3(q, 0.0) + vec3(1.7, 9.2, 0.0)),
        fbm(pos + warp * vec3(q, 0.0) + vec3(8.3, 2.8, 0.0))
    );

    return fbm(pos + warp * vec3(r, 0.0));
}

// --- Color Palette Mapping ---
vec3 mapPalette(float t) {
    // Remap from [-1,1] noise range to [0,1]
    t = clamp(t * 0.5 + 0.5, 0.0, 1.0);

    // 5-stop color ramp with smooth transitions
    vec3 color = mix(uColor1, uColor2, smoothstep(0.0, 0.25, t));
    color = mix(color, uColor3, smoothstep(0.15, 0.45, t));
    color = mix(color, uColor4, smoothstep(0.40, 0.70, t));
    color = mix(color, uColor5, smoothstep(0.65, 1.00, t));

    return color;
}

// --- Main ---
void main() {
    // Aspect-corrected coordinates centered at origin
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    // Optional: mouse interaction warps local coordinates
    vec2 mouseOffset = (uMouse - 0.5) * vec2(aspect, 1.0);
    float mouseDist = length(p - mouseOffset);
    float mouseInfluence = smoothstep(0.5, 0.0, mouseDist) * 0.3;
    p += mouseInfluence * normalize(p - mouseOffset + 0.001);

    // Primary ink layer
    float pattern1 = alcoholInkPattern(p, uTime);

    // Secondary ink layer (offset, lower opacity) for translucent depth
    float pattern2 = alcoholInkPattern(
        p * 0.8 + vec2(3.14, 1.62),
        uTime * 0.7 + 100.0
    );

    // Map patterns to colors
    vec3 color1 = mapPalette(pattern1);
    vec3 color2 = mapPalette(pattern2 * 0.9 + 0.1);

    // Blend layers (translucent overlay)
    vec3 finalColor = mix(color1, color2, uLayerOpacity);

    // Edge enhancement: detect steep gradients in the pattern
    float edge = length(vec2(dFdx(pattern1), dFdy(pattern1)));
    edge = smoothstep(0.0, 0.15, edge);
    float edgeStrength = uEdgeIntensity + uTreble * 0.8;
    // Darken edges to create the concentrated pigment lines
    finalColor *= 1.0 - edge * edgeStrength * 0.6;

    // Audio-reactive bloom hint: brighten highlights on treble
    float brightness = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor += vec3(brightness * brightness * uTreble * 0.3);

    // Soft vignette for natural ink-on-black fade
    float vignette = smoothstep(0.9, 0.3, length((uv - 0.5) * 1.8));
    finalColor *= vignette;

    gl_FragColor = vec4(finalColor, 1.0);
}
```

---

## 4. Color Palette System

### Extracting a Palette from a Reference Image

When given a reference image, extract 5 key colors ordered from darkest to brightest:
1. **Background / Void** – The deepest dark area
2. **Dark Accent** – The deepest pigment concentration zone
3. **Mid Tone** – The dominant "body" color of the ink
4. **Light Accent** – The diluted, semi-transparent wash zone
5. **Highlight** – The brightest point where pigment is thinnest

### Pre-Built Palettes

#### Crimson Agate (Reference Image Palette)
```javascript
uColor1: new THREE.Color(0x000000),  // Pure black void
uColor2: new THREE.Color(0x4A1030),  // Deep aubergine
uColor3: new THREE.Color(0x8B1A2B),  // Rich crimson
uColor4: new THREE.Color(0xE8A0A8),  // Soft rosé
uColor5: new THREE.Color(0xFFFFFF),  // Pure white highlight
```

#### Ocean Ink
```javascript
uColor1: new THREE.Color(0x000508),  // Abyssal black-blue
uColor2: new THREE.Color(0x0A2540),  // Deep ocean
uColor3: new THREE.Color(0x0D6B6E),  // Teal
uColor4: new THREE.Color(0x5CE0D2),  // Light cyan
uColor5: new THREE.Color(0xF0FFFE),  // Ice white
```

#### Golden Marble
```javascript
uColor1: new THREE.Color(0x050200),  // Near-black brown
uColor2: new THREE.Color(0x3D1E00),  // Dark umber
uColor3: new THREE.Color(0xB87A1E),  // Warm amber
uColor4: new THREE.Color(0xE8C86A),  // Soft gold
uColor5: new THREE.Color(0xFFF8E7),  // Cream white
```

### Creating Custom Palettes

To create a new palette from any reference image:
1. Identify the 5 tonal zones (void → darkest pigment → body → wash → highlight)
2. Sample one representative HEX value from each zone
3. Ensure **monotonically increasing luminance** across the 5 stops
4. Test with `smoothstep` ramp – if two adjacent colors appear indistinguishable, increase their hue or saturation contrast

---

## 5. Three.js Integration

### ShaderMaterial Setup

```javascript
import * as THREE from 'three';

// Scratch objects (allocated once, never in the loop)
const _mouse = new THREE.Vector2(0.5, 0.5);

function createAlcoholInkMaterial(palette = 'crimsonAgate') {
    const palettes = {
        crimsonAgate: {
            uColor1: new THREE.Color(0x000000),
            uColor2: new THREE.Color(0x4A1030),
            uColor3: new THREE.Color(0x8B1A2B),
            uColor4: new THREE.Color(0xE8A0A8),
            uColor5: new THREE.Color(0xFFFFFF),
        },
        oceanInk: {
            uColor1: new THREE.Color(0x000508),
            uColor2: new THREE.Color(0x0A2540),
            uColor3: new THREE.Color(0x0D6B6E),
            uColor4: new THREE.Color(0x5CE0D2),
            uColor5: new THREE.Color(0xF0FFFE),
        },
        goldenMarble: {
            uColor1: new THREE.Color(0x050200),
            uColor2: new THREE.Color(0x3D1E00),
            uColor3: new THREE.Color(0xB87A1E),
            uColor4: new THREE.Color(0xE8C86A),
            uColor5: new THREE.Color(0xFFF8E7),
        },
    };

    const colors = palettes[palette] || palettes.crimsonAgate;

    return new THREE.ShaderMaterial({
        vertexShader: alcoholInkVertexShader,   // From Section 3
        fragmentShader: alcoholInkFragmentShader, // From Section 3
        uniforms: {
            uTime:          { value: 0.0 },
            uWarpStrength:  { value: 4.0 },
            uNoiseScale:    { value: 2.5 },
            uEdgeIntensity: { value: 1.0 },
            uLayerOpacity:  { value: 0.45 },
            uResolution:    { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uMouse:         { value: new THREE.Vector2(0.5, 0.5) },
            uBass:          { value: 0.0 },
            uMid:           { value: 0.0 },
            uTreble:        { value: 0.0 },
            ...Object.fromEntries(
                Object.entries(colors).map(([key, val]) => [key, { value: val }])
            ),
        },
    });
}
```

### Fullscreen Quad Scene

```javascript
function setupAlcoholInkScene(renderer) {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = createAlcoholInkMaterial('crimsonAgate');
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    return { scene, camera, material, geometry, mesh };
}
```

### Post-Processing (Selective Bloom)

```javascript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

function setupBloom(renderer, scene, camera) {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.6,    // strength – subtle glow on bright areas
        0.4,    // radius
        0.85    // threshold – only bloom the brightest highlights
    );
    composer.addPass(bloomPass);

    return { composer, bloomPass };
}
```

### Animation Loop (Zero Allocations)

```javascript
function createAnimationLoop(material, composer, audioRefs) {
    let startTime = performance.now();
    let animationId = null;

    function animate() {
        animationId = requestAnimationFrame(animate);

        const elapsed = (performance.now() - startTime) * 0.001;
        material.uniforms.uTime.value = elapsed;

        // Audio reactivity (read from refs, no allocations)
        if (audioRefs) {
            material.uniforms.uBass.value = audioRefs.bassRef.current;
            material.uniforms.uMid.value = audioRefs.midRef.current;
            material.uniforms.uTreble.value = audioRefs.trebleRef.current;
        }

        composer.render();
    }

    function start() { animate(); }
    function stop()  { if (animationId) cancelAnimationFrame(animationId); }

    return { start, stop };
}
```

### Dispose (Memory Cleanup)

```javascript
function disposeAlcoholInk({ geometry, material, mesh, composer, renderer }) {
    geometry.dispose();
    material.dispose();
    if (composer) {
        composer.passes.forEach(pass => {
            if (pass.dispose) pass.dispose();
        });
    }
    renderer.dispose();
}
```

### Art Cube Harness Integration

When integrating into the Art Cube `ExperienceComponentProps` system:
1. Store audio props in refs to bypass React render cycles:
   ```javascript
   const bassRef = useRef(0); bassRef.current = bass;
   const midRef  = useRef(0); midRef.current  = mid;
   const trebleRef = useRef(0); trebleRef.current = treble;
   ```
2. Call `onCanvasesReady(canvas, canvas)` after the WebGL canvas mounts.
3. Provide `onRendererReady({ start, handlePeerMessage })` exposing the animation loop start and interaction handler.
4. Return full cleanup in the `useEffect` teardown.

---

## 6. Animation & Interaction

### Time-Based Animation

The organic "breathing" motion comes from the `uTime` uniform flowing into the noise z-coordinate. Critical tuning:

| Parameter | Value | Effect |
| :--- | :--- | :--- |
| Time multiplier in shader | `time * 0.03` | Controls overall animation speed |
| Secondary layer time offset | `uTime * 0.7 + 100.0` | Layers drift at different speeds → parallax |
| Secondary layer scale | `p * 0.8 + vec2(3.14, 1.62)` | Different zoom + offset → no pattern repetition |

**Rule: Keep the time multiplier between 0.02 and 0.05.** Alcohol ink is meditative – fast animation destroys the illusion.

### Audio Reactivity Mapping

| Audio Band | Shader Parameter | Effect |
| :--- | :--- | :--- |
| `bass` | `uWarpStrength += bass * 1.5` | Heavy beats intensify the marbling distortion |
| `mid` | `uNoiseScale += mid * 0.5` | Vocals/instruments shift the pattern zoom |
| `treble` | `uEdgeIntensity += treble * 0.8` | High frequencies sharpen the agate lines |
| `treble` | Bloom brightness boost | Bright areas flash on treble hits |

Apply exponential decay to prevent choppy transitions:
```javascript
// In the animation loop (smoothed values)
smoothBass = smoothBass + (rawBass - smoothBass) * 0.1;
```

### Mouse / Touch Interaction

The shader includes a mouse influence zone that locally warps the ink pattern:
- **Push mode** (default): Ink flows away from the cursor, like dragging a finger through wet ink
- The influence radius is controlled by `smoothstep(0.5, 0.0, mouseDist)`
- Update the `uMouse` uniform from normalized pointer coordinates:
  ```javascript
  canvas.addEventListener('pointermove', (e) => {
      material.uniforms.uMouse.value.set(
          e.clientX / window.innerWidth,
          1.0 - e.clientY / window.innerHeight  // Flip Y for GLSL
      );
  });
  ```

### Pacing Guidelines

| Experience Mood | timeSpeed | warpStrength | edgeIntensity | Bloom |
| :--- | :--- | :--- | :--- | :--- |
| Meditative / Calm | 0.02 | 3.0 | 0.5 | 0.3 |
| Default / Balanced | 0.03 | 4.0 | 1.0 | 0.6 |
| Energetic / Reactive | 0.05 | 5.5 | 1.5 | 1.0 |

---

## 7. Variations & Combinability

### Variation A – Ink Flow

Combine the alcohol ink pattern with a simplified 2D velocity field to create directional ink streaming.
- Add a `uniform vec2 uFlowDirection` that offsets the warp coordinates over time
- The ink appears to flow in a dominant direction while maintaining its banded structure
- Best combined with: bass-reactive flow speed changes

### Variation B – Crystalline Ink

Emphasize the edge-lines and reduce soft gradients to create a hard, crystalline, geode-like look.
- Increase `uEdgeIntensity` to 2.0+
- Replace smooth color palette with high-contrast metallic tones
- Add specular highlights by boosting pixels where `edge > threshold`
- Best combined with: geometric 3D meshes (map as texture onto crystal geometry)

### Variation C – Nebula Ink

Reduce edge intensity, increase layer count, and add depth-based fog for a cosmic nebula effect.
- Set `uEdgeIntensity` to 0.2 (nearly invisible edges)
- Increase `uLayerOpacity` to 0.6 for more blending
- Add a third noise layer with very low frequency for large-scale color variation
- Apply additive blending for bright emission against dark space
- Best combined with: star field point cloud overlay

### Combining with Other Systems

The alcohol ink shader can serve as:
- **Background layer** behind 3D particle systems or instanced geometry
- **Texture source** mapped onto 3D surfaces (use `ShaderMaterial` on any mesh, not just a quad)
- **Displacement driver** where the noise pattern drives vertex displacement on a subdivided plane
- **Color lookup** where other systems sample the ink pattern to inherit its color palette

---

## 8. Standalone HTML Example

A minimal, self-contained file that renders the alcohol ink effect. Save as `.html` and open directly in a browser.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alcohol Ink Shader</title>
<style>
  * { margin: 0; padding: 0; }
  body { overflow: hidden; background: #000; }
  canvas { display: block; width: 100vw; height: 100vh; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script type="importmap">
{ "imports": { "three": "https://unpkg.com/three@0.175.0/build/three.module.js" } }
</script>
<script type="module">
import * as THREE from 'three';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod(i,289.0);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

float fbm(vec3 p){
  float v=0.0,a=0.5;
  for(int i=0;i<5;i++){v+=a*snoise(p);p*=2.0;a*=0.5;}
  return v;
}

float inkPattern(vec2 p,float t){
  vec3 pos=vec3(p*2.5,t*0.03);
  vec2 q=vec2(fbm(pos),fbm(pos+vec3(5.2,1.3,0.0)));
  vec2 r=vec2(fbm(pos+4.0*vec3(q,0.0)+vec3(1.7,9.2,0.0)),
              fbm(pos+4.0*vec3(q,0.0)+vec3(8.3,2.8,0.0)));
  return fbm(pos+4.0*vec3(r,0.0));
}

vec3 palette(float t){
  t=clamp(t*0.5+0.5,0.0,1.0);
  vec3 c1=vec3(0.0);
  vec3 c2=vec3(0.29,0.063,0.19);
  vec3 c3=vec3(0.545,0.102,0.169);
  vec3 c4=vec3(0.91,0.627,0.659);
  vec3 c5=vec3(1.0);
  vec3 col=mix(c1,c2,smoothstep(0.0,0.25,t));
  col=mix(col,c3,smoothstep(0.15,0.45,t));
  col=mix(col,c4,smoothstep(0.40,0.70,t));
  col=mix(col,c5,smoothstep(0.65,1.00,t));
  return col;
}

void main(){
  vec2 uv=vUv;
  float aspect=uResolution.x/uResolution.y;
  vec2 p=(uv-0.5)*vec2(aspect,1.0);

  vec2 mo=(uMouse-0.5)*vec2(aspect,1.0);
  float md=length(p-mo);
  p+=smoothstep(0.5,0.0,md)*0.3*normalize(p-mo+0.001);

  float p1=inkPattern(p,uTime);
  float p2=inkPattern(p*0.8+vec2(3.14,1.62),uTime*0.7+100.0);

  vec3 col1=palette(p1);
  vec3 col2=palette(p2*0.9+0.1);
  vec3 col=mix(col1,col2,0.45);

  float edge=length(vec2(dFdx(p1),dFdy(p1)));
  col*=1.0-smoothstep(0.0,0.15,edge)*0.6;

  col*=smoothstep(0.9,0.3,length((uv-0.5)*1.8));
  gl_FragColor=vec4(col,1.0);
}`;

const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    },
});

scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

window.addEventListener('pointermove', (e) => {
    material.uniforms.uMouse.value.set(
        e.clientX / window.innerWidth,
        1.0 - e.clientY / window.innerHeight
    );
});

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

const startTime = performance.now();
(function animate() {
    requestAnimationFrame(animate);
    material.uniforms.uTime.value = (performance.now() - startTime) * 0.001;
    renderer.render(scene, camera);
})();
</script>
</body>
</html>
```
