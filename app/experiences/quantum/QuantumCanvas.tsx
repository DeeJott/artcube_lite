'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { createPostProcessing } from '../../lib/three/postProcessing';
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

const ASPECT = 1920 / 1080;
const MAX_LINES = 160;

// Helper to generate a soft glowing radial texture for the particles
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0,    'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.6,  'rgba(255,255,255,0.12)');
  grad.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// Custom GPGPU Compute Shaders
const VEL_SHADER = /* glsl */`
  uniform float uDelta;
  uniform float uTime;
  uniform vec3 uCoreAlice;
  uniform vec3 uCoreBob;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uCollapse;
  uniform vec3 uPointerAlice;
  uniform vec3 uPointerBob;
  uniform float uPointerRadius;
  uniform float uPointerForce;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);

    bool isAlice = uv.y < 0.5;
    vec3 core = isAlice ? uCoreAlice : uCoreBob;
    vec3 pointer = isAlice ? uPointerAlice : uPointerBob;

    vec3 d = core - pos.xyz;
    float dist = length(d) + 0.0001;
    vec3 pull = normalize(d) * (0.006 + uBass * 0.012);

    // Orbit force
    vec3 tangent = isAlice ? vec3(-d.y, d.x, 0.0) : vec3(d.y, -d.x, 0.0);
    vec3 orbit = normalize(tangent) * (0.007 + uMid * 0.008);

    // Curl noise turbulence
    float n = noise(pos.xy * 4.0 + vec2(uTime * 0.08, -uTime * 0.06));
    vec3 curl = vec3(
      noise(pos.xy * 3.5 + vec2(0.0, 4.2) + uTime * 0.05) - n,
      n - noise(pos.xy * 3.5 + vec2(3.8, 0.0) - uTime * 0.05),
      0.0
    );

    vec3 force = pull * 2.0 + orbit * 1.4 + curl * (0.018 + uMid * 0.025);

    // Dynamic wave collapse - pulls particles directly to core
    if (uCollapse > 0.01) {
      force = mix(force, d * 18.0, uCollapse);
    }

    // Pointer repulsion / vortex
    if (uPointerForce > 0.01) {
      vec3 pd = pos.xyz - pointer;
      float pDist = length(pd) + 0.0001;
      if (pDist < uPointerRadius) {
        float falloff = pow(1.0 - pDist / uPointerRadius, 1.8);
        vec3 pRepel = normalize(pd) * uPointerForce * 0.03;
        vec3 pSwirl = vec3(-pd.y, pd.x, 0.0) * uPointerForce * 0.02;
        force += (pRepel + pSwirl) * falloff;
      }
    }

    float dt = uDelta * 0.001;
    float damping = 0.965 - uTreble * 0.005;
    vec3 newVel = vel.xyz * damping + force * dt * 12.0;

    // Speed limiter
    float speed = length(newVel);
    if (speed > 0.8) {
      newVel = normalize(newVel) * 0.8;
    }

    gl_FragColor = vec4(newVel, 1.0);
  }
`;

const POS_SHADER = /* glsl */`
  uniform float uDelta;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);

    float dt = uDelta * 0.001;
    vec3 newPos = pos.xyz + vel.xyz * dt * 14.0;

    gl_FragColor = vec4(newPos, 1.0);
  }
`;

// Visualization shaders
const POINT_VERT = /* glsl */`
  uniform sampler2D texturePosition;
  uniform sampler2D textureVelocity;
  uniform float uSize;
  uniform float uTime;
  uniform float uTreble;
  uniform float uBass;
  attribute vec2 ref;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 pos = texture2D(texturePosition, ref);
    vec4 vel = texture2D(textureVelocity, ref);

    bool isAlice = ref.y < 0.5;
    float speed = length(vel.xyz);

    // Color theme definition
    vec3 aliceColor = vec3(0.08, 0.35, 1.0);    // Cobalt blue
    vec3 bobColor = vec3(1.0, 0.32, 0.06);      // Coral orange
    vec3 glowColor = isAlice ? aliceColor : bobColor;

    // Sparkle effect
    float sparkle = 0.88 + 0.12 * sin(uTime * 4.0 + ref.x * 80.0);

    // Make fast particles shift towards white / high emission
    vColor = mix(glowColor, vec3(0.85, 0.95, 1.0), clamp(speed * 0.28, 0.0, 0.8)) * sparkle;
    
    // Fade elements based on speed and audio reactives
    vAlpha = 0.45 + clamp(speed * 0.15, 0.0, 0.5) + uBass * 0.15;

    vec4 mvPosition = modelViewMatrix * vec4(pos.xyz, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * (0.6 + uTreble * 0.5 + speed * 0.3) * (1.0 / -mvPosition.z);
  }
`;

const POINT_FRAG = /* glsl */`
  uniform sampler2D uGlow;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 glow = texture2D(uGlow, gl_PointCoord);
    gl_FragColor = vec4(vColor, vAlpha) * glow;
  }
`;

export function QuantumCanvas({
  isRunning,
  intensity,
  bass,
  mid,
  treble,
  lastBeatTime,
  isMobile,
  sendInteraction,
  onCanvasesReady,
  onRendererReady,
}: ExperienceComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(0);
  const bassRef = useRef(0);
  const midRef = useRef(0);
  const trebleRef = useRef(0);
  const prevBeatRef = useRef(0);
  const collapseRef = useRef(0);
  const isStartedRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Core targets for entanglement nodes
  const coreAliceRef = useRef(new THREE.Vector3(-0.35, 0, 0));
  const coreBobRef = useRef(new THREE.Vector3(0.35, 0, 0));

  // Pointer excitations
  const pointerAliceRef = useRef(new THREE.Vector3(0, 0, 0));
  const pointerBobRef = useRef(new THREE.Vector3(0, 0, 0));
  const pointerForceRef = useRef(0);

  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { bassRef.current = bass; }, [bass]);
  useEffect(() => { midRef.current = mid; }, [mid]);
  useEffect(() => { trebleRef.current = treble; }, [treble]);

  // Audio-reactive collapse trigger (on beats)
  useEffect(() => {
    if (lastBeatTime && lastBeatTime !== prevBeatRef.current) {
      prevBeatRef.current = lastBeatTime;
      collapseRef.current = 1.0;
    }
  }, [lastBeatTime]);

  const updateQuantumInteraction = useCallback((rx: number, ry: number, isStart = false) => {
    const wx = (rx - 0.5) * ASPECT;
    const wy = 0.5 - ry;

    pointerForceRef.current = isStart ? 4.2 : Math.min(6.0, pointerForceRef.current + 0.35);

    if (wx < 0) {
      // Alice Interaction -> Mirrored Bob
      pointerAliceRef.current.set(wx, wy, 0);
      pointerBobRef.current.set(-wx, -wy, 0);

      // Core drift
      coreAliceRef.current.set(
        THREE.MathUtils.lerp(coreAliceRef.current.x, wx, 0.08),
        THREE.MathUtils.lerp(coreAliceRef.current.y, wy, 0.08),
        0
      );
      coreBobRef.current.set(-coreAliceRef.current.x, -coreAliceRef.current.y, 0);
    } else {
      // Bob Interaction -> Mirrored Alice
      pointerBobRef.current.set(wx, wy, 0);
      pointerAliceRef.current.set(-wx, -wy, 0);

      // Core drift
      coreBobRef.current.set(
        THREE.MathUtils.lerp(coreBobRef.current.x, wx, 0.08),
        THREE.MathUtils.lerp(coreBobRef.current.y, wy, 0.08),
        0
      );
      coreAliceRef.current.set(-coreBobRef.current.x, -coreBobRef.current.y, 0);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(1920, 1080, false);
    renderer.setClearColor(0x020306, 1);

    const cam = createCinematicCamera(ASPECT);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020306, 0.28);

    const composer = createPostProcessing(renderer, scene, cam, {
      bloomStrength: 1.45,
      bloomRadius: 0.62,
      bloomThreshold: 0.04,
      filmIntensity: 0.06,
      chromaticAberration: true,
      vignette: true,
    });

    const glowTex = makeGlowTexture();

    // Determine particle parameters based on platform capabilities
    const TEX_SIZE = isMobile ? 64 : 128;
    const PARTICLE_COUNT = TEX_SIZE * TEX_SIZE;

    // --- GPU Computation Setup ---
    const gpuCompute = new GPUComputationRenderer(TEX_SIZE, TEX_SIZE, renderer);

    const posTex0 = gpuCompute.createTexture();
    const velTex0 = gpuCompute.createTexture();
    const posArr = posTex0.image.data as unknown as Float32Array;
    const velArr = velTex0.image.data as unknown as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 4;
      const refY = (Math.floor(i / TEX_SIZE) + 0.5) / TEX_SIZE;
      const isAlice = refY < 0.5;

      const angle = Math.random() * Math.PI * 2;
      const r = 0.05 + Math.random() * 0.15;
      const cx = isAlice ? -0.35 : 0.35;

      posArr[idx] = cx + Math.cos(angle) * r;
      posArr[idx + 1] = Math.sin(angle) * r;
      posArr[idx + 2] = (Math.random() - 0.5) * 0.05;
      posArr[idx + 3] = 1;

      velArr[idx] = 0;
      velArr[idx + 1] = 0;
      velArr[idx + 2] = 0;
      velArr[idx + 3] = 0;
    }

    const posVar = gpuCompute.addVariable('texturePosition', POS_SHADER, posTex0);
    const velVar = gpuCompute.addVariable('textureVelocity', VEL_SHADER, velTex0);

    gpuCompute.setVariableDependencies(posVar, [posVar, velVar]);
    gpuCompute.setVariableDependencies(velVar, [velVar, posVar]);

    posVar.material.uniforms.uDelta = { value: 16.67 };
    velVar.material.uniforms.uDelta = { value: 16.67 };
    velVar.material.uniforms.uTime = { value: 0 };
    velVar.material.uniforms.uCoreAlice = { value: coreAliceRef.current };
    velVar.material.uniforms.uCoreBob = { value: coreBobRef.current };
    velVar.material.uniforms.uBass = { value: 0 };
    velVar.material.uniforms.uMid = { value: 0 };
    velVar.material.uniforms.uTreble = { value: 0 };
    velVar.material.uniforms.uCollapse = { value: 0 };
    velVar.material.uniforms.uPointerAlice = { value: pointerAliceRef.current };
    velVar.material.uniforms.uPointerBob = { value: pointerBobRef.current };
    velVar.material.uniforms.uPointerRadius = { value: 0.28 };
    velVar.material.uniforms.uPointerForce = { value: 0 };

    const initError = gpuCompute.init();
    if (initError) console.error('GPUComputationRenderer error:', initError);

    // --- Visualization Setup ---
    const refs = new Float32Array(PARTICLE_COUNT * 2);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      refs[i * 2] = (i % TEX_SIZE + 0.5) / TEX_SIZE;
      refs[i * 2 + 1] = (Math.floor(i / TEX_SIZE) + 0.5) / TEX_SIZE;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
    geo.setAttribute('ref', new THREE.BufferAttribute(refs, 2));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        texturePosition: { value: null },
        textureVelocity: { value: null },
        uGlow: { value: glowTex },
        uTime: { value: 0 },
        uSize: { value: isMobile ? 3.0 : 4.0 },
        uBass: { value: 0 },
        uTreble: { value: 0 },
      },
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // --- Core Connection Beam (EPR Laser) ---
    const beamGeo = new THREE.BufferGeometry();
    const beamPos = new Float32Array(6);
    beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPos, 3));
    const beamMat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      linewidth: 2,
      depthWrite: false,
    });
    const coreBeam = new THREE.Line(beamGeo, beamMat);
    scene.add(coreBeam);

    // --- Entanglement Filaments (Lines between twin particles) ---
    const lineGeo = new THREE.BufferGeometry();
    const linePosArr = new Float32Array(MAX_LINES * 6);
    const lineColArr = new Float32Array(MAX_LINES * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePosArr, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColArr, 3));

    const lineSegMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lineSegs = new THREE.LineSegments(lineGeo, lineSegMat);
    scene.add(lineSegs);

    // Scratch colors hoisted outside the render loop (zero-allocation policy)
    const scratchColA = new THREE.Color(0x00aaff);
    const scratchColB = new THREE.Color(0xff4400);
    const scratchColMer = new THREE.Color(0x00ffcc);
    const scratchMixA = new THREE.Color();
    const scratchMixB = new THREE.Color();

    onCanvasesReady(canvas, canvas);

    const posReadback = new Float32Array(PARTICLE_COUNT * 4);
    let lastTime = performance.now();
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(now - lastTime, 32);
      lastTime = now;
      const t = now / 1000;

      // Audio reactive decays
      collapseRef.current = Math.max(0.0, collapseRef.current - dt * 0.0028);
      pointerForceRef.current = Math.max(0.0, pointerForceRef.current - dt * 0.0035);

      const bV = bassRef.current;
      const mV = midRef.current;
      const trV = trebleRef.current;
      const pulse = collapseRef.current;

      // Update velocities uniforms
      const velUniforms = velVar.material.uniforms;
      velUniforms.uDelta.value = dt;
      velUniforms.uTime.value = t;
      velUniforms.uCoreAlice.value.copy(coreAliceRef.current);
      velUniforms.uCoreBob.value.copy(coreBobRef.current);
      velUniforms.uBass.value = bV;
      velUniforms.uMid.value = mV;
      velUniforms.uTreble.value = trV;
      velUniforms.uCollapse.value = pulse;
      velUniforms.uPointerAlice.value.copy(pointerAliceRef.current);
      velUniforms.uPointerBob.value.copy(pointerBobRef.current);
      velUniforms.uPointerForce.value = pointerForceRef.current;

      posVar.material.uniforms.uDelta.value = dt;

      gpuCompute.compute();

      // Read back positions target to draw CPU line filaments
      const posRT = gpuCompute.getCurrentRenderTarget(posVar);
      renderer.readRenderTargetPixels(posRT, 0, 0, TEX_SIZE, TEX_SIZE, posReadback);

      // Render Central EPR Beam
      beamPos[0] = coreAliceRef.current.x;
      beamPos[1] = coreAliceRef.current.y;
      beamPos[2] = coreAliceRef.current.z;
      beamPos[3] = coreBobRef.current.x;
      beamPos[4] = coreBobRef.current.y;
      beamPos[5] = coreBobRef.current.z;
      beamGeo.attributes.position.needsUpdate = true;
      beamMat.opacity = (0.2 + bV * 0.6 + trV * 0.15) * (1.0 - pulse * 0.4);

      // Render paired filaments using stride to keep CPU updates lightweight
      let lineIdx = 0;
      const totalPairs = PARTICLE_COUNT / 2;
      const stride = Math.max(1, Math.floor(totalPairs / MAX_LINES));

      // Reuse scratch colors (hoisted outside loop)
      scratchMixA.copy(scratchColA).lerp(scratchColMer, bV * 0.4);
      scratchMixB.copy(scratchColB).lerp(scratchColMer, bV * 0.4);

      for (let i = 0; i < MAX_LINES; i++) {
        const pIndex = i * stride;
        if (pIndex >= totalPairs) break;

        const offAlice = pIndex * 4;
        const offBob = (pIndex + totalPairs) * 4;

        const ax = posReadback[offAlice];
        const ay = posReadback[offAlice + 1];
        const az = posReadback[offAlice + 2];

        const bx = posReadback[offBob];
        const by = posReadback[offBob + 1];
        const bz = posReadback[offBob + 2];

        const dist = Math.hypot(ax - bx, ay - by, az - bz);

        // Lines fade as particles move too far apart
        const fade = Math.max(0, 1 - dist / 1.35) * (0.6 + mV * 0.4) * (1.0 - pulse * 0.5);

        if (fade > 0.05) {
          const lOffset = lineIdx * 6;
          linePosArr[lOffset] = ax;
          linePosArr[lOffset + 1] = ay;
          linePosArr[lOffset + 2] = az;
          linePosArr[lOffset + 3] = bx;
          linePosArr[lOffset + 4] = by;
          linePosArr[lOffset + 5] = bz;

          lineColArr[lOffset] = scratchMixA.r * fade;
          lineColArr[lOffset + 1] = scratchMixA.g * fade;
          lineColArr[lOffset + 2] = scratchMixA.b * fade;

          lineColArr[lOffset + 3] = scratchMixB.r * fade;
          lineColArr[lOffset + 4] = scratchMixB.g * fade;
          lineColArr[lOffset + 5] = scratchMixB.b * fade;

          lineIdx++;
        }
      }

      lineGeo.setDrawRange(0, lineIdx * 2);
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;

      // Update points uniforms
      mat.uniforms.texturePosition.value = posRT.texture;
      mat.uniforms.textureVelocity.value = gpuCompute.getCurrentRenderTarget(velVar).texture;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uBass.value = bV;
      mat.uniforms.uTreble.value = trV;

      updateCinematicCamera(cam, t, mouseRef.current.x, mouseRef.current.y, 0.42);
      composer.render();
    };

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        animate();
      },
      handlePeerMessage: (msg) => {
        const m = msg as unknown as Record<string, unknown>;
        if (m.type === 'INTERACTION' && m.kind === 'QUANTUM_TOUCH') {
          const d = (m.data ?? {}) as Record<string, number>;
          updateQuantumInteraction(d.rx ?? 0.25, d.ry ?? 0.5);
        }
      },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      composer.dispose();
      geo.dispose();
      mat.dispose();
      glowTex.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      lineGeo.dispose();
      lineSegMat.dispose();
      gpuCompute.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointer = useCallback((clientX: number, clientY: number, isStart = false) => {
    if (!isStartedRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;

    updateQuantumInteraction(rx, ry, isStart);
    sendInteraction('QUANTUM_TOUCH', { rx, ry });
  }, [updateQuantumInteraction, sendInteraction]);

  return (
    <div
      className="absolute inset-0"
      onMouseDown={(e) => handlePointer(e.clientX, e.clientY, true)}
      onMouseMove={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        mouseRef.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        mouseRef.current.y = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
        if (e.buttons > 0) handlePointer(e.clientX, e.clientY, false);
      }}
      onTouchStart={(e) => handlePointer(e.touches[0].clientX, e.touches[0].clientY, true)}
      onTouchMove={(e) => handlePointer(e.touches[0].clientX, e.touches[0].clientY, false)}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ aspectRatio: '16/9' }}
      />
    </div>
  );
}
