'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { ExperienceComponentProps } from '../../lib/experience-types';

// ==========================================
// CONSTANTS & PALETTES
// ==========================================
const ASPECT = 1920 / 1080;

// ==========================================
// SHADERS
// ==========================================

// 1. Background Metallic Shibuya Shader
const bgVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const bgFragmentShader = /* glsl */ `
  uniform vec3 iResolution;
  uniform float iTime;
  uniform float uKaleidoscope;
  uniform float uGridVibe;
  uniform float uRippleTime;
  uniform float uRippleActive;
  varying vec2 vUv;

  mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  vec2 applyKaleidoscope(vec2 uv, float strength) {
    if (strength <= 0.001) return uv;
    vec2 p = uv - 0.5;
    float r = length(p);
    float a = atan(p.y, p.x);
    float sides = 8.0;
    float tau = 6.283185;
    a = mod(a, tau / sides);
    a = abs(a - tau / (sides * 2.0));
    vec2 kalUv = vec2(cos(a), sin(a)) * r + 0.5;
    return mix(uv, kalUv, strength);
  }

  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    if (uRippleActive > 0.5) {
      float dist = length(uv);
      float wave = sin(dist * 28.0 - uRippleTime * 9.0) * 0.045 * exp(-dist * 1.8);
      uv += (uv / (dist + 0.001)) * wave;
    }

    vec2 baseUv = uv;
    uv = applyKaleidoscope(uv + 0.5, uKaleidoscope) - 0.5;

    vec3 col = vec3(0.0);
    float t = iTime * 0.25;

    vec2 p = uv;
    p *= rot(t * 0.15);

    float d = length(p);
    float m = sin(d * 14.0 - t * 2.5) * 0.5 + 0.5;
    m = pow(m, 2.5);

    vec3 baseColor = vec3(0.12, 0.0, 0.08);
    vec3 magenta = vec3(1.0, 0.02, 0.45);
    vec3 deepPink = vec3(0.7, 0.0, 0.35);
    vec3 shibuyaSilver = vec3(0.9, 0.85, 0.95);

    vec3 waveCol = mix(deepPink, magenta, m);
    col = mix(baseColor, waveCol, smoothstep(0.8, 0.0, d));

    float spec = pow(max(0.0, sin(p.x * 20.0 + p.y * 20.0 + t * 4.0)), 12.0);
    col += shibuyaSilver * spec * 0.45;

    if (uGridVibe > 0.01) {
      vec2 gridUv = fract(baseUv * 18.0) - 0.5;
      float gridLine = smoothstep(0.46, 0.5, max(abs(gridUv.x), abs(gridUv.y)));
      vec3 gridColor = vec3(0.0, 0.9, 1.0) * gridLine * 0.4;
      col = mix(col, col + gridColor, uGridVibe);
    }

    col = clamp(col, 0.0, 1.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// 2. Sumi-e Branch Stroke Shader
const branchVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uLength;
  attribute float aProgress;

  varying vec2 vUv;
  varying float vProgress;

  void main() {
    vUv = uv;
    vProgress = aProgress;

    vec3 pos = position;
    if (aProgress > uProgress) {
      pos = vec3(0.0);
    } else {
      float wind = sin(uTime * 1.8 + aProgress * 6.28) * 0.015 * aProgress;
      pos.x += wind;
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const branchFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uProgress;

  varying vec2 vUv;
  varying float vProgress;

  void main() {
    if (vProgress > uProgress) discard;

    float edge = sin(vUv.x * 3.14159);
    float alpha = smoothstep(0.0, 0.15, edge);

    vec3 col = mix(uColor * 0.4, uColor * 1.2, vUv.x);
    gl_FragColor = vec4(col, alpha * 0.95);
  }
`;

// ==========================================
// HELPER CLASSES & GEOMETRIES
// ==========================================

class SumieBranchStroke {
  curve: THREE.CatmullRomCurve3;
  color: THREE.Color;
  baseWidth: number;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  progress: number = 0;
  totalLength: number = 1;

  constructor(points: THREE.Vector3[], colorHex: number = 0xff0077, baseWidth: number = 0.18) {
    this.curve = new THREE.CatmullRomCurve3(points);
    this.color = new THREE.Color(colorHex);
    this.baseWidth = baseWidth;

    const tubularSegments = 120;
    const radialSegments = 12;
    const geometry = new THREE.BufferGeometry();

    const positions: number[] = [];
    const uvs: number[] = [];
    const aProgress: number[] = [];
    const indices: number[] = [];

    const curvePoints = this.curve.getSpacedPoints(tubularSegments);
    this.totalLength = this.curve.getLength();

    for (let i = 0; i <= tubularSegments; i++) {
      const p = i / tubularSegments;
      const point = curvePoints[i];
      const tangent = this.curve.getTangentAt(p);
      const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();

      const width = this.baseWidth * (1.0 - p * 0.65) * (0.8 + Math.sin(p * Math.PI * 3.0) * 0.2);

      for (let j = 0; j <= radialSegments; j++) {
        const rad = (j / radialSegments) * Math.PI * 2.0;
        const offset = normal.clone().multiplyScalar(Math.cos(rad) * width);
        offset.z += Math.sin(rad) * width * 0.5;

        positions.push(point.x + offset.x, point.y + offset.y, point.z + offset.z);
        uvs.push(j / radialSegments, p);
        aProgress.push(p);
      }
    }

    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j;
        const b = (i + 1) * (radialSegments + 1) + j;
        const c = (i + 1) * (radialSegments + 1) + (j + 1);
        const d = i * (radialSegments + 1) + (j + 1);

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('aProgress', new THREE.Float32BufferAttribute(aProgress, 1));
    geometry.setIndex(indices);

    this.material = new THREE.ShaderMaterial({
      vertexShader: branchVertexShader,
      fragmentShader: branchFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uLength: { value: this.totalLength },
        uColor: { value: this.color }
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  setProgress(p: number) {
    this.progress = THREE.MathUtils.clamp(p, 0, 1);
    this.material.uniforms.uProgress.value = this.progress;
  }

  setTime(t: number) {
    this.material.uniforms.uTime.value = t;
  }

  getPointAt(p: number): THREE.Vector3 {
    return this.curve.getPointAt(THREE.MathUtils.clamp(p, 0, 1));
  }

  getTangentAt(p: number): THREE.Vector3 {
    return this.curve.getTangentAt(THREE.MathUtils.clamp(p, 0, 1));
  }
}

// Plexus 3D Shape Node Generators
function generateShapeNodes(shapeName: string, count: number) {
  const targets: { tx: number; ty: number; tz: number; isCore?: boolean; isSurplus?: boolean }[] = [];

  if (shapeName === 'pyramide') {
    const h = 42.0;
    const b = 30.0;
    const keyVertices = [
      { tx: 0, ty: h * 0.65, tz: 0 },
      { tx: -b, ty: -h * 0.35, tz: -b },
      { tx: b, ty: -h * 0.35, tz: -b },
      { tx: b, ty: -h * 0.35, tz: b },
      { tx: -b, ty: -h * 0.35, tz: b },
      { tx: 0, ty: -h * 0.35, tz: -b },
      { tx: b, ty: -h * 0.35, tz: 0 },
      { tx: 0, ty: -h * 0.35, tz: b },
      { tx: -b, ty: -h * 0.35, tz: 0 }
    ];
    for (let i = 0; i < count; i++) {
      if (i < keyVertices.length) {
        targets.push({ ...keyVertices[i], isCore: true });
      } else {
        targets.push({ tx: 0, ty: 0, tz: 0, isSurplus: true });
      }
    }
  } else if (shapeName === 'diamant') {
    const s = 40.0;
    const keyVertices = [
      { tx: 0, ty: s, tz: 0 },
      { tx: 0, ty: -s, tz: 0 },
      { tx: s * 0.85, ty: 0, tz: 0 },
      { tx: 0, ty: 0, tz: s * 0.85 },
      { tx: -s * 0.85, ty: 0, tz: 0 },
      { tx: 0, ty: 0, tz: -s * 0.85 },
      { tx: s * 0.4, ty: s * 0.4, tz: s * 0.4 },
      { tx: -s * 0.4, ty: s * 0.4, tz: s * 0.4 },
      { tx: -s * 0.4, ty: -s * 0.4, tz: s * 0.4 },
      { tx: s * 0.4, ty: -s * 0.4, tz: s * 0.4 }
    ];
    for (let i = 0; i < count; i++) {
      if (i < keyVertices.length) {
        targets.push({ ...keyVertices[i], isCore: true });
      } else {
        targets.push({ tx: 0, ty: 0, tz: 0, isSurplus: true });
      }
    }
  } else if (shapeName === 'quadrat') {
    const c = 26.0;
    const corners = [
      { tx: -c, ty: -c, tz: -c },
      { tx: c, ty: -c, tz: -c },
      { tx: c, ty: c, tz: -c },
      { tx: -c, ty: c, tz: -c },
      { tx: -c, ty: -c, tz: c },
      { tx: c, ty: -c, tz: c },
      { tx: c, ty: c, tz: c },
      { tx: -c, ty: c, tz: c }
    ];
    const faceCenters = [
      { tx: 0, ty: 0, tz: c },
      { tx: 0, ty: 0, tz: -c },
      { tx: c, ty: 0, tz: 0 },
      { tx: -c, ty: 0, tz: 0 },
      { tx: 0, ty: c, tz: 0 },
      { tx: 0, ty: -c, tz: 0 }
    ];
    const keyVertices = [...corners, ...faceCenters];
    for (let i = 0; i < count; i++) {
      if (i < keyVertices.length) {
        targets.push({ ...keyVertices[i], isCore: true });
      } else {
        targets.push({ tx: 0, ty: 0, tz: 0, isSurplus: true });
      }
    }
  } else {
    const radius = 35.0;
    const phi = (1 + Math.sqrt(5)) / 2;
    const keyVertices = [];
    for (let i = 0; i < Math.min(12, count); i++) {
      const y = 1 - (i / 11) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y)) * radius;
      const theta = 2 * Math.PI * i / phi;
      keyVertices.push({
        tx: Math.cos(theta) * r,
        ty: y * radius,
        tz: Math.sin(theta) * r
      });
    }
    for (let i = 0; i < count; i++) {
      if (i < keyVertices.length) {
        targets.push({ ...keyVertices[i], isCore: true });
      } else {
        targets.push({ tx: 0, ty: 0, tz: 0, isSurplus: true });
      }
    }
  }
  return targets;
}

function generateRandomPlexusHoldNodes() {
  const nodes = [];
  const nodeCount = 14 + Math.floor(Math.random() * 4);
  for (let i = 0; i < nodeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 15.0 + Math.random() * 45.0;
    const heightZ = (Math.random() - 0.5) * 35.0;
    nodes.push({
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      dz: heightZ,
      freq: 0.8 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3.0
    });
  }
  return nodes;
}

interface PlexusNode {
  dx: number;
  dy: number;
  dz: number;
  freq: number;
  phase: number;
  rot: number;
  rotSpeed: number;
}

interface PlexusCluster {
  id: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  driftX: number;
  driftY: number;
  driftZ: number;
  r: number;
  g: number;
  b: number;
  nodes: PlexusNode[];
  isTransforming?: boolean;
  transformTimer?: number;
  transformDuration?: number;
  targetShapeNodes?: { tx: number; ty: number; tz: number; isCore?: boolean; isSurplus?: boolean }[];
  targetShapeName?: string;
}

// ==========================================
// MAIN SAKURA CANVAS REACT COMPONENT
// ==========================================

export function SakuraCanvas({
  intensity,
  bass,
  sendInteraction,
  onRendererReady
}: ExperienceComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // App & Artwork State
  const [activeMode, setActiveMode] = useState<'bluten' | 'plexus' | 'wald'>('bluten');
  const [frozenMode, setFrozenMode] = useState<'bluten' | 'plexus' | 'wald' | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [completedArtworksCount, setCompletedArtworksCount] = useState(0);
  const [blutenCounted, setBlutenCounted] = useState(false);
  const [plexusCounted, setPlexusCounted] = useState(false);
  const [waldCounted, setWaldCounted] = useState(false);

  const [currentPhase] = useState<'BRANCH' | 'BLOSSOM' | 'PETAL'>('BRANCH');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Refs for Animation Loop
  const activeModeRef = useRef(activeMode);
  const frozenModeRef = useRef(frozenMode);
  const isPausedRef = useRef(isPaused);

  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
  useEffect(() => { frozenModeRef.current = frozenMode; }, [frozenMode]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const markArtworkCompleted = useCallback((type: 'bluten' | 'plexus' | 'wald') => {
    if (type === 'bluten' && !blutenCounted) {
      setBlutenCounted(true);
      setCompletedArtworksCount(c => c + 1);
    } else if (type === 'plexus' && !plexusCounted) {
      setPlexusCounted(true);
      setCompletedArtworksCount(c => c + 1);
    } else if (type === 'wald' && !waldCounted) {
      setWaldCounted(true);
      setCompletedArtworksCount(c => c + 1);
    }
  }, [blutenCounted, plexusCounted, waldCounted]);

  const handleSwitchMode = useCallback((newMode: 'bluten' | 'plexus' | 'wald') => {
    if (activeModeRef.current === newMode) return;
    setFrozenMode(activeModeRef.current);
    setActiveMode(newMode);
    if (newMode === 'wald') {
      markArtworkCompleted('wald');
      showToast('🌸 Sakura Modus gestartet!');
    }
    sendInteraction('MODE_SWITCH', { mode: newMode });
  }, [markArtworkCompleted, sendInteraction, showToast]);

  const togglePause = useCallback(() => {
    setIsPaused(p => !p);
    sendInteraction('PAUSE_TOGGLE', { isPaused: !isPaused });
  }, [isPaused, sendInteraction]);

  // Main Three.js Scene Setup & Loop
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    renderer.setSize(width, height);
    renderer.autoClear = false;

    // Background Scene
    const bgScene = new THREE.Scene();
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bgUniforms = {
      iResolution: { value: new THREE.Vector3(width, height, 1) },
      iTime: { value: 0 },
      uKaleidoscope: { value: 0 },
      uGridVibe: { value: 0 },
      uRippleTime: { value: 0 },
      uRippleActive: { value: 0 }
    };
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: bgVertexShader,
      fragmentShader: bgFragmentShader,
      uniforms: bgUniforms,
      depthWrite: false,
      depthTest: false
    });
    const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bgScene.add(bgQuad);

    // Main 3D World Scene
    const mainScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(0, 0, 540);

    const strokeGroup = new THREE.Group();
    const orbGroup = new THREE.Group();
    const petalGroup = new THREE.Group();
    mainScene.add(strokeGroup);
    mainScene.add(orbGroup);
    mainScene.add(petalGroup);

    // Plexus Meshes
    const maxPlexusNodes = 300;
    const maxPlexusLines = maxPlexusNodes * maxPlexusNodes;
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPlexusLines * 3), 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxPlexusLines * 3), 3));
    const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
    const plexusLinesMesh = new THREE.LineSegments(lineGeo, lineMat);
    mainScene.add(plexusLinesMesh);

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPlexusNodes * 3), 3));
    nodeGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxPlexusNodes * 3), 3));
    nodeGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(maxPlexusNodes), 1));
    const nodeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, alpha * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false
    });
    const plexusPointsMesh = new THREE.Points(nodeGeo, nodeMat);
    mainScene.add(plexusPointsMesh);

    // Dynamic State Variables
    let animFrameId: number;
    let clock = new THREE.Clock();
    let activeAnimTime = 0;

    const activePlexusClusters: PlexusCluster[] = [];
    let isPlexusSphereActive = false;

    // Create 4 initial drifting Plexus clusters
    for (let c = 0; c < 4; c++) {
      const dirX = c % 2 === 0 ? 1 : -1;
      const dirY = c % 3 === 0 ? 1 : -1;
      activePlexusClusters.push({
        id: c + 1,
        centerX: (c - 1.5) * 140.0,
        centerY: ((c % 2) - 0.5) * 110.0,
        centerZ: (Math.random() - 0.5) * 60.0,
        driftX: (12.0 + Math.random() * 18.0) * dirX,
        driftY: (10.0 + Math.random() * 16.0) * dirY,
        driftZ: (8.0 + Math.random() * 14.0) * dirX,
        r: 0.0, g: 0.9, b: 1.0,
        nodes: generateRandomPlexusHoldNodes()
      });
    }

    // Animation Loop
    const animateLoop = () => {
      animFrameId = requestAnimationFrame(animateLoop);

      const delta = clock.getDelta();
      if (isPausedRef.current) return;

      activeAnimTime += delta;
      const totalTime = activeAnimTime;

      // 1. Background Shader Uniforms
      bgUniforms.iTime.value = totalTime;

      // 2. Mode Visibility Sync
      const showBlüten = (activeModeRef.current === 'bluten' || frozenModeRef.current === 'bluten');
      strokeGroup.visible = showBlüten;
      orbGroup.visible = showBlüten;
      petalGroup.visible = showBlüten;

      const showPlexus = (activeModeRef.current === 'plexus' || frozenModeRef.current === 'plexus' || activeModeRef.current === 'wald' || frozenModeRef.current === 'wald');
      plexusLinesMesh.visible = showPlexus;
      plexusPointsMesh.visible = showPlexus;

      // 3. Plexus Physics & Shape Transformation Loop
      if (showPlexus) {
        const allWorldNodes: { x: number; y: number; z: number; r: number; g: number; b: number; size: number; rot: number; clusterId: number }[] = [];
        const safeMarginX = 350.0;
        const safeMarginY = 220.0;

        for (let c = 0; c < activePlexusClusters.length; c++) {
          const cluster = activePlexusClusters[c];

          if (!isPlexusSphereActive) {
            cluster.centerX += cluster.driftX * delta;
            cluster.centerY += cluster.driftY * delta;
            cluster.centerZ += cluster.driftZ * delta;

            if (cluster.centerX > safeMarginX) { cluster.driftX = -Math.abs(cluster.driftX); cluster.centerX = safeMarginX; }
            else if (cluster.centerX < -safeMarginX) { cluster.driftX = Math.abs(cluster.driftX); cluster.centerX = -safeMarginX; }

            if (cluster.centerY > safeMarginY) { cluster.driftY = -Math.abs(cluster.driftY); cluster.centerY = safeMarginY; }
            else if (cluster.centerY < -safeMarginY) { cluster.driftY = Math.abs(cluster.driftY); cluster.centerY = -safeMarginY; }
          }

          let isTransformActive = false;
          let blendFactor = 0.0;
          let spinAngle = 0.0;

          if (cluster.isTransforming && cluster.targetShapeNodes) {
            cluster.transformTimer = (cluster.transformTimer || 0) + delta;
            const totalDur = cluster.transformDuration || 3.0;
            if (cluster.transformTimer >= totalDur) {
              cluster.isTransforming = false;
              cluster.transformTimer = 0.0;
            } else {
              isTransformActive = true;
              const p = cluster.transformTimer / totalDur;
              if (p < 0.16) blendFactor = p / 0.16;
              else if (p > 0.84) blendFactor = (1.0 - p) / 0.16;
              else blendFactor = 1.0;
              blendFactor = blendFactor * blendFactor * (3.0 - 2.0 * blendFactor);
              spinAngle = cluster.transformTimer * 1.8;
            }
          }

          const cosY = Math.cos(spinAngle);
          const sinY = Math.sin(spinAngle);

          for (let i = 0; i < cluster.nodes.length; i++) {
            const node = cluster.nodes[i];
            node.rot += delta * node.rotSpeed;

            let offsetDx = node.dx;
            let offsetDy = node.dy;
            let offsetDz = node.dz;
            let nodeSize = 15.0;

            if (isTransformActive && cluster.targetShapeNodes && cluster.targetShapeNodes[i]) {
              const target = cluster.targetShapeNodes[i];
              const rx = target.tx * cosY - target.tz * sinY;
              const rz = target.tx * sinY + target.tz * cosY;
              const ry = target.ty;

              offsetDx = THREE.MathUtils.lerp(node.dx, rx, blendFactor);
              offsetDy = THREE.MathUtils.lerp(node.dy, ry, blendFactor);
              offsetDz = THREE.MathUtils.lerp(node.dz, rz, blendFactor);

              if (target.isSurplus) {
                nodeSize = THREE.MathUtils.lerp(15.0, 0.0, blendFactor);
              } else {
                nodeSize = THREE.MathUtils.lerp(15.0, 18.0, blendFactor);
              }
            }

            const wobble = 1.0 - blendFactor;
            const wx = cluster.centerX + offsetDx + wobble * Math.sin(totalTime * node.freq + node.phase) * 12.0;
            const wy = cluster.centerY + offsetDy + wobble * Math.cos(totalTime * node.freq + node.phase) * 12.0;
            const wz = cluster.centerZ + offsetDz + wobble * Math.sin(totalTime * 0.9 + node.phase * 1.5) * 18.0;

            allWorldNodes.push({
              x: wx, y: wy, z: wz,
              r: cluster.r, g: cluster.g, b: cluster.b,
              size: nodeSize,
              rot: node.rot,
              clusterId: cluster.id
            });
          }
        }

        // Check BFS Graph Connection (8 Clusters -> Supernova 8-Sphere Event)
        const maxConnectDist = 95.0;
        const clusterMap = new Map<number, Set<number>>();
        for (let c = 0; c < activePlexusClusters.length; c++) {
          clusterMap.set(activePlexusClusters[c].id, new Set());
        }

        for (let i = 0; i < allWorldNodes.length; i++) {
          for (let j = i + 1; j < allWorldNodes.length; j++) {
            const nodeA = allWorldNodes[i];
            const nodeB = allWorldNodes[j];
            if (nodeA.clusterId !== nodeB.clusterId) {
              const dx = nodeA.x - nodeB.x;
              const dy = nodeA.y - nodeB.y;
              const dz = nodeA.z - nodeB.z;
              if (Math.sqrt(dx * dx + dy * dy + dz * dz) < maxConnectDist) {
                clusterMap.get(nodeA.clusterId)?.add(nodeB.clusterId);
                clusterMap.get(nodeB.clusterId)?.add(nodeA.clusterId);
              }
            }
          }
        }

        let maxConnectedSize = 0;
        const visited = new Set<number>();
        for (const [startId] of clusterMap) {
          if (!visited.has(startId)) {
            const comp = new Set<number>([startId]);
            const q = [startId];
            visited.add(startId);
            while (q.length > 0) {
              const curr = q.shift()!;
              const neighbors = clusterMap.get(curr) || [];
              for (const nId of neighbors) {
                if (!comp.has(nId)) {
                  comp.add(nId);
                  visited.add(nId);
                  q.push(nId);
                }
              }
            }
            if (comp.size > maxConnectedSize) maxConnectedSize = comp.size;
          }
        }

        if (maxConnectedSize >= 8 && !isPlexusSphereActive) {
          isPlexusSphereActive = true;
          markArtworkCompleted('plexus');
          showToast('🌟 Plexus Supernova Sphäre generiert!');
        }

        // Render Plexus Points & Lines Attributes
        const posAttr = nodeGeo.attributes.position as THREE.BufferAttribute;
        const colorAttr = nodeGeo.attributes.color as THREE.BufferAttribute;
        const sizeAttr = nodeGeo.attributes.size as THREE.BufferAttribute;

        for (let i = 0; i < allWorldNodes.length; i++) {
          const n = allWorldNodes[i];
          posAttr.setXYZ(i, n.x, n.y, n.z);
          colorAttr.setXYZ(i, n.r, n.g, n.b);
          sizeAttr.setX(i, n.size);
        }
        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
        nodeGeo.setDrawRange(0, allWorldNodes.length);

        const linePosAttr = lineGeo.attributes.position as THREE.BufferAttribute;
        const lineColAttr = lineGeo.attributes.color as THREE.BufferAttribute;
        let lineVertexIndex = 0;

        for (let i = 0; i < allWorldNodes.length; i++) {
          for (let j = i + 1; j < allWorldNodes.length; j++) {
            const nodeA = allWorldNodes[i];
            const nodeB = allWorldNodes[j];
            const dx = nodeA.x - nodeB.x;
            const dy = nodeA.y - nodeB.y;
            const dz = nodeA.z - nodeB.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < maxConnectDist && lineVertexIndex < maxPlexusLines - 2) {
              const alpha = 1.0 - dist / maxConnectDist;
              linePosAttr.setXYZ(lineVertexIndex, nodeA.x, nodeA.y, nodeA.z);
              lineColAttr.setXYZ(lineVertexIndex, nodeA.r * alpha, nodeA.g * alpha, nodeA.b * alpha);
              lineVertexIndex++;

              linePosAttr.setXYZ(lineVertexIndex, nodeB.x, nodeB.y, nodeB.z);
              lineColAttr.setXYZ(lineVertexIndex, nodeB.r * alpha, nodeB.g * alpha, nodeB.b * alpha);
              lineVertexIndex++;
            }
          }
        }
        linePosAttr.needsUpdate = true;
        lineColAttr.needsUpdate = true;
        lineGeo.setDrawRange(0, lineVertexIndex);
      }

      // Render Both Scenes
      bgRendererRender();
      mainRendererRender();
    };

    const bgRendererRender = () => {
      renderer.clear();
      renderer.render(bgScene, bgCamera);
    };

    const mainRendererRender = () => {
      renderer.clearDepth();
      renderer.render(mainScene, camera);
    };

    animateLoop();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      bgUniforms.iResolution.value.set(w, h, 1);
    };
    window.addEventListener('resize', handleResize);

    // Register Renderer API with Harness
    onRendererReady({
      start: () => {
        clock.start();
      },
      handlePeerMessage: (data) => {
        if (!data) return;
        const msg = data as unknown as Record<string, unknown>;
        if (msg.kind === 'MODE_SWITCH' && msg.mode) {
          handleSwitchMode(msg.mode as 'bluten' | 'plexus' | 'wald');
        } else if (msg.kind === 'PAUSE_TOGGLE' && typeof msg.isPaused === 'boolean') {
          setIsPaused(msg.isPaused as boolean);
        }
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameId);
      renderer.dispose();
      bgMat.dispose();
      nodeMat.dispose();
      lineMat.dispose();
      lineGeo.dispose();
      nodeGeo.dispose();
    };
  }, [onRendererReady, handleSwitchMode, markArtworkCompleted, showToast]);

  // Derived UI unlocking state
  const isSakuraUnlocked = blutenCounted && plexusCounted;
  const isCreationUnlocked = completedArtworksCount >= 3;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#08000c] select-none">
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Toast Overlay */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-6 py-2.5 rounded-full border border-pink-500/40 backdrop-blur-md shadow-[0_0_20px_rgba(255,0,119,0.3)] animate-pulse z-50 pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Glassmorphic Top Header Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl px-6 py-3 flex flex-col items-center gap-1 z-40 text-center">
        <h1 className="text-white font-medium text-sm tracking-wide uppercase">
          Art.Cube — {activeMode === 'bluten' ? 'Blüten Kunstwerk' : activeMode === 'plexus' ? 'Plexus Kunstwerk' : '🌸 Sakura Kunstwerk'}
          {isPaused && <span className="text-pink-400 font-bold ml-2">(Pausiert)</span>}
        </h1>
        <p className="text-white/70 text-xs font-light">
          {activeMode === 'bluten'
            ? currentPhase === 'BRANCH' ? 'Halte einen Knotenpunkt gedrückt & ziehe, um Äste wachsen zu lassen.' : currentPhase === 'BLOSSOM' ? 'Klicke auf Knotenpunkte, um Sakurablüten zu erzeugen.' : 'Klicke Blütenblätter an, um den Sakura-Vortex freizusetzen.'
            : activeMode === 'plexus'
              ? 'Drücke & halte 2s für neue Sternen-Cluster. Klicke freie Cluster zum Morphen in 3D-Formen.'
              : 'Verbinde Blüten & Plexus zu einem harmonischen Sakura-Kunstwerk.'}
        </p>
      </div>

      {/* Glassmorphic Bottom Control Navigation Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-xl border border-white/15 rounded-full px-5 py-2.5 shadow-2xl z-40">
        {/* Pause / Play Button */}
        <button
          onClick={togglePause}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
        >
          <span>{isPaused ? '▶️ Play' : '⏸️ Pause'}</span>
        </button>

        <div className="w-[1px] h-6 bg-white/15" />

        {/* Mode Switcher Buttons */}
        <button
          onClick={() => handleSwitchMode('bluten')}
          className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
            activeMode === 'bluten'
              ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_0_15px_rgba(255,0,119,0.5)]'
              : 'bg-white/5 hover:bg-white/10 text-white/80'
          }`}
        >
          Blüten
        </button>

        <button
          onClick={() => handleSwitchMode('plexus')}
          className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
            activeMode === 'plexus'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_15px_rgba(0,240,255,0.5)]'
              : 'bg-white/5 hover:bg-white/10 text-white/80'
          }`}
        >
          Plexus
        </button>

        <button
          onClick={() => isSakuraUnlocked && handleSwitchMode('wald')}
          disabled={!isSakuraUnlocked}
          title={isSakuraUnlocked ? '🌸 Sakura Modus ist freigeschaltet!' : 'Spiele zuerst Blüten und Plexus durch'}
          className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
            !isSakuraUnlocked
              ? 'opacity-40 cursor-not-allowed bg-white/5 text-white/40'
              : activeMode === 'wald'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          🌸 Sakura {!isSakuraUnlocked && '🔒'}
        </button>

        <div className="w-[1px] h-6 bg-white/15" />

        {/* Kunstwerk Erstellen Counter Button */}
        <button
          disabled={!isCreationUnlocked}
          className={`relative overflow-hidden px-5 py-2 rounded-full text-xs font-semibold transition-all ${
            isCreationUnlocked
              ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white shadow-[0_0_20px_rgba(255,0,119,0.6)] animate-bounce cursor-pointer'
              : 'bg-white/10 text-white/60 cursor-not-allowed'
          }`}
        >
          {/* Progress Bar Fill */}
          <div
            className="absolute inset-0 bg-white/20 transition-all duration-500"
            style={{ width: `${(completedArtworksCount / 3) * 100}%` }}
          />
          <span className="relative z-10">
            Kunstwerk erstellen {isCreationUnlocked ? '(3/3) Bereit!' : `(${completedArtworksCount}/3)`}
          </span>
        </button>
      </div>
    </div>
  );
}
