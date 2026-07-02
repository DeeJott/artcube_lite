'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { createPostProcessing } from '../../lib/three/postProcessing';
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

const ASPECT = 1920 / 1080;
const TEX_SIZE = 32;
const NODE_COUNT = TEX_SIZE * TEX_SIZE; // 1024
const MAX_LINES = 3000;
const CONNECT_DIST = 0.18;

const THEMES: [number, number, number][] = [
  [0.0,  1.0,  0.75],  // teal
  [1.0,  0.75, 0.0],   // gold
  [0.55, 0.0,  1.0],   // violet
  [0.0,  0.85, 1.0],   // cyan
  [1.0,  0.4,  0.0],   // amber
  [0.4,  1.0,  0.0],   // lime
];

function makeGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0,    'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grad.addColorStop(0.7,  'rgba(255,255,255,0.08)');
  grad.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

interface SpawnRequest {
  x: number; y: number; vx: number; vy: number;
  r: number; g: number; b: number;
}

const VEL_SHADER = /* glsl */`
  uniform float uDelta;
  uniform sampler2D uSpawnTex;
  uniform sampler2D uSpawnTex2;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 vel = texture2D(textureVelocity, uv);
    vec4 spawn = texture2D(uSpawnTex, uv);
    vec4 spawn2 = texture2D(uSpawnTex2, uv);
    if (spawn.r > 0.5) {
      gl_FragColor = vec4(spawn.a, spawn2.r, 0.0, 0.0);
    } else {
      gl_FragColor = vec4(vel.xy * 0.9985, 0.0, 0.0);
    }
  }
`;

const POS_SHADER = /* glsl */`
  uniform float uDelta;
  uniform sampler2D uSpawnTex;
  uniform float uSpawnMaxAge;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);
    vec4 spawn = texture2D(uSpawnTex, uv);
    if (spawn.r > 0.5) {
      gl_FragColor = vec4(spawn.g, spawn.b, 0.0, uSpawnMaxAge);
    } else {
      gl_FragColor = vec4(pos.xy + vel.xy, pos.z + uDelta, pos.w);
    }
  }
`;

const COL_SHADER = /* glsl */`
  uniform sampler2D uSpawnTex;
  uniform sampler2D uSpawnTex2;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 col = texture2D(textureColor, uv);
    vec4 pos = texture2D(texturePosition, uv);
    vec4 spawn = texture2D(uSpawnTex, uv);
    vec4 spawn2 = texture2D(uSpawnTex2, uv);
    if (spawn.r > 0.5) {
      gl_FragColor = vec4(spawn2.g, spawn2.b, spawn2.a, 1.0);
    } else if (pos.z > pos.w) {
      gl_FragColor = vec4(col.rgb, 0.0);
    } else {
      gl_FragColor = col;
    }
  }
`;

const VERT_SHADER = /* glsl */`
  uniform sampler2D texturePosition;
  uniform sampler2D textureColor;
  uniform float uPulse;
  uniform float uAudio;
  uniform float uTrebleBright;
  uniform float uSize;
  uniform float uCoreMult;
  attribute vec2 ref;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 pos = texture2D(texturePosition, ref);
    vec4 col = texture2D(textureColor, ref);
    if (col.a < 0.5) {
      vAlpha = 0.0;
      gl_Position = vec4(0.0, 0.0, -10.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    float lf = pos.z / pos.w;
    float fade = lf < 0.08 ? lf / 0.08 : lf > 0.82 ? (1.0 - lf) / 0.18 : 1.0;
    float bright = fade * uPulse * uAudio * uCoreMult;
    vColor = min(vec3(1.0), col.rgb * bright);
    vAlpha = fade;
    float z = (lf - 0.5) * 0.1;
    vec4 mvPosition = modelViewMatrix * vec4(pos.xy, z, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * (1.0 / -mvPosition.z);
  }
`;

const FRAG_SHADER = /* glsl */`
  uniform sampler2D uGlow;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 glow = texture2D(uGlow, gl_PointCoord);
    gl_FragColor = vec4(vColor, vAlpha) * glow;
  }
`;

export function MyceliumCanvas({
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
  const spawnQueueRef = useRef<SpawnRequest[]>([]);
  const intensityRef = useRef(0);
  const bassRef = useRef(0);
  const midRef = useRef(0);
  const trebleRef = useRef(0);
  const prevBeatRef = useRef(0);
  const beatPulseRef = useRef(0);
  const isStartedRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { bassRef.current = bass; }, [bass]);
  useEffect(() => { midRef.current = mid; }, [mid]);
  useEffect(() => { trebleRef.current = treble; }, [treble]);

  useEffect(() => {
    if (lastBeatTime && lastBeatTime !== prevBeatRef.current) {
      prevBeatRef.current = lastBeatTime;
      beatPulseRef.current = 1.0;
    }
  }, [lastBeatTime]);

  const spawnCluster = useCallback((nx: number, ny: number, count = 10) => {
    const wx = (nx - 0.5) * ASPECT;
    const wy = 0.5 - ny;
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const [tr, tg, tb] = theme;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.8;
      const speed = 0.0015 + Math.random() * 0.004;
      spawnQueueRef.current.push({
        x: wx + (Math.random() - 0.5) * 0.06,
        y: wy + (Math.random() - 0.5) * 0.06,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: tr * (0.7 + Math.random() * 0.3),
        g: tg * (0.7 + Math.random() * 0.3),
        b: tb * (0.7 + Math.random() * 0.3),
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(1920, 1080, false);
    renderer.setClearColor(0x010103, 1);

    const cam = createCinematicCamera(ASPECT);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x010103, 0.3);

    const composer = createPostProcessing(renderer, scene, cam, {
      bloomStrength: 1.0,
      bloomRadius: 0.5,
      bloomThreshold: 0.1,
      filmIntensity: 0.08,
    });

    const glowTex = makeGlowTexture();

    // --- GPU Computation ---
    const gpuCompute = new GPUComputationRenderer(TEX_SIZE, TEX_SIZE, renderer);

    const posTex0 = gpuCompute.createTexture();
    const velTex0 = gpuCompute.createTexture();
    const colTex0 = gpuCompute.createTexture();

    const posArr = posTex0.image.data as unknown as Float32Array;
    const velArr = velTex0.image.data as unknown as Float32Array;
    const colArr = colTex0.image.data as unknown as Float32Array;
    for (let i = 0; i < NODE_COUNT; i++) {
      const idx = i * 4;
      posArr[idx] = 0; posArr[idx + 1] = 0; posArr[idx + 2] = -1; posArr[idx + 3] = 1;
      velArr[idx] = 0; velArr[idx + 1] = 0; velArr[idx + 2] = 0; velArr[idx + 3] = 0;
      colArr[idx] = 0; colArr[idx + 1] = 0; colArr[idx + 2] = 0; colArr[idx + 3] = 0;
    }

    const posVar = gpuCompute.addVariable('texturePosition', POS_SHADER, posTex0);
    const velVar = gpuCompute.addVariable('textureVelocity', VEL_SHADER, velTex0);
    const colVar = gpuCompute.addVariable('textureColor', COL_SHADER, colTex0);

    gpuCompute.setVariableDependencies(posVar, [posVar, velVar]);
    gpuCompute.setVariableDependencies(velVar, [velVar]);
    gpuCompute.setVariableDependencies(colVar, [colVar, posVar]);

    // Spawn DataTextures (CPU writes spawn requests here)
    const spawnTexArr = new Float32Array(NODE_COUNT * 4);
    const spawnTex2Arr = new Float32Array(NODE_COUNT * 4);
    const spawnTex = new THREE.DataTexture(spawnTexArr, TEX_SIZE, TEX_SIZE, THREE.RGBAFormat, THREE.FloatType);
    const spawnTex2 = new THREE.DataTexture(spawnTex2Arr, TEX_SIZE, TEX_SIZE, THREE.RGBAFormat, THREE.FloatType);

    posVar.material.uniforms.uDelta = { value: 16.67 };
    posVar.material.uniforms.uSpawnTex = { value: spawnTex };
    posVar.material.uniforms.uSpawnMaxAge = { value: 13000 };
    velVar.material.uniforms.uDelta = { value: 16.67 };
    velVar.material.uniforms.uSpawnTex = { value: spawnTex };
    velVar.material.uniforms.uSpawnTex2 = { value: spawnTex2 };
    colVar.material.uniforms.uSpawnTex = { value: spawnTex };
    colVar.material.uniforms.uSpawnTex2 = { value: spawnTex2 };

    const initError = gpuCompute.init();
    if (initError) console.error('GPUComputationRenderer init error:', initError);

    // --- Visualization ---
    const refs = new Float32Array(NODE_COUNT * 2);
    for (let i = 0; i < NODE_COUNT; i++) {
      refs[i * 2] = (i % TEX_SIZE + 0.5) / TEX_SIZE;
      refs[i * 2 + 1] = (Math.floor(i / TEX_SIZE) + 0.5) / TEX_SIZE;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NODE_COUNT * 3), 3));
    geo.setAttribute('ref', new THREE.BufferAttribute(refs, 2));

    const makePointsMat = (size: number, coreMult: number) => new THREE.ShaderMaterial({
      uniforms: {
        texturePosition: { value: null },
        textureColor: { value: null },
        uPulse: { value: 1.0 },
        uAudio: { value: 1.0 },
        uTrebleBright: { value: 1.0 },
        uSize: { value: size },
        uCoreMult: { value: coreMult },
        uGlow: { value: glowTex },
      },
      vertexShader: VERT_SHADER,
      fragmentShader: FRAG_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glowMat = makePointsMat(4.0, 1.0);
    const coreMat = makePointsMat(1.5, 2.5);
    scene.add(new THREE.Points(geo, glowMat));
    scene.add(new THREE.Points(geo, coreMat));

    // Line buffer for connections
    const linePos = new Float32Array(MAX_LINES * 6);
    const lineCol = new Float32Array(MAX_LINES * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
    const lineSeg = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(lineSeg);

    onCanvasesReady(canvas, canvas);

    // Readback buffers
    const posReadback = new Float32Array(NODE_COUNT * 4);
    const colReadback = new Float32Array(NODE_COUNT * 4);
    let firstFrame = true;

    let rafId = 0;
    let lastTime = performance.now();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(now - lastTime, 32);
      lastTime = now;

      beatPulseRef.current *= 0.90;
      const pulse = 1.0 + beatPulseRef.current * 0.7 + bassRef.current * 0.3;
      const audio = 1.0 + intensityRef.current * 0.4;
      const midBright = 1.0 + midRef.current * 0.5;
      const trebleBright = 1.0 + trebleRef.current * 0.8;

      // Process spawn queue using dead particles from previous frame readback
      if (spawnQueueRef.current.length > 0 && !firstFrame) {
        spawnTexArr.fill(0);
        spawnTex2Arr.fill(0);
        let spawnIdx = 0;
        const queue = spawnQueueRef.current;
        for (let i = 0; i < NODE_COUNT && spawnIdx < queue.length; i++) {
          if (colReadback[i * 4 + 3] < 0.5) {
            const s = queue[spawnIdx];
            const off = i * 4;
            spawnTexArr[off] = 1;
            spawnTexArr[off + 1] = s.x;
            spawnTexArr[off + 2] = s.y;
            spawnTexArr[off + 3] = s.vx;
            spawnTex2Arr[off] = s.vy;
            spawnTex2Arr[off + 1] = s.r;
            spawnTex2Arr[off + 2] = s.g;
            spawnTex2Arr[off + 3] = s.b;
            spawnIdx++;
          }
        }
        spawnQueueRef.current = queue.slice(spawnIdx);
        if (spawnIdx > 0) {
          spawnTex.needsUpdate = true;
          spawnTex2.needsUpdate = true;
        }
      }

      posVar.material.uniforms.uDelta.value = dt;
      velVar.material.uniforms.uDelta.value = dt;

      gpuCompute.compute();

      // Read back for connection computation
      const posRT = gpuCompute.getCurrentRenderTarget(posVar);
      const colRT = gpuCompute.getCurrentRenderTarget(colVar);
      renderer.readRenderTargetPixels(posRT, 0, 0, TEX_SIZE, TEX_SIZE, posReadback);
      renderer.readRenderTargetPixels(colRT, 0, 0, TEX_SIZE, TEX_SIZE, colReadback);
      firstFrame = false;

      // Build connections on CPU
      let lCount = 0;
      const cd2 = CONNECT_DIST * CONNECT_DIST;
      const activeIdx: number[] = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        if (colReadback[i * 4 + 3] > 0.5) activeIdx.push(i);
      }
      for (let i = 0; i < activeIdx.length && lCount < MAX_LINES; i++) {
        for (let j = i + 1; j < activeIdx.length && lCount < MAX_LINES; j++) {
          const ai = activeIdx[i] * 4;
          const aj = activeIdx[j] * 4;
          const dx = posReadback[ai] - posReadback[aj];
          const dy = posReadback[ai + 1] - posReadback[aj + 1];
          if (dx * dx + dy * dy < cd2) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            const str = (1 - dist / CONNECT_DIST) * 0.45 * pulse * midBright;
            const li = lCount * 6;
            linePos[li] = posReadback[ai]; linePos[li + 1] = posReadback[ai + 1]; linePos[li + 2] = 0;
            linePos[li + 3] = posReadback[aj]; linePos[li + 4] = posReadback[aj + 1]; linePos[li + 5] = 0;
            const mr = (colReadback[ai] + colReadback[aj]) * 0.5 * str;
            const mg = (colReadback[ai + 1] + colReadback[aj + 1]) * 0.5 * str;
            const mb = (colReadback[ai + 2] + colReadback[aj + 2]) * 0.5 * str;
            lineCol[li] = mr; lineCol[li + 1] = mg; lineCol[li + 2] = mb;
            lineCol[li + 3] = mr; lineCol[li + 4] = mg; lineCol[li + 5] = mb;
            lCount++;
          }
        }
      }
      lineGeo.setDrawRange(0, lCount * 2);
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;

      // Update visualization uniforms
      const posTexture = posRT.texture;
      const colTexture = colRT.texture;
      for (const m of [glowMat, coreMat]) {
        m.uniforms.texturePosition.value = posTexture;
        m.uniforms.textureColor.value = colTexture;
        m.uniforms.uPulse.value = pulse;
        m.uniforms.uAudio.value = audio;
        m.uniforms.uTrebleBright.value = trebleBright;
      }

      updateCinematicCamera(cam, now / 1000, mouseRef.current.x, mouseRef.current.y);
      composer.render();
    };

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        for (let i = 0; i < 6; i++) {
          setTimeout(() => spawnCluster(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7, 6), i * 900);
        }
        animate();
      },
      handlePeerMessage: (msg) => {
        const m = msg as unknown as Record<string, unknown>;
        if (m.type === 'INTERACTION' && m.kind === 'MYCELIUM_TOUCH') {
          spawnCluster(m.rx as number ?? 0.5, m.ry as number ?? 0.5);
        }
      },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      composer.dispose();
      geo.dispose();
      glowMat.dispose();
      coreMat.dispose();
      glowTex.dispose();
      spawnTex.dispose();
      spawnTex2.dispose();
      gpuCompute.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambient cluster spawning
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      if (spawnQueueRef.current.length < 60) {
        spawnCluster(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7, 6);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [isRunning, spawnCluster]);

  const handlePointer = useCallback((clientX: number, clientY: number) => {
    if (!isStartedRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    spawnCluster(rx, ry);
    sendInteraction('MYCELIUM_TOUCH', { rx, ry });
  }, [spawnCluster, sendInteraction]);

  return (
    <div
      className="absolute inset-0"
      onClick={(e) => handlePointer(e.clientX, e.clientY)}
      onTouchStart={(e) => handlePointer(e.touches[0].clientX, e.touches[0].clientY)}
      onMouseMove={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        mouseRef.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        mouseRef.current.y = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ aspectRatio: '16/9' }}
      />
    </div>
  );
}
