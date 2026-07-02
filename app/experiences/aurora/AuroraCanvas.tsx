'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { createPostProcessing } from '../../lib/three/postProcessing';
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

const ASPECT = 1920 / 1080;

const VERT = /* glsl */`
  uniform float uTime;
  uniform float uAmp;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.y += sin(p.x * 2.8 + uTime) * uAmp;
    p.y += cos(p.x * 5.1 - uTime * 0.73) * uAmp * 0.45;
    p.y += sin(p.x * 1.3 + uTime * 1.4) * uAmp * 0.2;
    p.z += sin(p.x * 2.0 + uTime * 0.5) * 0.03;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float edge = sin(vUv.x * 3.14159);
    float fade = 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 1.6);
    float shimmer = 0.8 + 0.2 * sin(vUv.x * 40.0 + vUv.y * 20.0);
    float alpha = edge * fade * uOpacity * shimmer;
    vec3 col = mix(uColorA, uColorB, vUv.x + sin(vUv.y * 9.42) * 0.18);
    gl_FragColor = vec4(col, clamp(alpha * 0.75, 0.0, 1.0));
  }
`;

const PALETTES: [number, number][] = [
  [0x00ff99, 0x0099ff],
  [0x7700ff, 0xff0077],
  [0x00ffff, 0x0022ff],
  [0x99ff00, 0x00ffcc],
  [0xff6600, 0xffcc00],
  [0xff00cc, 0x6600ff],
];

interface Ribbon {
  uniforms: { uTime: THREE.IUniform; uAmp: THREE.IUniform; uOpacity: THREE.IUniform; uColorA: THREE.IUniform; uColorB: THREE.IUniform };
  speed: number;
  decay: number;
}

export function AuroraCanvas({
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
  const sceneRef = useRef(new THREE.Scene());
  const ribbonsRef = useRef<Ribbon[]>([]);
  const intensityRef = useRef(0);
  const bassRef = useRef(0);
  const midRef = useRef(0);
  const trebleRef = useRef(0);
  const prevBeatRef = useRef(0);
  const isStartedRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { bassRef.current = bass; }, [bass]);
  useEffect(() => { midRef.current = mid; }, [mid]);
  useEffect(() => { trebleRef.current = treble; }, [treble]);

  useEffect(() => {
    if (lastBeatTime && lastBeatTime !== prevBeatRef.current) {
      prevBeatRef.current = lastBeatTime;
      ribbonsRef.current.forEach(r => {
        r.uniforms.uAmp.value = Math.min(0.38, r.uniforms.uAmp.value + 0.11);
      });
    }
  }, [lastBeatTime]);

  const addRibbon = useCallback((yNorm: number) => {
    const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    const height = 0.10 + Math.random() * 0.10;
    const geo = new THREE.PlaneGeometry(ASPECT, height, 160, 6);
    const uniforms = {
      uTime: { value: 0 } as THREE.IUniform,
      uAmp: { value: 0.09 + Math.random() * 0.06 } as THREE.IUniform,
      uOpacity: { value: 0 } as THREE.IUniform,
      uColorA: { value: new THREE.Color(pal[0]) } as THREE.IUniform,
      uColorB: { value: new THREE.Color(pal[1]) } as THREE.IUniform,
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, (0.5 - yNorm), Math.random() * 0.08 - 0.04);
    sceneRef.current.add(mesh);
    const ribbon: Ribbon = { uniforms, speed: 0.22 + Math.random() * 0.45, decay: 0.00035 + Math.random() * 0.0003 };
    ribbonsRef.current.push(ribbon);
    const lifetime = 11000 + Math.random() * 7000;
    setTimeout(() => {
      sceneRef.current.remove(mesh);
      geo.dispose();
      mat.dispose();
      ribbonsRef.current = ribbonsRef.current.filter(r => r !== ribbon);
    }, lifetime);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => addRibbon(0.18 + Math.random() * 0.64), 2800);
    return () => clearInterval(id);
  }, [isRunning, addRibbon]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(1920, 1080, false);
    renderer.setClearColor(0x010407, 1);

    const cam = createCinematicCamera(ASPECT);
    sceneRef.current.fog = new THREE.FogExp2(0x010407, 0.35);

    const composer = createPostProcessing(renderer, sceneRef.current, cam, {
      bloomStrength: 1.5,
      bloomRadius: 0.7,
      bloomThreshold: 0.05,
      filmIntensity: 0.1,
      chromaticAberration: true,
    });

    // Starfield
    const starCount = 700;
    const starPos = new Float32Array(starCount * 3);
    const starAlpha = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3]     = (Math.random() - 0.5) * ASPECT;
      starPos[i * 3 + 1] = (Math.random() - 0.5);
      starPos[i * 3 + 2] = -0.3;
      starAlpha[i] = 0.2 + Math.random() * 0.6;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.002, transparent: true, opacity: 0.45, depthWrite: false });
    sceneRef.current.add(new THREE.Points(starGeo, starMat));

    // Horizon glow
    const gradGeo = new THREE.PlaneGeometry(ASPECT, 0.25);
    const gradMat = new THREE.MeshBasicMaterial({ color: 0x001a0a, transparent: true, opacity: 0.6 });
    const gradMesh = new THREE.Mesh(gradGeo, gradMat);
    gradMesh.position.set(0, -0.38, -0.1);
    sceneRef.current.add(gradMesh);

    onCanvasesReady(canvas, canvas);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = performance.now() / 1000;
      ribbonsRef.current.forEach(r => {
        r.uniforms.uTime.value = t * r.speed * (1.0 + midRef.current * 0.5);
        if (r.uniforms.uOpacity.value < 0.95) r.uniforms.uOpacity.value += 0.003;
        r.uniforms.uAmp.value = Math.max(0.04, r.uniforms.uAmp.value - r.decay);
        r.uniforms.uAmp.value += intensityRef.current * 0.0015 + bassRef.current * 0.008;
      });
      updateCinematicCamera(cam, t, mouseRef.current.x, mouseRef.current.y);
      composer.render();
    };

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        addRibbon(0.3); addRibbon(0.48); addRibbon(0.62);
        animate();
      },
      handlePeerMessage: (msg) => {
        const m = msg as unknown as Record<string, unknown>;
        if (m.type === 'INTERACTION' && m.kind === 'AURORA_TOUCH' && typeof m.ry === 'number') {
          addRibbon(m.ry);
        }
      },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      composer.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointer = useCallback((clientX: number, clientY: number) => {
    if (!isStartedRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ry = (clientY - rect.top) / rect.height;
    addRibbon(ry);
    sendInteraction('AURORA_TOUCH', { ry });
  }, [addRibbon, sendInteraction]);

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
