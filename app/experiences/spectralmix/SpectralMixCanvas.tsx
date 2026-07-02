'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { createPostProcessing } from '../../lib/three/postProcessing';
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

const ASPECT = 1920 / 1080;
const TEX_SIZE = 128;
const PARTICLE_COUNT = TEX_SIZE * TEX_SIZE;
const MAX_STROKES = 28;

interface Stroke {
  x: number;
  y: number;
  vx: number;
  vy: number;
  force: number;
  radius: number;
  hue: number;
  life: number;
  maxLife: number;
}

function makeGlowTexture(): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,255,255,0.72)');
  grad.addColorStop(0.58, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const VEL_SHADER = /* glsl */`
  uniform float uDelta;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uIntensity;
  uniform float uBeatPulse;
  uniform float uGravity;
  uniform vec4 uStrokes[${MAX_STROKES}];
  uniform vec4 uStrokeData[${MAX_STROKES}];
  uniform int uStrokeCount;

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
    float dt = uDelta * 0.001;

    vec2 p = pos.xy;
    float gravity = max(uGravity, 0.02);
    vec2 baseA = pos.zw;
    vec2 baseB = vec2(sin(pos.w * 7.0 + pos.z * 5.0), cos(pos.z * 8.0 - pos.w * 4.0)) * 0.46;
    vec2 baseC = normalize(vec2(baseA.y + 0.001, -baseA.x + 0.001)) * (0.25 + length(baseA) * 0.55);
    float phase = 0.5 + 0.5 * sin(uTime * 0.07 + uIntensity * 1.2 + uMid * 0.5);
    vec2 target = mix(mix(baseA, baseB, phase), baseC, 0.22 + uBass * 0.14 + uBeatPulse * 0.1);
    vec2 force = (target - p) * (0.00072 + uBass * 0.00055) * gravity;

    float n = noise(p * 3.0 + vec2(uTime * 0.055, -uTime * 0.04));
    vec2 curl = vec2(
      noise(p * 3.0 + vec2(0.0, 3.7) + uTime * 0.05) - n,
      n - noise(p * 3.0 + vec2(4.1, 0.0) - uTime * 0.045)
    );
    force += curl * (0.0028 + uMid * 0.004 + uTreble * 0.0018) * gravity;

    for (int i = 0; i < ${MAX_STROKES}; i++) {
      if (i >= uStrokeCount) break;
      vec2 s = uStrokes[i].xy;
      float radius = uStrokes[i].z;
      float strength = uStrokes[i].w;
      vec2 drag = uStrokeData[i].xy;
      float swirl = uStrokeData[i].z;
      vec2 d = p - s;
      float dist = length(d) + 0.0001;
      if (dist < radius) {
        float falloff = pow(1.0 - dist / radius, 2.0);
        vec2 tangent = vec2(-d.y, d.x) / dist;
        vec2 radial = d / dist;
        force += drag * falloff * strength * 0.017 * gravity;
        force += tangent * falloff * strength * swirl * 0.014 * gravity;
        force -= radial * falloff * strength * 0.0045 * gravity;
      }
    }

    float motion = mix(0.18, 1.45, gravity);
    float damping = mix(0.86, 0.95, gravity) - uTreble * 0.008;
    vel.xy = vel.xy * damping + force * dt * 34.0 * motion;
    gl_FragColor = vec4(vel.xy, 0.0, 0.0);
  }
`;

const POS_SHADER = /* glsl */`
  uniform float uDelta;
  uniform float uGravity;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);
    float dt = uDelta * 0.001;
    pos.xy += vel.xy * dt * mix(6.0, 34.0, max(uGravity, 0.02));
    gl_FragColor = pos;
  }
`;

const POINT_VERT = /* glsl */`
  uniform sampler2D texturePosition;
  uniform sampler2D textureVelocity;
  uniform sampler2D uGlow;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uIntensity;
  uniform float uBeatPulse;
  uniform float uSize;
  uniform vec4 uStrokes[${MAX_STROKES}];
  uniform vec4 uStrokeData[${MAX_STROKES}];
  uniform int uStrokeCount;
  attribute vec2 ref;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 palette(float t) {
    vec3 a = vec3(0.00, 1.00, 0.72);
    vec3 b = vec3(0.18, 0.78, 1.00);
    vec3 c = vec3(0.75, 0.28, 1.00);
    vec3 d = vec3(1.00, 0.28, 0.08);
    return mix(mix(a, b, smoothstep(0.0, 0.36, t)), mix(c, d, smoothstep(0.36, 1.0, t)), smoothstep(0.18, 0.9, t));
  }

  void main() {
    vec4 pos = texture2D(texturePosition, ref);
    vec4 vel = texture2D(textureVelocity, ref);
    vec2 p = pos.xy;
    float speed = length(vel.xy);
    float radius = length(p);
    float field = 0.5 + 0.5 * sin(radius * 8.0 - uTime * 0.28 + atan(p.y, p.x) * 2.0);
    float heat = clamp(field * 0.55 + speed * 18.0 + uBass * 0.25 + uBeatPulse * 0.35, 0.0, 1.0);
    vec3 col = palette(fract(heat + ref.x * 0.18 + uTime * 0.025));

    for (int i = 0; i < ${MAX_STROKES}; i++) {
      if (i >= uStrokeCount) break;
      vec2 s = uStrokes[i].xy;
      float sr = uStrokes[i].z;
      float d = length(p - s);
      float local = smoothstep(sr, 0.0, d) * uStrokes[i].w;
      col += palette(fract(uStrokeData[i].w + local * 0.28)) * local * 1.5;
    }

    vColor = col * (0.48 + uIntensity * 0.65 + uTreble * 0.38);
    vAlpha = 0.22 + heat * 0.86;
    float z = sin(p.x * 5.0 + uTime * 0.18) * 0.028 + cos(p.y * 7.0 - uTime * 0.14) * 0.02 + speed * 0.55;
    vec4 mvPosition = modelViewMatrix * vec4(p.x, p.y, z, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * (0.65 + heat * 1.9 + uBeatPulse * 0.8) * (1.0 / -mvPosition.z);
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

export function SpectralMixCanvas({
  isRunning,
  intensity,
  bass,
  mid,
  treble,
  lastBeatTime,
  sendInteraction,
  onCanvasesReady,
  onRendererReady,
}: ExperienceComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gravity, setGravity] = useState(0.35);
  const gravityRef = useRef(0.35);
  const strokesRef = useRef<Stroke[]>([]);
  const intensityRef = useRef(0);
  const bassRef = useRef(0);
  const midRef = useRef(0);
  const trebleRef = useRef(0);
  const prevBeatRef = useRef(0);
  const beatPulseRef = useRef(0);
  const isStartedRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, x: 0.5, y: 0.5, t: 0, hue: 0 });

  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { bassRef.current = bass; }, [bass]);
  useEffect(() => { midRef.current = mid; }, [mid]);
  useEffect(() => { trebleRef.current = treble; }, [treble]);
  useEffect(() => { gravityRef.current = gravity; }, [gravity]);

  useEffect(() => {
    if (lastBeatTime && lastBeatTime !== prevBeatRef.current) {
      prevBeatRef.current = lastBeatTime;
      beatPulseRef.current = 1.0;
    }
  }, [lastBeatTime]);

  const addStroke = useCallback((rx: number, ry: number, vx: number, vy: number, force = 1.0, hue?: number) => {
    const h = hue ?? (dragRef.current.hue + 0.075) % 1;
    dragRef.current.hue = h;
    strokesRef.current.push({
      x: (rx - 0.5) * ASPECT,
      y: 0.5 - ry,
      vx,
      vy: -vy,
      force,
      radius: 0.16 + Math.min(0.18, Math.hypot(vx, vy) * 0.012) + bassRef.current * 0.04,
      hue: h,
      life: 0,
      maxLife: 2500 + force * 1700 + (1 - gravityRef.current) * 1800,
    });
    if (strokesRef.current.length > MAX_STROKES) {
      strokesRef.current = strokesRef.current.slice(-MAX_STROKES);
    }
  }, []);

  const pointerToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      rx: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      ry: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const emitStroke = useCallback((rx: number, ry: number, vx: number, vy: number, force: number, hue: number) => {
    if (!isStartedRef.current) return;
    addStroke(rx, ry, vx, vy, force, hue);
    sendInteraction('SPECTRAL_MIX', { rx, ry, vx, vy, force, hue });
  }, [addStroke, sendInteraction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(1920, 1080, false);
    renderer.setClearColor(0x000309, 1);

    const cam = createCinematicCamera(ASPECT);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000309, 0.22);

    const composer = createPostProcessing(renderer, scene, cam, {
      bloomStrength: 1.45,
      bloomRadius: 0.66,
      bloomThreshold: 0.04,
      filmIntensity: 0.1,
      chromaticAberration: true,
      vignette: false,
    });

    const glowTex = makeGlowTexture();
    const gpuCompute = new GPUComputationRenderer(TEX_SIZE, TEX_SIZE, renderer);
    const posTex = gpuCompute.createTexture();
    const velTex = gpuCompute.createTexture();
    const posArr = posTex.image.data as unknown as Float32Array;
    const velArr = velTex.image.data as unknown as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 4;
      const a = (i / PARTICLE_COUNT) * Math.PI * 2 * 19.0;
      const lane = (i % TEX_SIZE) / TEX_SIZE;
      const shell = Math.floor(i / TEX_SIZE) / TEX_SIZE;
      const r = 0.08 + Math.pow(shell, 0.72) * 0.62;
      const wave = Math.sin(a * 3.0 + shell * 9.0) * 0.08;
      const x = Math.cos(a) * (r + wave) * ASPECT * 0.58;
      const y = Math.sin(a) * (r * 0.72 + wave * 0.45);
      posArr[idx] = x;
      posArr[idx + 1] = y;
      posArr[idx + 2] = (lane - 0.5) * ASPECT;
      posArr[idx + 3] = (shell - 0.5) * 0.94;
      velArr[idx] = 0;
      velArr[idx + 1] = 0;
      velArr[idx + 2] = 0;
      velArr[idx + 3] = 0;
    }

    const posVar = gpuCompute.addVariable('texturePosition', POS_SHADER, posTex);
    const velVar = gpuCompute.addVariable('textureVelocity', VEL_SHADER, velTex);
    gpuCompute.setVariableDependencies(posVar, [posVar, velVar]);
    gpuCompute.setVariableDependencies(velVar, [velVar, posVar]);

    posVar.material.uniforms.uDelta = { value: 16.67 };
    posVar.material.uniforms.uGravity = { value: gravityRef.current };
    velVar.material.uniforms.uDelta = { value: 16.67 };
    velVar.material.uniforms.uTime = { value: 0 };
    velVar.material.uniforms.uBass = { value: 0 };
    velVar.material.uniforms.uMid = { value: 0 };
    velVar.material.uniforms.uTreble = { value: 0 };
    velVar.material.uniforms.uIntensity = { value: 0 };
    velVar.material.uniforms.uBeatPulse = { value: 0 };
    velVar.material.uniforms.uGravity = { value: gravityRef.current };
    velVar.material.uniforms.uStrokes = { value: new Float32Array(MAX_STROKES * 4) };
    velVar.material.uniforms.uStrokeData = { value: new Float32Array(MAX_STROKES * 4) };
    velVar.material.uniforms.uStrokeCount = { value: 0 };

    const initError = gpuCompute.init();
    if (initError) console.error('GPUComputationRenderer init error:', initError);

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
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uIntensity: { value: 0 },
        uBeatPulse: { value: 0 },
        uSize: { value: 2.8 },
        uStrokes: { value: new Float32Array(MAX_STROKES * 4) },
        uStrokeData: { value: new Float32Array(MAX_STROKES * 4) },
        uStrokeCount: { value: 0 },
      },
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    onCanvasesReady(canvas, canvas);

    let rafId = 0;
    let lastTime = performance.now();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(now - lastTime, 32);
      lastTime = now;
      const time = now / 1000;

      beatPulseRef.current *= 0.91;
      for (const s of strokesRef.current) s.life += dt;
      strokesRef.current = strokesRef.current.filter(s => s.life < s.maxLife);

      const count = Math.min(strokesRef.current.length, MAX_STROKES);
      const velU = velVar.material.uniforms;
      const visU = mat.uniforms;

      for (let i = 0; i < MAX_STROKES; i++) {
        const off = i * 4;
        const s = strokesRef.current[i];
        if (i < count && s) {
          const life = 1 - s.life / s.maxLife;
          const ease = life * life * (3 - 2 * life);
          (velU.uStrokes.value as Float32Array)[off] = s.x;
          (velU.uStrokes.value as Float32Array)[off + 1] = s.y;
          (velU.uStrokes.value as Float32Array)[off + 2] = s.radius;
          (velU.uStrokes.value as Float32Array)[off + 3] = s.force * ease;
          (velU.uStrokeData.value as Float32Array)[off] = s.vx;
          (velU.uStrokeData.value as Float32Array)[off + 1] = s.vy;
          (velU.uStrokeData.value as Float32Array)[off + 2] = (s.hue > 0.5 ? 1 : -1) * (0.7 + s.force * 0.45);
          (velU.uStrokeData.value as Float32Array)[off + 3] = s.hue;
          (visU.uStrokes.value as Float32Array)[off] = s.x;
          (visU.uStrokes.value as Float32Array)[off + 1] = s.y;
          (visU.uStrokes.value as Float32Array)[off + 2] = s.radius;
          (visU.uStrokes.value as Float32Array)[off + 3] = s.force * ease;
          (visU.uStrokeData.value as Float32Array)[off] = s.vx;
          (visU.uStrokeData.value as Float32Array)[off + 1] = s.vy;
          (visU.uStrokeData.value as Float32Array)[off + 2] = (s.hue > 0.5 ? 1 : -1) * (0.7 + s.force * 0.45);
          (visU.uStrokeData.value as Float32Array)[off + 3] = s.hue;
        } else {
          (velU.uStrokes.value as Float32Array).fill(0, off, off + 4);
          (velU.uStrokeData.value as Float32Array).fill(0, off, off + 4);
          (visU.uStrokes.value as Float32Array).fill(0, off, off + 4);
          (visU.uStrokeData.value as Float32Array).fill(0, off, off + 4);
        }
      }

      velU.uDelta.value = dt;
      velU.uTime.value = time;
      velU.uBass.value = bassRef.current;
      velU.uMid.value = midRef.current;
      velU.uTreble.value = trebleRef.current;
      velU.uIntensity.value = intensityRef.current;
      velU.uBeatPulse.value = beatPulseRef.current;
      velU.uGravity.value = gravityRef.current;
      velU.uStrokeCount.value = count;
      posVar.material.uniforms.uDelta.value = dt;
      posVar.material.uniforms.uGravity.value = gravityRef.current;

      gpuCompute.compute();

      mat.uniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget(posVar).texture;
      mat.uniforms.textureVelocity.value = gpuCompute.getCurrentRenderTarget(velVar).texture;
      mat.uniforms.uTime.value = time;
      mat.uniforms.uBass.value = bassRef.current;
      mat.uniforms.uMid.value = midRef.current;
      mat.uniforms.uTreble.value = trebleRef.current;
      mat.uniforms.uIntensity.value = intensityRef.current;
      mat.uniforms.uBeatPulse.value = beatPulseRef.current;
      mat.uniforms.uStrokeCount.value = count;
      mat.uniforms.uSize.value = 2.5 + trebleRef.current * 1.4 + beatPulseRef.current * 1.2;

      updateCinematicCamera(cam, time, mouseRef.current.x, mouseRef.current.y, 0.55);
      composer.render();
    };

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        for (let i = 0; i < 6; i++) {
          setTimeout(() => addStroke(0.2 + Math.random() * 0.6, 0.18 + Math.random() * 0.64, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, 0.45 + Math.random() * 0.35), i * 900);
        }
        animate();
      },
      handlePeerMessage: (msg) => {
        const m = msg as unknown as Record<string, unknown>;
        if (m.type === 'INTERACTION' && m.kind === 'SPECTRAL_MIX') {
          addStroke(m.rx as number ?? 0.5, m.ry as number ?? 0.5, m.vx as number ?? 0, m.vy as number ?? 0, m.force as number ?? 1, m.hue as number | undefined);
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
      gpuCompute.dispose();
      renderer.dispose();
    };
  }, [addStroke, onCanvasesReady, onRendererReady]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      if (strokesRef.current.length < 5) {
        addStroke(0.16 + Math.random() * 0.68, 0.15 + Math.random() * 0.7, (Math.random() - 0.5) * 0.55, (Math.random() - 0.5) * 0.55, 0.25 + Math.random() * 0.28);
      }
    }, 5200);
    return () => clearInterval(id);
  }, [isRunning, addStroke]);

  return (
    <div
      className="absolute inset-0"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        const p = pointerToCanvas(e.clientX, e.clientY);
        if (!p) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { active: true, x: p.rx, y: p.ry, t: performance.now(), hue: (dragRef.current.hue + 0.13) % 1 };
        emitStroke(p.rx, p.ry, 0, 0, 1.1, dragRef.current.hue);
      }}
      onPointerMove={(e) => {
        const p = pointerToCanvas(e.clientX, e.clientY);
        if (!p) return;
        mouseRef.current.x = (p.rx - 0.5) * 2;
        mouseRef.current.y = -(p.ry - 0.5) * 2;
        if (!dragRef.current.active) return;
        const now = performance.now();
        const dt = Math.max(16, now - dragRef.current.t);
        const dx = p.rx - dragRef.current.x;
        const dy = p.ry - dragRef.current.y;
        const speed = Math.hypot(dx, dy) / dt * 1000;
        if (speed < 0.025) return;
        const vx = dx / dt * 1000;
        const vy = dy / dt * 1000;
        const force = Math.min(1.45, 0.45 + speed * 1.25) * (0.45 + gravityRef.current * 0.75);
        dragRef.current = { active: true, x: p.rx, y: p.ry, t: now, hue: (dragRef.current.hue + 0.006 + speed * 0.012) % 1 };
        emitStroke(p.rx, p.ry, vx, vy, force, dragRef.current.hue);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        dragRef.current.active = false;
      }}
      onPointerCancel={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        dragRef.current.active = false;
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ aspectRatio: '16/9' }}
      />
      <div
        className="absolute left-6 top-6 z-20 w-72 rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-white shadow-2xl backdrop-blur-md"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-white/70">
          <span>Gravity</span>
          <span>{Math.round(gravity * 100)}%</span>
        </div>
        <input
          className="w-full accent-cyan-300"
          min="0"
          max="1"
          step="0.01"
          type="range"
          value={gravity}
          onChange={(e) => setGravity(Number(e.currentTarget.value))}
        />
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.2em] text-white/45">
          <span>Slow</span>
          <span>Strong</span>
        </div>
      </div>
    </div>
  );
}
