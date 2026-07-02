'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { createPostProcessing } from '../../lib/three/postProcessing';
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

const ASPECT = 1920 / 1080;
const MAX_CRYSTALS = 60;
const MAX_BEAMS = 200;

interface Crystal {
  x: number;
  y: number;
  z: number;
  size: number;
  targetSize: number;
  rotation: number;
  rotSpeed: number;
  sides: number;
  color: THREE.Color;
  born: number;
  life: number;
  maxLife: number;
  pulsePhase: number;
}

const CRYSTAL_COLORS = [
  0x00ffff, 0xff00ff, 0x00ff88, 0xff8800,
  0x8844ff, 0xff4466, 0x44ffaa, 0xffee44,
];

function makeCrystalTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export function CrystalCanvas({
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
  const crystalsRef = useRef<Crystal[]>([]);
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

  const spawnCrystal = useCallback((nx: number, ny: number) => {
    const wx = (nx - 0.5) * ASPECT;
    const wy = 0.5 - ny;
    const colorHex = CRYSTAL_COLORS[Math.floor(Math.random() * CRYSTAL_COLORS.length)];
    const sides = 6;
    crystalsRef.current.push({
      x: wx,
      y: wy,
      z: (Math.random() - 0.5) * 0.3,
      size: 0,
      targetSize: 0.04 + Math.random() * 0.06,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.003,
      sides,
      color: new THREE.Color(colorHex),
      born: performance.now(),
      life: 0,
      maxLife: 15000 + Math.random() * 10000,
      pulsePhase: Math.random() * Math.PI * 2,
    });
    if (crystalsRef.current.length > MAX_CRYSTALS) {
      crystalsRef.current = crystalsRef.current.slice(-MAX_CRYSTALS);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(1920, 1080, false);
    renderer.setClearColor(0x05010a, 1);

    const cam = createCinematicCamera(ASPECT);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05010a, 0.3);

    const composer = createPostProcessing(renderer, scene, cam, {
      bloomStrength: 1.4,
      bloomRadius: 0.7,
      bloomThreshold: 0.06,
      filmIntensity: 0.1,
      chromaticAberration: true,
    });

    const glowTex = makeCrystalTexture();

    // Crystal meshes group
    const crystalGroup = new THREE.Group();
    scene.add(crystalGroup);

    // Glow sprite buffer (halo around each crystal)
    const glowPos = new Float32Array(MAX_CRYSTALS * 3);
    const glowCol = new Float32Array(MAX_CRYSTALS * 3);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
    glowGeo.setAttribute('color', new THREE.BufferAttribute(glowCol, 3));
    const glowMat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: glowTex,
      sizeAttenuation: true,
    });
    scene.add(new THREE.Points(glowGeo, glowMat));

    // Beam buffer (lines between nearby crystals)
    const beamPos = new Float32Array(MAX_BEAMS * 6);
    const beamCol = new Float32Array(MAX_BEAMS * 6);
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPos, 3));
    beamGeo.setAttribute('color', new THREE.BufferAttribute(beamCol, 3));
    const beamSeg = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    scene.add(beamSeg);

    // Ambient starfield
    const starCount = 400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * ASPECT;
      starPos[i * 3 + 1] = (Math.random() - 0.5);
      starPos[i * 3 + 2] = -0.5;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xaaaaff, size: 0.003, transparent: true, opacity: 0.3, depthWrite: false });
    scene.add(new THREE.Points(starGeo, starMat));

    onCanvasesReady(canvas, canvas);

    let rafId = 0;
    let lastTime = performance.now();

    // Track crystal meshes for disposal
    const meshMap = new Map<Crystal, { mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial }>();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(now - lastTime, 32);
      lastTime = now;

      beatPulseRef.current *= 0.90;
      const pulse = 1.0 + beatPulseRef.current * 0.6 + bassRef.current * 0.2;
      const audio = 1.0 + intensityRef.current * 0.3;
      const midBright = 1.0 + midRef.current * 0.6;
      const trebleSpark = 1.0 + trebleRef.current * 0.4;

      // Update crystals
      for (const c of crystalsRef.current) {
        c.life += dt;
        c.rotation += c.rotSpeed * dt;
        // Grow towards target size
        c.size += (c.targetSize - c.size) * 0.02;
        c.pulsePhase += dt * 0.003;
      }
      const before = crystalsRef.current.length;
      crystalsRef.current = crystalsRef.current.filter(c => c.life < c.maxLife);

      // Remove meshes for dead crystals
      for (const [crystal, entry] of meshMap) {
        if (!crystalsRef.current.includes(crystal)) {
          crystalGroup.remove(entry.mesh);
          entry.geo.dispose();
          entry.mat.dispose();
          meshMap.delete(crystal);
        }
      }

      // Create/update meshes for crystals
      let glowIdx = 0;
      for (const c of crystalsRef.current) {
        if (!meshMap.has(c)) {
          const geo = new THREE.BufferGeometry();
          const mat = new THREE.MeshBasicMaterial({
            color: c.color,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            wireframe: false,
          });
          const mesh = new THREE.Mesh(geo, mat);
          crystalGroup.add(mesh);
          meshMap.set(c, { mesh, geo, mat });
        }

        const entry = meshMap.get(c)!;
        const lifeRatio = c.life / c.maxLife;
        const fade = lifeRatio < 0.1 ? lifeRatio / 0.1 : lifeRatio > 0.85 ? (1 - lifeRatio) / 0.15 : 1;
        const pulseScale = 1 + Math.sin(c.pulsePhase) * 0.08 + (beatPulseRef.current * 0.15) + bassRef.current * 0.1;
        const size = c.size * pulseScale * fade * audio;

        // Build polygon geometry
        const verts: number[] = [];
        const indices: number[] = [];
        for (let i = 0; i <= c.sides; i++) {
          const angle = (i / c.sides) * Math.PI * 2 + c.rotation;
          const r = i === 0 ? 0 : size;
          verts.push(Math.cos(angle) * r, Math.sin(angle) * r, 0);
        }
        for (let i = 1; i <= c.sides; i++) {
          indices.push(0, i, i === c.sides ? 1 : i + 1);
        }
        entry.geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        entry.geo.setIndex(indices);
        entry.mat.opacity = 0.6 * fade;
        entry.mesh.position.set(c.x, c.y, c.z);

        // Fill glow buffer
        if (glowIdx < MAX_CRYSTALS) {
          glowPos[glowIdx * 3] = c.x;
          glowPos[glowIdx * 3 + 1] = c.y;
          glowPos[glowIdx * 3 + 2] = c.z;
          const glowBright = fade * pulse * audio * trebleSpark;
          glowCol[glowIdx * 3] = c.color.r * glowBright;
          glowCol[glowIdx * 3 + 1] = c.color.g * glowBright;
          glowCol[glowIdx * 3 + 2] = c.color.b * glowBright;
          glowIdx++;
        }
      }
      glowGeo.setDrawRange(0, glowIdx);
      glowGeo.attributes.position.needsUpdate = true;
      glowGeo.attributes.color.needsUpdate = true;

      // Build beams between nearby crystals
      let beamCount = 0;
      const maxDist = 0.35;
      const maxDist2 = maxDist * maxDist;
      const crystals = crystalsRef.current;
      for (let i = 0; i < crystals.length && beamCount < MAX_BEAMS; i++) {
        for (let j = i + 1; j < crystals.length && beamCount < MAX_BEAMS; j++) {
          const dx = crystals[i].x - crystals[j].x;
          const dy = crystals[i].y - crystals[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxDist2) {
            const dist = Math.sqrt(d2);
            const str = (1 - dist / maxDist) * 0.5 * pulse * audio * midBright;
            const li = beamCount * 6;
            beamPos[li] = crystals[i].x; beamPos[li + 1] = crystals[i].y; beamPos[li + 2] = crystals[i].z;
            beamPos[li + 3] = crystals[j].x; beamPos[li + 4] = crystals[j].y; beamPos[li + 5] = crystals[j].z;
            const mr = (crystals[i].color.r + crystals[j].color.r) * 0.5 * str;
            const mg = (crystals[i].color.g + crystals[j].color.g) * 0.5 * str;
            const mb = (crystals[i].color.b + crystals[j].color.b) * 0.5 * str;
            beamCol[li] = mr; beamCol[li + 1] = mg; beamCol[li + 2] = mb;
            beamCol[li + 3] = mr; beamCol[li + 4] = mg; beamCol[li + 5] = mb;
            beamCount++;
          }
        }
      }
      beamGeo.setDrawRange(0, beamCount * 2);
      beamGeo.attributes.position.needsUpdate = true;
      beamGeo.attributes.color.needsUpdate = true;

      updateCinematicCamera(cam, now / 1000, mouseRef.current.x, mouseRef.current.y);
      composer.render();
    };

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        // Seed ambient crystals
        for (let i = 0; i < 5; i++) {
          setTimeout(() => spawnCrystal(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7), i * 800);
        }
        animate();
      },
      handlePeerMessage: (msg) => {
        const m = msg as unknown as Record<string, unknown>;
        if (m.type === 'INTERACTION' && m.kind === 'CRYSTAL_GROW') {
          spawnCrystal(m.rx as number ?? 0.5, m.ry as number ?? 0.5);
        }
      },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      composer.dispose();
      for (const [, entry] of meshMap) {
        entry.geo.dispose();
        entry.mat.dispose();
      }
      glowTex.dispose();
      starGeo.dispose();
      starMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      beamGeo.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambient crystal spawning
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      if (crystalsRef.current.length < 8) {
        spawnCrystal(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [isRunning, spawnCrystal]);

  const handlePointer = useCallback((clientX: number, clientY: number) => {
    if (!isStartedRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    spawnCrystal(rx, ry);
    sendInteraction('CRYSTAL_GROW', { rx, ry });
  }, [spawnCrystal, sendInteraction]);

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
