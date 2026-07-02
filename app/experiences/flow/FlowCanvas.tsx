'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
// FLOW — realtime MLS-MPM particle fluid (faithful WebGPU/TSL port of holtsetio/flow),
// wired into the ART.CUBE harness: audio-reactive forces, mouse-ray interaction, peer sync,
// instanced glossy shards, procedural HDR environment, dynamic spotlight + bloom MRT.

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';
import { MlsMpmSimulator } from './mlsMpmSimulator';

const {
  Fn, attribute, varying, normalLocal, transformNormalToView, vec3, vec4, float,
  mat3, normalize, cross, instanceIndex, uniform, mrt, pass, output,
} = TSL as any;

const ASPECT = 1920 / 1080;
const GRID = 64;

// Orient an instance so its long axis follows the particle's velocity direction.
const calcLookAtMatrix = Fn(([target]: any) => {
  const t = vec3(target).toVar();
  const rr = vec3(0, 0, 1.0).toVar();
  const ww = vec3(normalize(t)).toVar();
  const uu = vec3(normalize(cross(ww, rr)).negate()).toVar();
  const vv = vec3(normalize(cross(uu, ww)).negate()).toVar();
  return mat3(uu, vv, ww);
}).setLayout({
  name: 'flow_calcLookAtMatrix',
  type: 'mat3',
  inputs: [{ name: 'direction', type: 'vec3' }],
});

// Procedural equirectangular HDR-ish environment so metallic shards get real reflections
// without shipping an .hdr asset. Warm sky -> teal horizon -> deep floor + a soft sun.
function makeEnvironment(): THREE.DataTexture {
  const w = 256;
  const h = 128;
  const data = new Float32Array(w * h * 4);
  const top = new THREE.Color(0x223a5e);
  const horizon = new THREE.Color(0x0a8c8c);
  const bottom = new THREE.Color(0x05060a);
  const sun = new THREE.Color(6.0, 4.2, 3.0);
  const c = new THREE.Color();
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      if (v < 0.5) {
        c.copy(top).lerp(horizon, v / 0.5);
      } else {
        c.copy(horizon).lerp(bottom, (v - 0.5) / 0.5);
      }
      // soft warm sun near upper-left
      const du = u - 0.28;
      const dv = v - 0.32;
      const sd = Math.exp(-(du * du + dv * dv) * 60.0);
      const i = (y * w + x) * 4;
      data[i] = c.r + sun.r * sd;
      data[i + 1] = c.g + sun.g * sd;
      data[i + 2] = c.b + sun.b * sd;
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function FlowCanvas({
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
  const beatPulseRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const isStartedRef = useRef(false);

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

  // Picking helpers shared between pointer handler and peer messages.
  const simRef = useRef<MlsMpmSimulator | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pickPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.2));
  const lastSyncRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let renderer: any = null;
    let sim: MlsMpmSimulator | null = null;
    let post: any = null;
    let bloomPass: any = null;
    const sizeUniform = uniform(1.0);

    const particles = isMobile ? 16384 : 32768;
    const maxParticles = isMobile ? 65536 : 131072;

    // conf-derived constants (match the reference's density/size scaling)
    const level = Math.max(particles / 8192, 1);
    const baseSize = 1.6 / Math.pow(level, 1 / 3);
    const restDensity = 0.25 * level;

    const setup = async () => {
      renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: false });
      renderer.setPixelRatio(1);
      renderer.setSize(1920, 1080, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.7;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      await renderer.init();
      if (disposed) { renderer.dispose(); return; }

      const scene = new THREE.Scene();
      const env = makeEnvironment();
      scene.environment = env;
      scene.environmentIntensity = 0.55;
      scene.background = new THREE.Color(0x04050a);

      const camera = new THREE.PerspectiveCamera(60, ASPECT, 0.01, 5);
      camera.position.set(0, 0.5, -1);
      camera.lookAt(0, 0.5, 0.2);
      cameraRef.current = camera;

      // ---- Simulation ----
      sim = new MlsMpmSimulator(renderer);
      sim.restDensity = restDensity;
      sim.stiffness = 3.0;
      sim.dynamicViscosity = 0.1;
      await sim.init({ maxParticles, particles });
      sim.setParticleCount(particles);
      simRef.current = sim;

      // ---- Particle renderer: instanced rounded shards oriented along velocity ----
      const rounded = new RoundedBoxGeometry(0.7, 0.7, 3, 4, 0.14);
      const merged = BufferGeometryUtils.mergeVertices(rounded);
      const geometry = new THREE.InstancedBufferGeometry().copy(merged as any);
      geometry.instanceCount = particles;

      const material = new THREE.MeshStandardNodeMaterial({ metalness: 0.85, roughness: 0.5 });
      const vAo = varying(float(0), 'vAo');
      const particle = sim.particleBuffer.element(instanceIndex);
      material.positionNode = Fn(() => {
        const pos = particle.get('position');
        const density = particle.get('density');
        const dir = particle.get('direction');
        const m = calcLookAtMatrix(dir.xyz);
        vAo.assign(pos.z.div(GRID));
        vAo.assign(vAo.mul(vAo).oneMinus());
        const local = m.mul(attribute('position').xyz.mul(sizeUniform));
        return local.mul(density.mul(0.4).add(0.5).clamp(0, 1)).add(pos.mul(vec3(1, 1, 0.4)));
      })();
      material.colorNode = particle.get('color');
      material.aoNode = vAo;
      // route particle luminance into the bloom MRT target
      material.mrtNode = mrt({ bloomIntensity: float(1) });
      // keep the (unused-by-shading) view normal valid for any downstream nodes
      transformNormalToView(normalLocal);

      const particleMesh = new THREE.Mesh(geometry, material);
      particleMesh.frustumCulled = false;
      const s = 1 / GRID;
      particleMesh.position.set(-32 * s, 0, 0);
      particleMesh.scale.set(s, s, s);
      particleMesh.castShadow = true;
      particleMesh.receiveShadow = false;
      scene.add(particleMesh);

      // ---- Container: floor + back wall to ground the fluid and catch shadows ----
      const wallMat = new THREE.MeshStandardNodeMaterial({ color: 0x0c0e14, roughness: 0.85, metalness: 0.0 });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), wallMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -0.01, 0.2);
      floor.receiveShadow = true;
      scene.add(floor);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), wallMat);
      back.position.set(0, 1, 0.45);
      back.receiveShadow = true;
      scene.add(back);

      // ---- Lights ----
      const spot = new THREE.SpotLight(0xffffff, 6, 15, Math.PI * 0.2, 0.7, 0.5);
      spot.position.set(0.2, 1.4, -0.7);
      const spotTarget = new THREE.Object3D();
      spotTarget.position.set(0, 0.5, 0.15);
      spot.target = spotTarget;
      spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.bias = -0.004;
      spot.shadow.camera.near = 0.5;
      spot.shadow.camera.far = 5;
      scene.add(spot, spotTarget);
      const rim = new THREE.DirectionalLight(0x4488ff, 1.2);
      rim.position.set(-1, 0.4, -1);
      scene.add(rim);

      // ---- Post-processing: selective bloom via MRT, screen-style composite ----
      const scenePass = pass(scene, camera);
      scenePass.setMRT(mrt({ output, bloomIntensity: float(0) }));
      const outputPass = scenePass.getTextureNode();
      const bloomIntensityPass = scenePass.getTextureNode('bloomIntensity');
      bloomPass = bloom(outputPass.mul(bloomIntensityPass));
      bloomPass.threshold.value = 0.001;
      bloomPass.strength.value = 0.94;
      bloomPass.radius.value = 0.8;

      post = new THREE.PostProcessing(renderer);
      post.outputColorTransform = false;
      post.outputNode = Fn(() => {
        const a = outputPass.rgb.clamp(0, 1).toVar();
        const b = bloomPass.rgb.clamp(0, 1).mul(bloomIntensityPass.r.sign().oneMinus()).toVar();
        return vec4(
          vec3(1).sub(b).sub(b).mul(a).mul(a).add(b.mul(a).mul(2)).clamp(0, 1),
          1.0,
        );
      })().renderOutput();

      onCanvasesReady(canvas, canvas);

      // ---- Frame loop (serialized; WebGPU compute + render are async) ----
      let last = performance.now();
      const loop = async () => {
        while (!disposed) {
          await new Promise((r) => requestAnimationFrame(r));
          if (disposed || !sim) break;

          const now = performance.now();
          const interval = (now - last) / 1000;
          last = now;

          // audio -> simulation parameters
          beatPulseRef.current *= 0.9;
          const beat = beatPulseRef.current;
          const b = bassRef.current;
          const m2 = midRef.current;
          const tr = trebleRef.current;
          const inten = intensityRef.current;

          sim.noise = 1.0 + tr * 1.4;
          sim.stiffness = 3.0 + b * 2.0;
          sim.audioPulse = beat * (5.0 + b * 12.0);
          sim.swirl = m2 * 4.0 + inten * 2.0;
          sim.gravityVec.set(0, 0, 0.2 + b * 0.25);

          sizeUniform.value = baseSize * (1 + b * 0.35);
          if (bloomPass) bloomPass.strength.value = 0.94 + inten * 0.7;

          // cinematic camera: gentle azimuth orbit around the tank + mouse parallax
          const t = now / 1000;
          const az = Math.PI + Math.sin(t * 0.08) * 0.28 + mouseRef.current.x * 0.22;
          const rad = 1.15;
          const cy = 0.5 + Math.sin(t * 0.05) * 0.06 + mouseRef.current.y * 0.12;
          camera.position.set(Math.sin(az) * rad, cy, Math.cos(az) * rad + 0.2);
          camera.lookAt(0, 0.5, 0.2);

          await sim.update(interval);
          await post.renderAsync();
        }
      };

      if (isStartedRef.current) loop();
      else startLoopRef.current = loop;
    };

    const startLoopRef = { current: null as null | (() => Promise<void>) };

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        if (startLoopRef.current) {
          const l = startLoopRef.current;
          startLoopRef.current = null;
          l();
        }
      },
      handlePeerMessage: (msg) => {
        const mm = msg as unknown as Record<string, unknown>;
        if (mm.type === 'INTERACTION' && mm.kind === 'FLOW_FORCE' && simRef.current) {
          const d = (mm.data ?? {}) as Record<string, number>;
          simRef.current.setMouseRay(
            new THREE.Vector3(d.ox, d.oy, d.oz),
            new THREE.Vector3(d.dx, d.dy, d.dz),
            new THREE.Vector3(d.px, d.py, d.pz),
          );
        }
      },
    };
    onRendererReady(api);

    setup();

    return () => {
      disposed = true;
      simRef.current = null;
      try { sim?.dispose(); } catch { /* noop */ }
      try { post?.dispose?.(); } catch { /* noop */ }
      try { renderer?.dispose(); } catch { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Pointer: raycast onto the picking plane and drive the fluid force ----
  const handlePointer = useCallback((clientX: number, clientY: number) => {
    const camera = cameraRef.current;
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!camera || !sim || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    mouseRef.current.x = ndc.x;
    mouseRef.current.y = ndc.y;

    const ray = raycasterRef.current;
    ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(pickPlaneRef.current, hit)) {
      sim.setMouseRay(ray.ray.origin.clone(), ray.ray.direction.clone(), hit);
      const now = performance.now();
      if (now - lastSyncRef.current > 50) {
        lastSyncRef.current = now;
        const o = ray.ray.origin;
        const dir = ray.ray.direction;
        sendInteraction('FLOW_FORCE', {
          ox: o.x, oy: o.y, oz: o.z,
          dx: dir.x, dy: dir.y, dz: dir.z,
          px: hit.x, py: hit.y, pz: hit.z,
        });
      }
    }
  }, [sendInteraction]);

  return (
    <div
      className="absolute inset-0"
      onMouseMove={(e) => handlePointer(e.clientX, e.clientY)}
      onTouchStart={(e) => handlePointer(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handlePointer(e.touches[0].clientX, e.touches[0].clientY)}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ aspectRatio: '16/9' }}
      />
    </div>
  );
}
