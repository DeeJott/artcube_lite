'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
// BERLIN PARTICLES — Fluid-driven particle skyline of Berlin landmarks.
// Particles form the TV Tower, Brandenburg Gate, Berlin Cathedral, Reichstag, etc.
// Audio beats scatter particles; they spring back to their skyline positions.
// Pointer strokes paint fluid flow that ripples through the city.

import { useRef, useEffect } from 'react';
import {
  ACESFilmicToneMapping,
  Color,
  Matrix3,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { attachPointerSplats, DensityTintOverlayPass, FluidSimulation } from 'three-fluid-fx';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';
import { createFlowParticles } from '../particles2d/flowParticles';
import { generateBerlinSkyline, worldToFluid, BUILDING_X } from './berlinSkyline';

const ASPECT = 1920 / 1080;
const PARTICLE_SIZE = 160;

const DEFAULTS = {
  splatRadius: 10,
  splatForce: 6,
  pressureIterations: 8,
  curlStrength: 0.2,
  velocityDissipation: 0.99,
  densityDissipation: 0.85,
  pressureDissipation: 0.8,
  enableVorticity: false,
  bfecc: true,
  reflectWalls: true,
  flowStrength: 1.5,
  flowThreshold: 40,
  maxFlowSpeed: 20,
  responseGamma: 4,
  depthAttenuationScale: 1,
  spring: 6.0,
  zeta: 1.0,
  dragLin: 0.25,
  dragQuad: 0.04,
  aMax: 24,
  vMaxScale: 1,
  pointSize: 5,
  rotationSpeed: 0.0,
};

const SCALE = {
  splatRadius: 1e-4,
  flowThreshold: 1e-3,
} as const;

export function BerlinParticlesCanvas({
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
  const intensityRef = useRef(0);
  const bassRef = useRef(0);
  const midRef = useRef(0);
  const trebleRef = useRef(0);
  const prevBeatRef = useRef(0);
  const beatPulseRef = useRef(0);
  const isStartedRef = useRef(false);
  const fluidRef = useRef<FluidSimulation | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(new Color('#080812'), 1);
    renderer.setSize(1920, 1080, false);

    const scene = new Scene();
    const camera = new PerspectiveCamera(45, ASPECT, 0.1, 100);
    camera.position.set(0, 0, 5.2);
    const cameraRight = new Vector3();
    const cameraUp = new Vector3();

    // — fluid simulation —
    const fluid = new FluidSimulation(renderer as any, {
      profile: 'balanced',
      splatRadius: DEFAULTS.splatRadius * SCALE.splatRadius,
      splatForce: DEFAULTS.splatForce,
      pressureIterations: DEFAULTS.pressureIterations,
      curlStrength: DEFAULTS.curlStrength,
      velocityDissipation: DEFAULTS.velocityDissipation,
      densityDissipation: DEFAULTS.densityDissipation,
      pressureDissipation: DEFAULTS.pressureDissipation,
      enableVorticity: DEFAULTS.enableVorticity,
      bfecc: DEFAULTS.bfecc,
      reflectWalls: DEFAULTS.reflectWalls,
    });
    fluidRef.current = fluid;

    // — particles forming Berlin skyline —
    const destinations = generateBerlinSkyline(PARTICLE_SIZE * PARTICLE_SIZE);
    const particles = createFlowParticles(renderer, {
      mode: 'plane2d',
      size: PARTICLE_SIZE,
      customDestinations: destinations,
    });
    scene.add(particles.points);

    // — pointer splats —
    const detachPointerSplats = attachPointerSplats(renderer.domElement as any, fluid as any);

    // — EffectComposer pipeline —
    const tint = new DensityTintOverlayPass(fluid as any);
    const composer = new EffectComposer(renderer);
    composer.setSize(1920, 1080);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new Vector3(1920, 1080) as any,
      0.8,
      0.6,
      0.1,
    );
    composer.addPass(bloomPass);
    composer.addPass(tint as any);
    composer.addPass(new OutputPass());

    const modelRotation = new Matrix3();
    let lastTime = performance.now();
    let rafId = 0;
    let beatIdx = 0;

    const syncFluidParams = () => {
      const p = DEFAULTS;
      fluid.splatRadius = p.splatRadius * SCALE.splatRadius;
      fluid.splatForce = p.splatForce;
      fluid.pressureIterations = p.pressureIterations;
      fluid.curlStrength = p.curlStrength;
      fluid.velocityDissipation = p.velocityDissipation;
      fluid.densityDissipation = p.densityDissipation;
      fluid.pressureDissipation = p.pressureDissipation;
      fluid.enableVorticity = p.enableVorticity;
      fluid.bfecc = p.bfecc;
      fluid.reflectWalls = p.reflectWalls;
    };

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(Math.max((now - lastTime) / 1000, 1e-6), 1 / 30);
      const fluidDt = Math.min(dt, 1 / 60);
      lastTime = now;

      beatPulseRef.current *= 0.9;
      const bV = bassRef.current + beatPulseRef.current * 0.4;
      const mV = midRef.current;
      const trV = trebleRef.current;
      const intenV = intensityRef.current;

      // Beat: splat at a building position — scatters particles from that landmark
      if (beatPulseRef.current > 0.85) {
        const bx = BUILDING_X[beatIdx % BUILDING_X.length];
        beatIdx++;
        const by = -1.0 + Math.random() * 0.8;
        const [fu, fv] = worldToFluid(bx, by);
        fluid.addSplat(
          fu, fv,
          (Math.random() - 0.5) * 4000 * beatPulseRef.current,
          (Math.random() - 0.5) * 4000 * beatPulseRef.current,
          { radius: 0.004 * (1 + bV * 2) },
        );
      }

      // Treble shimmer — small sparks across the sky
      if (trV > 0.5 && Math.random() < trV * 0.4) {
        fluid.addSplat(
          Math.random(),
          0.4 + Math.random() * 0.5,
          (Math.random() - 0.5) * 1500 * trV,
          (Math.random() - 0.5) * 1500 * trV,
          { radius: 0.0015 },
        );
      }

      // No rotation — skyline stays upright
      particles.points.rotation.z = 0;
      particles.points.updateMatrixWorld(true);
      modelRotation.setFromMatrix4(particles.points.matrixWorld);

      syncFluidParams();
      fluid.step(fluidDt);

      cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
      cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
      const p = DEFAULTS;
      particles.step({
        dt,
        dpr: renderer.getPixelRatio(),
        velocityField: fluid.velocityTexture as any,
        viewMatrix: camera.matrixWorldInverse,
        projectionMatrix: camera.projectionMatrix,
        cameraRight,
        cameraUp,
        modelRotation,
        pointSize: p.pointSize * (1 + bV * 0.3),
        spring: p.spring,
        zeta: p.zeta,
        dragLin: p.dragLin,
        dragQuad: p.dragQuad,
        aMax: p.aMax,
        vMaxScale: p.vMaxScale,
        flowStrength: p.flowStrength * (1 + intenV * 0.5),
        depthLift: 0,
        flowThreshold: p.flowThreshold * SCALE.flowThreshold,
        maxFlowSpeed: p.maxFlowSpeed,
        responseGamma: p.responseGamma,
        perpendicularAngle: 0,
        sideVariation: 0,
        depthAttenuationScale: p.depthAttenuationScale,
      });

      // Bloom reacts to audio intensity
      bloomPass.strength = 0.8 + intenV * 0.6 + beatPulseRef.current * 0.4;

      composer.render(dt);
    };

    onCanvasesReady(canvas, canvas);

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        lastTime = performance.now();
        animate();
      },
      handlePeerMessage: (msg) => {
        const m = msg as unknown as Record<string, unknown>;
        if (m.type === 'INTERACTION' && m.kind === 'BERLINPARTICLES_SPLAT' && fluidRef.current) {
          const d = (m.data ?? {}) as Record<string, number>;
          fluidRef.current.addSplat(
            d.x ?? 0.5,
            d.y ?? 0.5,
            d.dx ?? 0,
            d.dy ?? 0,
            { radius: d.radius ?? 0.002 },
          );
        }
      },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      detachPointerSplats?.();
      composer.dispose();
      scene.remove(particles.points);
      particles.dispose();
      (tint as any).dispose?.();
      fluid.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastSyncRef = useRef(0);

  const handlePointer = (e: React.PointerEvent) => {
    if (!isStartedRef.current || !fluidRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    const now = performance.now();
    if (now - lastSyncRef.current > 50) {
      lastSyncRef.current = now;
      sendInteraction('BERLINPARTICLES_SPLAT', { x, y, dx: 0, dy: 0, radius: 0.002 });
    }
  };

  return (
    <div
      className="absolute inset-0"
      onPointerDown={handlePointer}
      onPointerMove={(e) => { if (e.buttons > 0) handlePointer(e); }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ aspectRatio: '16/9' }}
      />
    </div>
  );
}
