// Main canvas renderer hook for art.cube

'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SCENE_TIMES,
  FLARE,
  TIMING,
  SIZES,
} from '../lib/constants';
import { createFlareScene } from '../lib/three/flareShader';
import {
  BeatShootingStar,
  ShootingStar,
  GasParticle,
  InteractionStar,
  createBeatWisp,
  hexToRgb,
} from '../lib/canvas/particles';
import { checkShootingStarCollisions } from '../lib/canvas/collisions';
import type {
  Scene,
  Label,
  Explosion,
  NewbornStar,
  DustParticle,
  CentralStar,
  OwnerId,
  NebulaPalette,
} from '../lib/types';
import type { BeatWisp } from '../lib/canvas/particles';

interface RendererState {
  currentScene: Scene;
  elapsed: number;
  isRecording: boolean;
  isTransitioning: boolean;
}

export function useCanvasRenderer(
  isRunning: boolean,
  isRecordingPhase: boolean,
  intensity: number,
  lastBeatTime: number,
  isMobile: boolean,
  onExplosion: (explosion: Explosion) => void
) {
  // Refs for canvas and Three.js
  const flareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const starCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const flareRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const flareSceneRef = useRef<{ scene: THREE.Scene; camera: THREE.OrthographicCamera; material: THREE.ShaderMaterial } | null>(null);
  const starCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Animation refs
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  // Scene state
  const currentSceneRef = useRef<Scene>(1);
  const transitionActiveRef = useRef<boolean>(false);
  const scene2InitializedRef = useRef<boolean>(false);
  const scene3InitializedRef = useRef<boolean>(false);

  // Particle arrays
  const beatShootingStarsRef = useRef<BeatShootingStar[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const gasParticlesRef = useRef<GasParticle[]>([]);
  const interactionStarsRef = useRef<InteractionStar[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const newbornStarsRef = useRef<NewbornStar[]>([]);
  const dustParticlesRef = useRef<DustParticle[]>([]);
  const beatWispsRef = useRef<BeatWisp[]>([]);
  const labelsRef = useRef<Label[]>([]);
  const centralStarRef = useRef<CentralStar | null>(null);

  // State for UI
  const [state, setState] = useState<RendererState>({
    currentScene: 1,
    elapsed: 0,
    isRecording: false,
    isTransitioning: false,
  });

  // Initialize canvases
  const initialize = useCallback((flareCanvas: HTMLCanvasElement, starCanvas: HTMLCanvasElement) => {
    flareCanvasRef.current = flareCanvas;
    starCanvasRef.current = starCanvas;

    // Set canvas dimensions
    flareCanvas.width = CANVAS_WIDTH;
    flareCanvas.height = CANVAS_HEIGHT;
    starCanvas.width = CANVAS_WIDTH;
    starCanvas.height = CANVAS_HEIGHT;

    // Initialize Three.js flare
    const flareRenderer = new THREE.WebGLRenderer({ canvas: flareCanvas, antialias: true });
    flareRenderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    flareRendererRef.current = flareRenderer;

    const flareScene = createFlareScene();
    flareSceneRef.current = flareScene;

    // Initialize 2D context
    const ctx = starCanvas.getContext('2d');
    if (ctx) {
      starCtxRef.current = ctx;
    }
  }, []);

  // Scene initialization functions
  const initScene2 = useCallback(() => {
    if (scene2InitializedRef.current) return;
    scene2InitializedRef.current = true;

    // Initialize dust particles
    const palette = ['#ff2d78', '#ff6b35', '#cc00ff', '#00d4ff', '#0055ff', '#00ffcc'];
    const count = isMobile ? 15 : 40;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.08 + Math.random() * 0.07;
      dustParticlesRef.current.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: 0.1 + Math.random() * 0.2,
        size: 1 + Math.random() * 2,
        decay: 0,
        burst: false,
      });
    }
  }, [isMobile]);

  // Update scene state
  const updateSceneState = useCallback((elapsed: number) => {
    if (currentSceneRef.current === 1 && elapsed >= 30 && !transitionActiveRef.current) {
      transitionActiveRef.current = true;
      initScene2();
    }
    if (currentSceneRef.current === 1 && transitionActiveRef.current && elapsed >= 31.5) {
      currentSceneRef.current = 2;
      transitionActiveRef.current = false;
    }
    if (currentSceneRef.current === 2 && elapsed >= 60 && !scene3InitializedRef.current) {
      scene3InitializedRef.current = true;
      currentSceneRef.current = 3;
    }
  }, [initScene2]);

  // Spawn beat stars
  const spawnBeatStars = useCallback((elapsed: number) => {
    if (beatShootingStarsRef.current.length < 12 && Math.random() < 0.03) {
      beatShootingStarsRef.current.push(new BeatShootingStar(elapsed));
    }
  }, []);

  // Handle nebula overlap
  const handleNebulaOverlap = useCallback((x: number, y: number, currentId: number) => {
    let overlap = false;
    for (const p of gasParticlesRef.current) {
      if (p.id === currentId) continue;
      if (Math.hypot(x - p.x, y - p.y) < p.size * 0.65) {
        p.isGlowing = true;
        overlap = true;
      }
    }
    if (overlap && Math.random() < 0.18) {
      const localBorn = startTimeRef.current ? (performance.now() - startTimeRef.current) / 1000 : 0;
      for (let i = 0; i < 8; i++) {
        const iStar = new InteractionStar(
          x + (Math.random() - 0.5) * 45,
          y + (Math.random() - 0.5) * 45,
          true
        );
        iStar.born = localBorn;
        interactionStarsRef.current.push(iStar);
      }
    }
  }, []);

  // Create shooting stars
  const createShootingStars = useCallback((
    x: number,
    y: number,
    ownerId: OwnerId,
    clickId: number,
    direction: number,
    syncData?: { vx: number; vy: number; w: number; d: number; born: number; cid: number; ownerId: OwnerId; dir: number }
  ) => {
    const count = 2 + Math.floor(Math.random() * 2);
    const localBorn = startTimeRef.current ? (performance.now() - startTimeRef.current) / 1000 : 0;
    for (let i = 0; i < count; i++) {
      const star = new ShootingStar(
        x + (Math.random() - 0.5) * 40,
        y + (Math.random() - 0.5) * 40,
        syncData?.vx,
        syncData?.vy,
        syncData?.w,
        syncData?.d,
        clickId,
        ownerId,
        direction,
        syncData
      );
      if (!syncData) star.born = localBorn;
      shootingStarsRef.current.push(star);
    }
  }, []);

  // Create gas particle (nebula)
  const createGasParticle = useCallback((
    x: number,
    y: number,
    palette: NebulaPalette,
    id: number,
    syncData?: { vx: number; vy: number; size: number; born: number }
  ) => {
    const count = isMobile ? 1 : 2;
    const localBorn = startTimeRef.current ? (performance.now() - startTimeRef.current) / 1000 : 0;
    for (let i = 0; i < count; i++) {
      const px = x + (Math.random() - 0.5) * 30;
      const py = y + (Math.random() - 0.5) * 30;
      const p = new GasParticle(px, py, palette, id, syncData);
      if (!syncData) p.born = localBorn;
      gasParticlesRef.current.push(p);
      handleNebulaOverlap(px, py, id);
    }
  }, [isMobile, handleNebulaOverlap]);

  // Create label
  const createLabel = useCallback((x: number, y: number, text: string, startTime: number) => {
    if (!text) return;
    labelsRef.current.push({ x, y: y - 45, text, born: startTime });
  }, []);

  // Draw background (central star at 30s+)
  const drawBackground = useCallback((elapsed: number, ctx: CanvasRenderingContext2D) => {
    if (elapsed >= 30) {
      if (!centralStarRef.current) {
        const rangeX = CANVAS_WIDTH * 0.25;
        const rangeY = CANVAS_HEIGHT * 0.25;
        centralStarRef.current = {
          x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 2 * rangeX,
          y: CANVAS_HEIGHT / 2 + (Math.random() - 0.5) * 2 * rangeY,
          born: elapsed,
          bokeh: [],
        };
        for (let i = 0; i < SIZES.CENTRAL_STAR_BOKEH_COUNT; i++) {
          centralStarRef.current.bokeh.push({
            relX: (Math.random() - 0.5) * 600,
            relY: (Math.random() - 0.5) * 600,
            size: SIZES.CENTRAL_STAR_BOKEH_SIZE_MIN + Math.random() * (SIZES.CENTRAL_STAR_BOKEH_SIZE_MAX - SIZES.CENTRAL_STAR_BOKEH_SIZE_MIN),
            opacity: 0.15 + Math.random() * 0.3,
            phase: Math.random() * Math.PI * 2,
            speed: 0.0005 + Math.random() * 0.001,
          });
        }
      }

      const star = centralStarRef.current;
      const age = elapsed - star.born;
      const globalAlpha = Math.min(1.0, age / 3.0);
      const flicker = 0.85 + 0.15 * Math.sin(elapsed * 4.5);

      ctx.save();

      // Draw Bokeh Orbs
      star.bokeh.forEach((b) => {
        const floatX = Math.sin(elapsed * b.speed * 1000 + b.phase) * 15;
        const floatY = Math.cos(elapsed * b.speed * 800 + b.phase) * 15;
        const grad = ctx.createRadialGradient(
          star.x + b.relX + floatX,
          star.y + b.relY + floatY,
          0,
          star.x + b.relX + floatX,
          star.y + b.relY + floatY,
          b.size
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${b.opacity * globalAlpha * 0.6})`);
        grad.addColorStop(0.8, `rgba(255, 255, 255, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(star.x + b.relX + floatX, star.y + b.relY + floatY, b.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Halos
      const pulseOuter = 1.0 + 0.05 * Math.sin(elapsed * 0.8);
      const outerGrad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 450 * pulseOuter);
      outerGrad.addColorStop(0, `rgba(255, 255, 255, ${0.08 * globalAlpha})`);
      outerGrad.addColorStop(0.75, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = outerGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const pulseMid = 1.0 + 0.03 * Math.sin(elapsed * 1.1);
      const midGrad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 250 * pulseMid);
      midGrad.addColorStop(0, `rgba(255, 255, 255, ${0.12 * globalAlpha})`);
      midGrad.addColorStop(0.7, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = midGrad;
      ctx.beginPath();
      ctx.arc(star.x, star.y, 250 * pulseMid, 0, Math.PI * 2);
      ctx.fill();

      const pulseInner = 1.0 + 0.05 * Math.sin(elapsed * 1.5);
      const innerGrad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 125 * pulseInner);
      innerGrad.addColorStop(0, `rgba(255, 255, 255, ${0.2 * globalAlpha})`);
      innerGrad.addColorStop(0.7, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(star.x, star.y, 125 * pulseInner, 0, Math.PI * 2);
      ctx.fill();

      // Core Glow
      const coreGrad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 50);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.6 * globalAlpha * flicker})`);
      coreGrad.addColorStop(0.8, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(star.x, star.y, 50, 0, Math.PI * 2);
      ctx.fill();

      // Light cross
      const rayAlpha = 0.4 * globalAlpha * (0.7 + 0.3 * flicker);
      const rayLength = 83;
      const rayGradH = ctx.createLinearGradient(star.x - rayLength, star.y, star.x + rayLength, star.y);
      rayGradH.addColorStop(0, 'rgba(255,255,255,0)');
      rayGradH.addColorStop(0.5, `rgba(255,255,255,${rayAlpha})`);
      rayGradH.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = rayGradH;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(star.x - rayLength, star.y);
      ctx.lineTo(star.x + rayLength, star.y);
      ctx.stroke();

      const rayGradV = ctx.createLinearGradient(star.x, star.y - rayLength, star.x, star.y + rayLength);
      rayGradV.addColorStop(0, 'rgba(255,255,255,0)');
      rayGradV.addColorStop(0.5, `rgba(255,255,255,${rayAlpha})`);
      rayGradV.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = rayGradV;
      ctx.beginPath();
      ctx.moveTo(star.x, star.y - rayLength);
      ctx.lineTo(star.x, star.y + rayLength);
      ctx.stroke();

      // Center Point
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#fff';
      ctx.fillStyle = `rgba(255, 255, 255, ${globalAlpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }, []);

  // Draw labels
  const drawLabels = useCallback((elapsed: number, ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.font = "bold 14px 'Helvetica Neue', Arial";
    ctx.textAlign = 'center';
    for (let i = labelsRef.current.length - 1; i >= 0; i--) {
      const l = labelsRef.current[i];
      const age = elapsed - l.born;
      if (age > 0.5) {
        labelsRef.current.splice(i, 1);
        continue;
      }
      let alpha = 0.8;
      if (age < 0.1) alpha = (age / 0.1) * 0.8;
      else if (age > 0.4) alpha = ((0.5 - age) / 0.1) * 0.8;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(255,255,255,1.0)';
      ctx.fillText(l.text.toUpperCase(), l.x, l.y);
    }
    ctx.restore();
  }, []);

  // Track running state with ref to avoid stale closure
  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Main animation loop
  const animate = useCallback(() => {
    if (!isRunningRef.current || !starCtxRef.current || !flareSceneRef.current || !flareRendererRef.current) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const now = performance.now();

    // Calculate delta time
    let dt = 1.0;
    if (lastFrameTimeRef.current !== 0) {
      dt = (now - lastFrameTimeRef.current) / 16.67;
      if (dt < 0.1 || dt > 3.0 || isNaN(dt)) dt = 1.0;
    }
    lastFrameTimeRef.current = now;

    // Calculate elapsed time
    const elapsed = startTimeRef.current ? (now - startTimeRef.current) / 1000 : 0;

    // Update scene state
    updateSceneState(elapsed);

    // Update Three.js flare
    const { scene, camera, material } = flareSceneRef.current;
    material.uniforms.uTime.value += FLARE.TIME_SCALE * dt;
    material.uniforms.uAlpha.value = Math.min(1.0, elapsed / FLARE.FADE_IN_DURATION_S);
    flareRendererRef.current.render(scene, camera);

    // Spawn beat stars
    spawnBeatStars(elapsed);

    // Get 2D context
    const ctx = starCtxRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background (central star)
    drawBackground(elapsed, ctx);

    // Update and draw beat shooting stars
    for (let i = beatShootingStarsRef.current.length - 1; i >= 0; i--) {
      const bs = beatShootingStarsRef.current[i];
      bs.update(dt, elapsed);
      if (!bs.alive(elapsed)) {
        beatShootingStarsRef.current.splice(i, 1);
        continue;
      }
      bs.draw(elapsed, ctx, lastBeatTime, intensity);
    }

    // Update and draw shooting stars
    for (let i = shootingStarsRef.current.length - 1; i >= 0; i--) {
      const s = shootingStarsRef.current[i];
      s.update(dt);
      s.draw(elapsed, ctx);
      if (s.life <= 0) shootingStarsRef.current.splice(i, 1);
    }

    // Draw gas particles (nebula) with screen blend mode
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = gasParticlesRef.current.length - 1; i >= 0; i--) {
      const p = gasParticlesRef.current[i];
      p.update(dt);
      if (!p.draw(elapsed, ctx)) gasParticlesRef.current.splice(i, 1);
    }
    ctx.restore();

    // Update and draw interaction stars
    for (let i = interactionStarsRef.current.length - 1; i >= 0; i--) {
      const s = interactionStarsRef.current[i];
      s.update(dt);
      if (!s.draw(elapsed, ctx)) interactionStarsRef.current.splice(i, 1);
    }

    // Draw newborn stars
    for (let i = newbornStarsRef.current.length - 1; i >= 0; i--) {
      const star = newbornStarsRef.current[i];
      const age = elapsed - star.born;
      if (age > 10) {
        newbornStarsRef.current.splice(i, 1);
        continue;
      }
      const flicker = 0.7 + 0.3 * Math.sin(elapsed * star.flickerSpeed + star.flickerOffset);
      const fade = age > 8 ? 1 - (age - 8) / 2 : 1;
      const a = 0.5 * flicker * fade;
      const { r, g, b } = hexToRgb(star.color);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowBlur = 12;
      ctx.shadowColor = star.color;
      ctx.fillStyle = `rgba(${r},${g},${b},1)`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw explosions
    for (let i = explosionsRef.current.length - 1; i >= 0; i--) {
      const ex = explosionsRef.current[i];
      const age = elapsed - ex.born;
      if (age > 20) {
        explosionsRef.current.splice(i, 1);
        continue;
      }
      const fade = age > 18 ? 1 - (age - 18) / 2 : 1;
      const flicker = 0.6 + Math.random() * 0.4;
      const exAlpha = 1.0 * fade * flicker;

      ctx.save();
      ctx.globalAlpha = exAlpha;
      ctx.shadowBlur = 15;
      ex.particles.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.985, dt);
        p.vy *= Math.pow(0.985, dt);
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Draw labels
    drawLabels(elapsed, ctx);

    // Check collisions
    checkShootingStarCollisions(
      shootingStarsRef.current,
      currentSceneRef.current,
      elapsed,
      isMobile,
      (explosion) => explosionsRef.current.push(explosion)
    );

    // Update state for UI
    setState({
      currentScene: currentSceneRef.current,
      elapsed,
      isRecording: isRecordingPhase,
      isTransitioning: transitionActiveRef.current,
    });

    rafRef.current = requestAnimationFrame(animate);
  }, [
    isRecordingPhase,
    intensity,
    lastBeatTime,
    isMobile,
    updateSceneState,
    spawnBeatStars,
    drawBackground,
    drawLabels,
  ]);

  // Start animation
  const start = useCallback(() => {
    startTimeRef.current = performance.now();
    lastFrameTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  // Stop animation
  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      flareRendererRef.current?.dispose();
    };
  }, [stop]);

  return {
    initialize,
    start,
    stop,
    state,
    createShootingStars,
    createGasParticle,
    createLabel,
    canvases: {
      flare: flareCanvasRef,
      star: starCanvasRef,
    },
    refs: {
      startTime: startTimeRef,
      currentScene: currentSceneRef,
    },
  };
}
