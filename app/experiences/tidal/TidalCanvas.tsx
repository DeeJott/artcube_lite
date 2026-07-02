'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { createPostProcessing } from '../../lib/three/postProcessing';
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

const ASPECT = 1920 / 1080;
const MAX_RIPPLES = 16;

interface Ripple {
  x: number;
  y: number;
  born: number;
  amplitude: number;
  wavelength: number;
  speed: number;
}

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uAmp;
  uniform vec2 uResolution;
  uniform vec4 uRipples[${MAX_RIPPLES}]; // xy = position (uv space), z = born time, w = amplitude
  uniform float uRippleParams[${MAX_RIPPLES}]; // wavelength
  uniform float uRippleSpeed[${MAX_RIPPLES}];
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;

    // Base water pattern
    float wave = 0.0;
    wave += sin(uv.x * 8.0 + uTime * 0.5) * 0.02;
    wave += sin(uv.y * 6.0 + uTime * 0.3) * 0.02;
    wave += sin((uv.x + uv.y) * 10.0 + uTime * 0.7) * 0.015;
    wave += sin((uv.x - uv.y) * 7.0 - uTime * 0.4) * 0.015;

    // Ripple interference
    float totalDisp = 0.0;
    vec3 totalColor = vec3(0.0);

    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      float wavelength = uRippleParams[i];
      float speed = uRippleSpeed[i];

      if (r.w <= 0.0) continue;

      float age = uTime - r.z;
      if (age < 0.0 || age > 12.0) continue;

      vec2 diff = uv - r.xy;
      diff.x *= aspect;
      float dist = length(diff);

      // Wave front radius
      float frontRadius = age * speed;
      float ringWidth = wavelength * 1.5;

      // Distance from wave front
      float distFromFront = dist - frontRadius;

      // Fade with age
      float ageFade = 1.0 - smoothstep(0.0, 12.0, age);
      // Fade with distance from front
      float ringFade = exp(-distFromFront * distFromFront / (ringWidth * ringWidth));
      // Amplitude decreases with distance
      float distAtten = 1.0 / (1.0 + dist * 3.0);

      float amp = r.w * ageFade * ringFade * distAtten;

      // Oscillating wave
      float phase = (dist - frontRadius) / wavelength * 6.28318;
      float oscillation = cos(phase) * amp;

      totalDisp += oscillation;

      // Color contribution based on ripple index
      float hue = float(i) / float(${MAX_RIPPLES});
      vec3 rippleColor;
      if (hue < 0.16) rippleColor = vec3(0.0, 0.8, 1.0);       // cyan
      else if (hue < 0.33) rippleColor = vec3(0.0, 1.0, 0.6);   // emerald
      else if (hue < 0.50) rippleColor = vec3(0.3, 0.0, 1.0);   // violet
      else if (hue < 0.66) rippleColor = vec3(1.0, 0.2, 0.6);   // magenta
      else if (hue < 0.83) rippleColor = vec3(1.0, 0.7, 0.0);   // gold
      else rippleColor = vec3(0.0, 1.0, 0.9);                    // teal

      totalColor += rippleColor * abs(oscillation) * 1.5;
    }

    // Combine base wave with ripples
    float height = wave * uAmp + totalDisp;

    // Normal from height field (gradient approximation)
    float eps = 0.003;
    float hL = sin((uv.x - eps) * 8.0 + uTime * 0.5) * 0.02;
    float hR = sin((uv.x + eps) * 8.0 + uTime * 0.5) * 0.02;
    float hD = sin((uv.y - eps) * 6.0 + uTime * 0.3) * 0.02;
    float hU = sin((uv.y + eps) * 6.0 + uTime * 0.3) * 0.02;
    hL += totalDisp; hR += totalDisp; hD += totalDisp; hU += totalDisp;

    vec3 normal = normalize(vec3(hL - hR, hD - hU, 0.02));

    // Lighting
    vec3 lightDir = normalize(vec3(0.3, 0.5, 0.8));
    float diffuse = max(dot(normal, lightDir), 0.0);
    float specular = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 32.0);

    // Deep water color
    vec3 deepColor = vec3(0.01, 0.03, 0.08);
    vec3 shallowColor = vec3(0.05, 0.15, 0.25);
    vec3 waterColor = mix(deepColor, shallowColor, diffuse * 0.5 + 0.5);

    // Add ripple colors
    waterColor += totalColor * 0.4;

    // Specular highlights
    waterColor += vec3(0.8, 0.9, 1.0) * specular * 0.6;

    // Caustic-like patterns from wave interference
    float caustic = pow(abs(height), 1.5) * 2.0;
    waterColor += vec3(0.1, 0.2, 0.3) * caustic;

    // Subtle vignette
    float vig = 1.0 - length(uv - 0.5) * 0.5;
    waterColor *= vig;

    gl_FragColor = vec4(waterColor, 1.0);
  }
`;

export function TidalCanvas({
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
  const ripplesRef = useRef<Ripple[]>([]);
  const intensityRef = useRef(0);
  const bassRef = useRef(0);
  const midRef = useRef(0);
  const trebleRef = useRef(0);
  const prevBeatRef = useRef(0);
  const isStartedRef = useRef(false);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { bassRef.current = bass; }, [bass]);
  useEffect(() => { midRef.current = mid; }, [mid]);
  useEffect(() => { trebleRef.current = treble; }, [treble]);

  useEffect(() => {
    if (lastBeatTime && lastBeatTime !== prevBeatRef.current) {
      prevBeatRef.current = lastBeatTime;
    }
  }, [lastBeatTime]);

  const spawnRipple = useCallback((nx: number, ny: number) => {
    ripplesRef.current.push({
      x: nx,
      y: ny,
      born: timeRef.current,
      amplitude: 0.08 + Math.random() * 0.04,
      wavelength: 0.04 + Math.random() * 0.03,
      speed: 0.15 + Math.random() * 0.08,
    });
    if (ripplesRef.current.length > MAX_RIPPLES) {
      ripplesRef.current = ripplesRef.current.slice(-MAX_RIPPLES);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(1920, 1080, false);
    renderer.setClearColor(0x010308, 1);

    const cam = createCinematicCamera(ASPECT);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x010308, 0.25);

    const composer = createPostProcessing(renderer, scene, cam, {
      bloomStrength: 0.9,
      bloomRadius: 0.5,
      bloomThreshold: 0.2,
      filmIntensity: 0.08,
    });

    const uniforms: { [key: string]: THREE.IUniform } = {
      uTime: { value: 0 },
      uAmp: { value: 1.0 },
      uResolution: { value: new THREE.Vector2(1920, 1080) },
      uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)) },
      uRippleParams: { value: new Array(MAX_RIPPLES).fill(0.05) },
      uRippleSpeed: { value: new Array(MAX_RIPPLES).fill(0.15) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });

    const geo = new THREE.PlaneGeometry(ASPECT, 1, 200, 200);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -0.15;
    scene.add(mesh);

    onCanvasesReady(canvas, canvas);

    let rafId = 0;
    let lastTime = performance.now();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(now - lastTime, 32) / 1000;
      lastTime = now;

      timeRef.current += dt;
      uniforms.uTime.value = timeRef.current;
      uniforms.uAmp.value = 1.0 + intensityRef.current * 0.5 + bassRef.current * 0.8;

      // Update ripples uniform
      const ripples = ripplesRef.current;
      const ripplesUniform = uniforms.uRipples.value as THREE.Vector4[];
      const paramsUniform = uniforms.uRippleParams.value as number[];
      const speedUniform = uniforms.uRippleSpeed.value as number[];

      for (let i = 0; i < MAX_RIPPLES; i++) {
        if (i < ripples.length) {
          const r = ripples[i];
          ripplesUniform[i].set(r.x, r.y, r.born, r.amplitude);
          paramsUniform[i] = r.wavelength;
          speedUniform[i] = r.speed;
        } else {
          ripplesUniform[i].set(0, 0, -100, 0);
          paramsUniform[i] = 0.05;
          speedUniform[i] = 0.15;
        }
      }

      // Clean old ripples
      ripplesRef.current = ripplesRef.current.filter(r => timeRef.current - r.born < 12.0);

      updateCinematicCamera(cam, timeRef.current, mouseRef.current.x, mouseRef.current.y, 0.5);
      composer.render();
    };

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        // Seed ambient ripples
        for (let i = 0; i < 3; i++) {
          setTimeout(() => spawnRipple(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6), i * 1500);
        }
        animate();
      },
      handlePeerMessage: (msg) => {
        const m = msg as unknown as Record<string, unknown>;
        if (m.type === 'INTERACTION' && m.kind === 'TIDAL_TOUCH') {
          spawnRipple(m.rx as number ?? 0.5, m.ry as number ?? 0.5);
        }
      },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      composer.dispose();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambient ripple spawning
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      if (ripplesRef.current.length < 4) {
        spawnRipple(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.8);
      }
    }, 6000);
    return () => clearInterval(id);
  }, [isRunning, spawnRipple]);

  const handlePointer = useCallback((clientX: number, clientY: number) => {
    if (!isStartedRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rx = (clientX - rect.left) / rect.width;
    const ry = 1.0 - (clientY - rect.top) / rect.height; // flip Y for UV space
    spawnRipple(rx, ry);
    sendInteraction('TIDAL_TOUCH', { rx, ry });
  }, [spawnRipple, sendInteraction]);

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
