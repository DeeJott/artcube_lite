'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { createPostProcessing } from '../../lib/three/postProcessing';
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

const ASPECT = 1920 / 1080;

// ---- Simulation parameters ----
const SIM_RES = 256;            // velocity / pressure grid base
const DYE_RES = 512;            // dye grid base (higher = crisper)
const PRESSURE_ITER = 22;       // Jacobi iterations
const PRESSURE_DECAY = 0.8;     // pressure clear multiplier per frame
const VELOCITY_DISSIPATION = 0.4;
const DENSITY_DISSIPATION = 0.7;
const CURL = 20.0;              // vorticity confinement strength
const BUOYANCY = 0.3;            // upward force from dye density (flame rise)
const POINTER_FORCE = 3600;     // velocity injected from pointer movement
const POINTER_RADIUS = 0.0026;  // dye splat radius (exp falloff)
const EMITTER_RADIUS = 0.0016;  // ambient emitter radius

// ---- Shared full-screen vertex shader (clip-space quad with neighbor texels) ----
const BASE_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;
  void main() {
    vUv = uv;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const ADVECTION_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  varying vec2 vUv;
  void main() {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
  }
`;

const DIVERGENCE_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uVelocity;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

const CURL_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uVelocity;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`;

const VORTICITY_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = min(max(velocity, -1000.0), 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const BUOYANCY_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uVelocity;
  uniform sampler2D uDye;
  uniform float dt;
  uniform float strength;
  varying vec2 vUv;
  void main() {
    vec2 vel = texture2D(uVelocity, vUv).xy;
    vec3 d = texture2D(uDye, vUv).rgb;
    float dens = max(max(d.r, d.g), d.b);
    // heat rises; denser dye lifts faster, with slight horizontal flicker
    vel.y += dens * strength * dt;
    vel.x += (sin(vUv.y * 40.0 + vUv.x * 7.0) * dens) * strength * 0.06 * dt;
    gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`;

const PRESSURE_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

const GRADIENT_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const CLEAR_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uTexture;
  uniform float value;
  varying vec2 vUv;
  void main() {
    gl_FragColor = value * texture2D(uTexture, vUv);
  }
`;

const SPLAT_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

// ---- Display (real plane in scene, projected) ----
const DISPLAY_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DISPLAY_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uTexture, vUv).rgb;
    // faint cool ambient so the dark room reads as deep indigo, not pure black
    vec2 d = vUv - 0.5;
    float amb = exp(-dot(d, d) * 6.0) * 0.015;
    c += vec3(0.02, 0.04, 0.10) * amb;
    gl_FragColor = vec4(c, 1.0);
  }
`;

// ---- HSV -> RGB helper (JS side) ----
function hsv(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

interface Splat {
  x: number; y: number; dx: number; dy: number;
  r: number; g: number; b: number; radius: number;
}

export function FluidCanvas({
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
  const mouseRef = useRef({ x: 0, y: 0 });
  const isStartedRef = useRef(false);
  const splatQueueRef = useRef<Splat[]>([]);
  const pointerRef = useRef({ x: 0, y: 0, has: false });

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

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setSize(1920, 1080, false);
    renderer.setClearColor(0x01010a, 1);
    renderer.autoClear = false;

    const cam = createCinematicCamera(ASPECT);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x01010a, 0.25);

    const composer = createPostProcessing(renderer, scene, cam, {
      bloomStrength: 0.75,
      bloomRadius: 0.6,
      bloomThreshold: 0.2,
      filmIntensity: 0.1,
      chromaticAberration: true,
      vignette: true,
    });

    // ---- Resolutions (aspect > 1 -> wider than tall) ----
    const simW = Math.round(SIM_RES * ASPECT);
    const simH = SIM_RES;
    const dyeW = Math.round(DYE_RES * ASPECT);
    const dyeH = DYE_RES;
    const simTexel = new THREE.Vector2(1 / simW, 1 / simH);

    // ---- Render target helpers ----
    const rtOpts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    };
    const makeRT = (w: number, h: number) => new THREE.WebGLRenderTarget(w, h, rtOpts);
    const makeDouble = (w: number, h: number) => {
      let a = makeRT(w, h);
      let b = makeRT(w, h);
      return {
        get read() { return a; },
        get write() { return b; },
        swap() { const t = a; a = b; b = t; },
        dispose() { a.dispose(); b.dispose(); },
      };
    };

    const velocity = makeDouble(simW, simH);
    const dye = makeDouble(dyeW, dyeH);
    const pressure = makeDouble(simW, simH);
    const divergence = makeRT(simW, simH);
    const curl = makeRT(simW, simH);

    // ---- Sim quad + scene ----
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(quadGeo, undefined as unknown as THREE.Material);
    const simScene = new THREE.Scene();
    simScene.add(quad);
    const simCam = new THREE.Camera();

    const makeMat = (frag: string, uniforms: { [k: string]: THREE.IUniform }) =>
      new THREE.ShaderMaterial({
        vertexShader: BASE_VERT,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });

    const advectionMat = makeMat(ADVECTION_FRAG, {
      texelSize: { value: simTexel },
      uVelocity: { value: null },
      uSource: { value: null },
      dt: { value: 0 },
      dissipation: { value: 0 },
    });
    const divergenceMat = makeMat(DIVERGENCE_FRAG, {
      texelSize: { value: simTexel },
      uVelocity: { value: null },
    });
    const curlMat = makeMat(CURL_FRAG, {
      texelSize: { value: simTexel },
      uVelocity: { value: null },
    });
    const vorticityMat = makeMat(VORTICITY_FRAG, {
      texelSize: { value: simTexel },
      uVelocity: { value: null },
      uCurl: { value: null },
      curl: { value: CURL },
      dt: { value: 0 },
    });
    const buoyancyMat = makeMat(BUOYANCY_FRAG, {
      texelSize: { value: simTexel },
      uVelocity: { value: null },
      uDye: { value: null },
      dt: { value: 0 },
      strength: { value: BUOYANCY },
    });
    const pressureMat = makeMat(PRESSURE_FRAG, {
      texelSize: { value: simTexel },
      uPressure: { value: null },
      uDivergence: { value: null },
    });
    const gradientMat = makeMat(GRADIENT_FRAG, {
      texelSize: { value: simTexel },
      uPressure: { value: null },
      uVelocity: { value: null },
    });
    const clearMat = makeMat(CLEAR_FRAG, {
      texelSize: { value: simTexel },
      uTexture: { value: null },
      value: { value: PRESSURE_DECAY },
    });
    const splatMat = makeMat(SPLAT_FRAG, {
      texelSize: { value: simTexel },
      uTarget: { value: null },
      aspectRatio: { value: ASPECT },
      color: { value: new THREE.Vector3() },
      point: { value: new THREE.Vector2() },
      radius: { value: POINTER_RADIUS },
    });

    const blit = (mat: THREE.Material, target: THREE.WebGLRenderTarget | null) => {
      quad.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(simScene, simCam);
    };

    // ---- Display plane ----
    const displayMat = new THREE.ShaderMaterial({
      vertexShader: DISPLAY_VERT,
      fragmentShader: DISPLAY_FRAG,
      uniforms: {
        uTexture: { value: dye.read.texture },
        uTime: { value: 0 },
      },
    });
    const displayGeo = new THREE.PlaneGeometry(ASPECT, 1);
    const displayMesh = new THREE.Mesh(displayGeo, displayMat);
    scene.add(displayMesh);

    onCanvasesReady(canvas, canvas);

    // ---- Splat application ----
    const applySplat = (s: Splat) => {
      // inject velocity
      splatMat.uniforms.uTarget.value = velocity.read.texture;
      (splatMat.uniforms.point.value as THREE.Vector2).set(s.x, s.y);
      (splatMat.uniforms.color.value as THREE.Vector3).set(s.dx, s.dy, 0);
      splatMat.uniforms.radius.value = s.radius;
      blit(splatMat, velocity.write);
      velocity.swap();
      // inject dye
      splatMat.uniforms.uTarget.value = dye.read.texture;
      (splatMat.uniforms.color.value as THREE.Vector3).set(s.r, s.g, s.b);
      blit(splatMat, dye.write);
      dye.swap();
    };

    let rafId = 0;
    let lastTime = performance.now();
    let simTime = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.0166);
      lastTime = now;
      simTime += dt;

      beatPulseRef.current *= 0.9;
      const bassV = bassRef.current + beatPulseRef.current * 0.4;
      const midV = midRef.current;
      const trebV = trebleRef.current;
      const intenV = intensityRef.current;

      // --- Ambient emitter: a living plume from lower-center ---
      const emitHue = 0.62 + Math.sin(simTime * 0.08) * 0.08 - midV * 0.06; // indigo->cyan
      const emitVal = 0.08 + intenV * 0.12 + beatPulseRef.current * 0.15;
      const [er, eg, eb] = hsv(((emitHue % 1) + 1) % 1, 0.85, emitVal);
      const wob = Math.sin(simTime * 0.2) * 0.025 + Math.sin(simTime * 0.5) * 0.01;
      splatQueueRef.current.push({
        x: 0.5 + wob,
        y: 0.12,
        dx: wob * 300,
        dy: (100 + bassV * 350) ,
        r: er * 0.9, g: eg * 0.9, b: eb * 1.1,
        radius: EMITTER_RADIUS * (1 + bassV * 1.5),
      });

      // treble shimmer: tiny sparks around the plume
      if (trebV > 0.55 && Math.random() < trebV * 0.6) {
        const sx = 0.5 + (Math.random() - 0.5) * 0.35;
        const sy = 0.3 + Math.random() * 0.4;
        const [sr, sg, sb] = hsv(0.5 + Math.random() * 0.15, 0.7, 0.09 * trebV);
        splatQueueRef.current.push({
          x: sx, y: sy,
          dx: (Math.random() - 0.5) * 600,
          dy: 300,
          r: sr, g: sg, b: sb,
          radius: EMITTER_RADIUS * 0.7,
        });
      }

      // beat burst
      if (beatPulseRef.current > 0.85) {
        const [br2, bg2, bb2] = hsv(0.68, 0.8, 0.18);
        splatQueueRef.current.push({
          x: 0.5, y: 0.16,
          dx: 0, dy: 800,
          r: br2, g: bg2, b: bb2,
          radius: EMITTER_RADIUS * 3.0,
        });
      }

      // --- Process queued splats ---
      const queue = splatQueueRef.current;
      for (let i = 0; i < queue.length; i++) applySplat(queue[i]);
      queue.length = 0;

      // --- Simulation steps ---
      // curl
      curlMat.uniforms.uVelocity.value = velocity.read.texture;
      blit(curlMat, curl);
      // vorticity confinement
      vorticityMat.uniforms.uVelocity.value = velocity.read.texture;
      vorticityMat.uniforms.uCurl.value = curl.texture;
      vorticityMat.uniforms.dt.value = dt;
      blit(vorticityMat, velocity.write);
      velocity.swap();
      // buoyancy
      buoyancyMat.uniforms.uVelocity.value = velocity.read.texture;
      buoyancyMat.uniforms.uDye.value = dye.read.texture;
      buoyancyMat.uniforms.dt.value = dt;
      blit(buoyancyMat, velocity.write);
      velocity.swap();
      // divergence
      divergenceMat.uniforms.uVelocity.value = velocity.read.texture;
      blit(divergenceMat, divergence);
      // clear pressure
      clearMat.uniforms.uTexture.value = pressure.read.texture;
      blit(clearMat, pressure.write);
      pressure.swap();
      // pressure jacobi
      pressureMat.uniforms.uDivergence.value = divergence.texture;
      for (let i = 0; i < PRESSURE_ITER; i++) {
        pressureMat.uniforms.uPressure.value = pressure.read.texture;
        blit(pressureMat, pressure.write);
        pressure.swap();
      }
      // gradient subtract
      gradientMat.uniforms.uPressure.value = pressure.read.texture;
      gradientMat.uniforms.uVelocity.value = velocity.read.texture;
      blit(gradientMat, velocity.write);
      velocity.swap();
      // advect velocity
      advectionMat.uniforms.texelSize.value = simTexel;
      advectionMat.uniforms.uVelocity.value = velocity.read.texture;
      advectionMat.uniforms.uSource.value = velocity.read.texture;
      advectionMat.uniforms.dt.value = dt;
      advectionMat.uniforms.dissipation.value = VELOCITY_DISSIPATION;
      blit(advectionMat, velocity.write);
      velocity.swap();
      // advect dye
      advectionMat.uniforms.uVelocity.value = velocity.read.texture;
      advectionMat.uniforms.uSource.value = dye.read.texture;
      advectionMat.uniforms.dissipation.value = DENSITY_DISSIPATION;
      blit(advectionMat, dye.write);
      dye.swap();

      // --- Final composite ---
      renderer.setRenderTarget(null);
      displayMat.uniforms.uTexture.value = dye.read.texture;
      displayMat.uniforms.uTime.value = simTime;
      updateCinematicCamera(cam, now / 1000, mouseRef.current.x, mouseRef.current.y, 0.2);
      renderer.clear();
      composer.render();
    };

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        // seed an initial bloom of dye so the scene isn't empty
        const [r0, g0, b0] = hsv(0.64, 0.8, 0.28);
        splatQueueRef.current.push({ x: 0.5, y: 0.25, dx: 0, dy: 1500, r: r0, g: g0, b: b0, radius: EMITTER_RADIUS * 4 });
        animate();
      },
      handlePeerMessage: (msg) => {
        const m = msg as unknown as Record<string, unknown>;
        if (m.type === 'INTERACTION' && m.kind === 'FLUID_SPLAT') {
          const d = (m.data ?? {}) as Record<string, number>;
          splatQueueRef.current.push({
            x: d.x ?? 0.5, y: d.y ?? 0.5,
            dx: d.dx ?? 0, dy: d.dy ?? 0,
            r: d.r ?? 0.2, g: d.g ?? 0.3, b: d.b ?? 0.6,
            radius: d.radius ?? POINTER_RADIUS,
          });
        }
      },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      composer.dispose();
      velocity.dispose();
      dye.dispose();
      pressure.dispose();
      divergence.dispose();
      curl.dispose();
      quadGeo.dispose();
      displayGeo.dispose();
      displayMat.dispose();
      advectionMat.dispose();
      divergenceMat.dispose();
      curlMat.dispose();
      vorticityMat.dispose();
      buoyancyMat.dispose();
      pressureMat.dispose();
      gradientMat.dispose();
      clearMat.dispose();
      splatMat.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Pointer "push" interaction ----
  const pushFromPointer = useCallback((clientX: number, clientY: number, isStart: boolean) => {
    if (!isStartedRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ux = (clientX - rect.left) / rect.width;
    const uy = 1 - (clientY - rect.top) / rect.height; // v up

    const p = pointerRef.current;
    let dx = 0;
    let dy = 0;
    if (!isStart && p.has) {
      dx = (ux - p.x) * POINTER_FORCE;
      dy = (uy - p.y) * POINTER_FORCE;
    }
    p.x = ux; p.y = uy; p.has = true;

    // colorful blue/cyan/violet dye driven by motion energy
    const speed = Math.min(Math.sqrt(dx * dx + dy * dy) / 4000, 1);
    const hue = 0.6 + speed * 0.12 + Math.random() * 0.04;
    const [r, g, b] = hsv(hue % 1, 0.8, 0.05 + speed * 0.12);

    const splat: Splat = {
      x: ux, y: uy, dx, dy,
      r, g, b,
      radius: POINTER_RADIUS * (isStart ? 1.6 : 1.0),
    };
    splatQueueRef.current.push(splat);
    sendInteraction('FLUID_SPLAT', { ...splat });
  }, [sendInteraction]);

  return (
    <div
      className="absolute inset-0"
      onMouseDown={(e) => pushFromPointer(e.clientX, e.clientY, true)}
      onMouseMove={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          mouseRef.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          mouseRef.current.y = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
        }
        if (e.buttons > 0) pushFromPointer(e.clientX, e.clientY, false);
      }}
      onMouseUp={() => { pointerRef.current.has = false; }}
      onMouseLeave={() => { pointerRef.current.has = false; }}
      onTouchStart={(e) => pushFromPointer(e.touches[0].clientX, e.touches[0].clientY, true)}
      onTouchMove={(e) => pushFromPointer(e.touches[0].clientX, e.touches[0].clientY, false)}
      onTouchEnd={() => { pointerRef.current.has = false; }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ aspectRatio: '16/9' }}
      />
    </div>
  );
}
