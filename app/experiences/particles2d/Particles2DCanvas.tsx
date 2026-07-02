'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
// PARTICLES 2D — GPGPU fluid-driven particle cloud using three-fluid-fx.
// Adapted from the three-fluid-fx "Particles 2D" demo into the ART.CUBE harness:
// audio-reactive fluid forces, pointer splats, peer sync, post-processing bloom.

import { useRef, useEffect, useState } from 'react';
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
import { DensityTintOverlayPass, FluidSimulation } from 'three-fluid-fx';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';
import { createFlowParticles } from './flowParticles';
import type { FlowParticles } from './flowParticles';

const ASPECT = 1920 / 1080;

const TWO_PI = 6.28318530718;

type CosPalette = {
  bias: [number, number, number];
  amp: [number, number, number];
  phase: [number, number, number];
};

function paletteSample(p: CosPalette, t: number): [number, number, number] {
  return [
    Math.max(0, Math.min(1, p.bias[0] + p.amp[0] * Math.cos(t * TWO_PI + p.phase[0]))),
    Math.max(0, Math.min(1, p.bias[1] + p.amp[1] * Math.cos(t * TWO_PI + p.phase[1]))),
    Math.max(0, Math.min(1, p.bias[2] + p.amp[2] * Math.cos(t * TWO_PI + p.phase[2]))),
  ];
}

const PALETTES: { id: number; name: string; params: CosPalette | null }[] = [
  { id: 0, name: 'Spectrum', params: null },
  { id: 1, name: 'Green-Blue-Yellow', params: { bias: [0.4, 0.2, 0.4], amp: [0.5, 0.4, 0.5], phase: [2.1, 0.0, 4.2] } },
  { id: 2, name: 'Fire', params: { bias: [0.6, 0.2, 0.1], amp: [0.4, 0.4, 0.2], phase: [0.0, 0.6, 1.2] } },
  { id: 3, name: 'Ocean', params: { bias: [0.1, 0.3, 0.5], amp: [0.2, 0.4, 0.5], phase: [0.0, 1.0, 3.0] } },
  { id: 4, name: 'Purple-Pink', params: { bias: [0.2, 0.3, 0.5], amp: [0.3, 0.4, 0.5], phase: [3.0, 0.0, 3.8] } },
];

const DEFAULTS = {
  splatRadius: 10,
  splatForce: 6,
  pressureIterations: 8,
  curlStrength: 0.2,
  velocityDissipation: 0.992,
  densityDissipation: 0.9,
  pressureDissipation: 0.8,
  enableVorticity: false,
  bfecc: true,
  reflectWalls: true,
  flowStrength: 1.0,
  flowThreshold: 40,
  maxFlowSpeed: 20,
  responseGamma: 4,
  depthAttenuationScale: 1,
  spring: 4.0,
  zeta: 1.15,
  dragLin: 0.28,
  dragQuad: 0.05,
  aMax: 24,
  vMaxScale: 1,
  pointSize: 6,
  rotationSpeed: 0.07,
};

const SCALE = {
  splatRadius: 1e-4,
  flowThreshold: 1e-3,
} as const;

export function Particles2DCanvas({
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
  const particlesRef = useRef<FlowParticles | null>(null);
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [interactionMode, setInteractionMode] = useState<'push' | 'swirl' | 'pull'>('push');
  const interactionModeRef = useRef('push');
  const pointerActiveRef = useRef(false);
  const pointerPosRef = useRef({ x: 0.5, y: 0.5 });
  const pointerVelRef = useRef({ dx: 0, dy: 0 });

  useEffect(() => { interactionModeRef.current = interactionMode; }, [interactionMode]);

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
    renderer.setClearColor(new Color('#07080b'), 1);
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

    // — particles —
    const particles = createFlowParticles(renderer, { mode: 'plane2d', size: 80 });
    particlesRef.current = particles;
    scene.add(particles.points);

    // — pointer interaction: single velocity-based splat with mode modifier —
    const dom = renderer.domElement;
    const onPointerMove = (e: PointerEvent) => {
      pointerActiveRef.current = true;
      const rect = dom.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1 - (e.clientY - rect.top) / rect.height;
      pointerVelRef.current.dx = (nx - pointerPosRef.current.x) * 10000;
      pointerVelRef.current.dy = (ny - pointerPosRef.current.y) * 10000;
      pointerPosRef.current = { x: nx, y: ny };
    };
    const onPointerLeave = () => { pointerActiveRef.current = false; };
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerleave', onPointerLeave);

    // — EffectComposer pipeline —
    const tint = new DensityTintOverlayPass(fluid as any);
    const composer = new EffectComposer(renderer);
    composer.setSize(1920, 1080);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new Vector3(1920, 1080) as any,
      0.6,
      0.5,
      0.15,
    );
    composer.addPass(bloomPass);
    composer.addPass(tint as any);
    composer.addPass(new OutputPass());

    const modelRotation = new Matrix3();
    let spinAngle = 0;
    let lastTime = performance.now();
    let rafId = 0;

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

      // audio-reactive fluid: extra splats on beats
      if (beatPulseRef.current > 0.85) {
        const angle = Math.random() * Math.PI * 2;
        const r = 0.2 + Math.random() * 0.2;
        fluid.addSplat(
          0.5 + Math.cos(angle) * r,
          0.5 + Math.sin(angle) * r,
          Math.cos(angle) * 3000 * beatPulseRef.current,
          Math.sin(angle) * 3000 * beatPulseRef.current,
          { radius: 0.003 * (1 + bV * 2) },
        );
      }

      // treble shimmer
      if (trV > 0.5 && Math.random() < trV * 0.4) {
        fluid.addSplat(
          Math.random(),
          Math.random(),
          (Math.random() - 0.5) * 1500 * trV,
          (Math.random() - 0.5) * 1500 * trV,
          { radius: 0.0015 },
        );
      }

      // ambient flow from bass/mid
      if (intenV > 0.1) {
        const wob = Math.sin(now * 0.001) * 0.3;
        fluid.addSplat(
          0.5 + wob * 0.1,
          0.5 + Math.cos(now * 0.0007) * 0.1,
          wob * 800 * (1 + bV),
          (300 + bV * 800) * (1 + mV * 0.5),
          { radius: 0.002 * (1 + bV) },
        );
      }

      // — pointer gravity interaction (single splat, matches original footprint) —
      if (pointerActiveRef.current) {
        const mode = interactionModeRef.current;
        const px = pointerPosRef.current.x;
        const py = pointerPosRef.current.y;
        let { dx, dy } = pointerVelRef.current;
        if (mode === 'pull') { dx = -dx; dy = -dy; }
        else if (mode === 'swirl') { const t = dx; dx = -dy; dy = t; }
        fluid.addSplat(px, py, dx, dy, { radius: 0.002 });
        pointerVelRef.current.dx *= 0.5;
        pointerVelRef.current.dy *= 0.5;
      }

      // rotation: audio-reactive spin
      const p = DEFAULTS;
      const spin = p.rotationSpeed * (1 + intenV * 0.5 + beatPulseRef.current * 2);
      spinAngle += spin * dt;
      particles.points.rotation.z = spinAngle;
      particles.points.updateMatrixWorld(true);
      modelRotation.setFromMatrix4(particles.points.matrixWorld);

      syncFluidParams();
      fluid.step(fluidDt);

      cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
      cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
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

      // bloom reacts to audio intensity
      bloomPass.strength = 0.6 + intenV * 0.8 + beatPulseRef.current * 0.5;

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
        if (m.type === 'INTERACTION' && m.kind === 'PARTICLES2D_SPLAT' && fluidRef.current) {
          const d = (m.data ?? {}) as Record<string, number | string>;
          const mode = (d.mode as string) || 'push';
          let dx = (d.dx as number) ?? 0;
          let dy = (d.dy as number) ?? 0;
          if (mode === 'pull') { dx = -dx; dy = -dy; }
          else if (mode === 'swirl') { const t = dx; dx = -dy; dy = t; }
          fluidRef.current.addSplat((d.x as number) ?? 0.5, (d.y as number) ?? 0.5, dx, dy, { radius: (d.radius as number) ?? 0.002 });
        }
      },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerleave', onPointerLeave);
      composer.dispose();
      scene.remove(particles.points);
      particles.dispose();
      (tint as any).dispose?.();
      fluid.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = PALETTES[paletteIdx];
    if (!p || !particlesRef.current) return;
    particlesRef.current.setPalette(p.id, p.params ?? undefined);
  }, [paletteIdx]);

  // — pointer splat sync to peers —
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
      sendInteraction('PARTICLES2D_SPLAT', { x, y, dx: 0, dy: 0, radius: 0.002, mode: interactionModeRef.current });
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
      <div
        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center rounded-2xl bg-black/40 backdrop-blur-md px-3 py-2 pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1.5 items-center">
          {(['push', 'swirl', 'pull'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setInteractionMode(mode)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${interactionMode === mode ? 'bg-white/20 text-white' : 'text-white bg-white/10'}`}
              title={mode === 'push' ? 'Push particles away' : mode === 'swirl' ? 'Swirl particles around' : 'Pull particles in'}
            >
              <span className="text-base leading-none">{mode === 'push' ? '\u2191' : mode === 'swirl' ? '\u21bb' : '\u2193'}</span>
              <span className={interactionMode === mode ? 'opacity-100' : 'opacity-0 hidden sm:inline'}>{mode === 'push' ? 'Push' : mode === 'swirl' ? 'Swirl' : 'Pull'}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
        {PALETTES.map((p) => {
          const active = p.id === paletteIdx;
          return (
            <button
              key={p.id}
              onClick={() => setPaletteIdx(p.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${active ? 'bg-white/20 text-white' : 'text-white bg-white/10'}`}
              title={p.name}
            >
              {p.params ? (
                <span className="flex gap-0.5">
                  {[0, 0.33, 0.67].map((t) => {
                    const c = paletteSample(p.params!, t);
                    return (
                      <span
                        key={t}
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})` }}
                      />
                    );
                  })}
                </span>
              ) : (
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
                />
              )}
              <span className={active ? 'opacity-100' : 'opacity-0 hidden sm:inline'}>{p.name}</span>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
