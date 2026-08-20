'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { ExperienceComponentProps } from '../../lib/experience-types';

// ==========================================
// CONSTANTS & SHADERS
// ==========================================

const MAX_PETALS = 600;
const MAX_TRAIL_PARTICLES = 2000;
const MAX_TOTAL_NODES = 350;
const MAX_TOTAL_LINES = 1000;

function createNoiseTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const val = Math.floor(Math.random() * 256);
    data[i * 4] = val;
    data[i * 4 + 1] = val;
    data[i * 4 + 2] = val;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function generatePetalTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.filter = 'drop-shadow(0px 0px 8px rgba(255, 180, 235, 0.9))';
    const grad = ctx.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ffccf2');
    grad.addColorStop(0.7, '#ff66cc');
    grad.addColorStop(1, '#ff1a8c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.bezierCurveTo(50, 12, 60, 32, 50, 52);
    ctx.bezierCurveTo(40, 62, 24, 62, 14, 52);
    ctx.bezierCurveTo(4, 32, 14, 12, 32, 4);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// 1. Background Metallic Fluid Shader
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
  uniform sampler2D iChannel0;
  uniform float uKaleidoscope;
  uniform float uGridVibe;
  uniform float uRippleActive;
  uniform float uRippleTime;
  varying vec2 vUv;

  float noise(in vec2 x) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = texture2D(iChannel0, (p + vec2(0.5, 0.5)) / 256.0).x;
    float b = texture2D(iChannel0, (p + vec2(1.5, 0.5)) / 256.0).x;
    float c = texture2D(iChannel0, (p + vec2(0.5, 1.5)) / 256.0).x;
    float d = texture2D(iChannel0, (p + vec2(1.5, 1.5)) / 256.0).x;
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  const mat2 mtx = mat2(0.80, 0.60, -0.60, 0.80);

  float fbm(vec2 p) {
    float f = 0.0;
    f += 0.500000 * noise(p); p = mtx * p * 2.02;
    f += 0.250000 * noise(p); p = mtx * p * 2.03;
    f += 0.125000 * noise(p); p = mtx * p * 2.01;
    f += 0.062500 * noise(p); p = mtx * p * 2.04;
    f += 0.031250 * noise(p); p = mtx * p * 2.01;
    f += 0.015625 * noise(p);
    return f / 0.96875;
  }

  float pattern(in vec2 p, in float t) {
    vec2 q = vec2(fbm(p), fbm(p + vec2(10.0, 1.3)));
    vec2 r = vec2(fbm(p + 4.0 * q + vec2(t) + vec2(1.7, 9.2)), fbm(p + 4.0 * q + vec2(t) + vec2(8.3, 2.8)));
    vec2 g = vec2(fbm(p + 2.0 * r + vec2(t * 20.0) + vec2(2.0, 6.0)), fbm(p + 2.0 * r + vec2(t * 10.0) + vec2(5.0, 3.0)));
    return fbm(p + 5.5 * g + vec2(-t * 7.0));
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = fragCoord / iResolution.xy;
    
    vec2 rippleOffset = vec2(0.0);
    float waveNormal = 0.0;
    float waveFade = 0.0;

    if (uRippleActive > 0.5) {
      vec2 centerUv = uv - vec2(0.5);
      centerUv.x *= iResolution.x / iResolution.y;
      float dist = length(centerUv);

      float waveRadius = (uRippleTime / 2.0) * 1.35;
      float waveDist = abs(dist - waveRadius);

      float wavePhase = waveDist * 35.0 - uRippleTime * 10.0;
      waveNormal = cos(wavePhase) * exp(-waveDist * waveDist * 120.0);
      waveFade = smoothstep(2.0, 1.5, uRippleTime) * smoothstep(0.0, 0.1, uRippleTime);

      rippleOffset = normalize(centerUv + vec2(0.0001)) * waveNormal * 0.035 * waveFade;
    }

    vec2 distortedFragCoord = fragCoord + rippleOffset * iResolution.xy;
    vec2 distortedUv = uv + rippleOffset;

    if (uKaleidoscope > 0.001) {
      vec2 p = distortedUv - vec2(0.5);
      float r = length(p);
      float a = atan(p.y, p.x);
      float sides = 6.0;
      float tau = 6.2831853;
      a = mod(a, tau / sides);
      a = abs(a - tau / (2.0 * sides));
      vec2 kUV = vec2(cos(a), sin(a)) * r + vec2(0.5);
      distortedUv = mix(distortedUv, kUV, uKaleidoscope);
    }

    float noiseVal = pattern(distortedFragCoord * vec2(0.004), iTime * 0.007);
    
    vec3 col = mix(vec3(0.05, 0.00, 0.02), vec3(0.74, 0.00, 0.36), smoothstep(0.0, 1.0, noiseVal));
    col = mix(col, vec3(0.28, 0.00, 0.13), noiseVal * 0.8);
    col = mix(col, vec3(0.80, 0.04, 0.44), 0.35 * noiseVal);
    col = mix(col, vec3(0.48, 0.00, 0.24), smoothstep(0.0, 0.6, 0.6 * noiseVal));
    col = mix(col, vec3(0.80, 0.36, 0.62), 0.12 * noiseVal);
    
    col *= noiseVal * 1.68;

    if (uKaleidoscope > 0.001) {
      vec3 colKaleido = vec3(0.95, 0.35, 0.85) * (0.8 + 0.5 * sin(iTime * 1.5 + noiseVal * 6.28));
      col = mix(col, col * 1.35 + colKaleido * 0.4, uKaleidoscope * 0.7);
    }

    if (uGridVibe > 0.001) {
      vec2 gUV = (distortedUv - vec2(0.5)) * vec2(iResolution.x / iResolution.y, 1.0);
      vec2 gridLines = abs(fract(gUV * 18.0 - vec2(0.0, iTime * 0.5)) - 0.5);
      float lineIntensity = smoothstep(0.46, 0.5, max(gridLines.x, gridLines.y));
      float scanline = sin(gUV.y * 70.0 - iTime * 10.0) * 0.5 + 0.5;
      vec3 gridColor = vec3(1.0, 0.12, 0.70) * lineIntensity * 1.5 + vec3(0.1, 0.85, 1.0) * scanline * lineIntensity * 0.7;
      col = mix(col, col * 0.75 + gridColor, uGridVibe * 0.85);
    }

    if (uRippleActive > 0.5) {
      col += vec3(0.14, 0.08, 0.18) * waveNormal * waveFade;
    }

    col *= 0.70 + 0.65 * sqrt(70.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y));
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

// 2. Sumi-e 3D Ribbon Stroke Shaders
const sumiVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float uTime;

  void main() {
    vUv = uv;
    vPosition = position;

    float normX = clamp((position.x + 11.5) / 20.0, 0.0, 1.0);
    float mainSway = sin(uTime * 1.25) * 0.38;
    float subSway  = sin(uTime * 0.60) * 0.14;
    
    vec3 displacedPos = position;
    displacedPos.y += (mainSway + subSway) * normX;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPos, 1.0);
  }
`;

const sumiFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform vec3 uColor;
  uniform float uTotalLength;
  uniform float uProgress;

  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    float currentLength = uTotalLength * uProgress;
    if (vUv.y > currentLength) discard;

    float noiseVal = snoise(vec2(vUv.x * 30.0, vUv.y * 8.0));
    float wave = snoise(vec2(vUv.y * 2.0)) * 0.15;
    float distortedX = clamp(vUv.x + wave, 0.0, 1.0);
    float edgeBias = pow(distortedX, 2.0); 
    float threshold = mix(-1.5, 0.4, edgeBias); 
    
    float alpha = 0.95;
    float erosion = smoothstep(threshold, threshold + 0.6, noiseVal);
    alpha *= erosion;
    
    float distFromStart = vUv.y;
    float distFromEnd = currentLength - vUv.y;
    alpha *= smoothstep(0.0, 0.2, distFromStart);
    alpha *= smoothstep(0.0, 0.25, distFromEnd);

    vec3 sepiaWood = mix(vec3(1.0, 0.96, 0.90), vec3(0.78, 0.60, 0.44), erosion);
    vec3 finalColor = mix(sepiaWood, uColor, erosion);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// 3. Glowing Orbs & Ring Shaders
const orbMeshVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uAlpha;
  uniform float uTime;

  void main() {
    vec2 p = vUv - vec2(0.5);
    float r = length(p);
    float uRadius = 0.38;
    float dist = abs(r - uRadius);
    
    float thinRing = smoothstep(0.018, 0.0, dist);
    float specularGlow = exp(-dist * dist * 900.0);
    float softHalo = exp(-dist * 35.0) * 0.25;
    float totalIntensity = (thinRing * 1.8 + specularGlow * 1.4 + softHalo) * smoothstep(0.50, 0.20, r);

    if (totalIntensity < 0.005) discard;
    float pulse = 0.85 + 0.15 * sin(uTime * 6.0);
    vec3 shinyCore = vec3(0.90, 0.97, 1.0);
    vec3 cyanElectric = vec3(0.0, 0.75, 1.0);
    vec3 finalCol = mix(cyanElectric, shinyCore, specularGlow * 0.85);

    gl_FragColor = vec4(finalCol, totalIntensity * uAlpha * pulse * 0.98);
  }
`;

const orbFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uAlpha;
  uniform float uTime;
  uniform vec3 uColor;

  void main() {
    vec2 p = vUv - vec2(0.5);
    float r = length(p);
    if (r > 0.5) discard;

    float core = smoothstep(0.48, 0.0, r);
    float glow = pow(smoothstep(0.5, 0.0, r), 1.8);
    float pulse = 0.85 + 0.15 * sin(uTime * 4.5);
    vec3 col = mix(uColor, vec3(1.0, 1.0, 1.0), core * 0.85);
    
    gl_FragColor = vec4(col, (core * 0.95 + glow * 0.45) * uAlpha * pulse);
  }
`;

// 4. 4,000 Particle Trail Shaders (4-Pointed Starburst Flares)
const particleTrailVertexShader = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  attribute float rotAngle;

  varying float vAlpha;
  varying vec3 vColor;
  varying float vRotAngle;

  void main() {
    vAlpha = alpha;
    vColor = color;
    vRotAngle = rotAngle;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleTrailFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vRotAngle;

  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    
    float cosA = cos(vRotAngle);
    float sinA = sin(vRotAngle);
    vec2 rotP = vec2(
      p.x * cosA - p.y * sinA,
      p.x * sinA + p.y * cosA
    );

    float d = length(rotP);
    if (d > 0.5) discard;

    float starVal = pow(clamp(1.0 - abs(rotP.x) * 2.0, 0.0, 1.0) * clamp(1.0 - abs(rotP.y) * 2.0, 0.0, 1.0), 3.0);
    vec2 diagP = vec2(rotP.x + rotP.y, rotP.x - rotP.y) * 0.7071;
    float diagStar = pow(clamp(1.0 - abs(diagP.x) * 2.0, 0.0, 1.0) * clamp(1.0 - abs(diagP.y) * 2.0, 0.0, 1.0), 4.0);
    
    float softCore = exp(-d * d * 18.0);
    float totalIntensity = Math.max(starVal * 1.5, Math.max(diagStar * 0.8, softCore * 1.2));

    vec3 finalColor = mix(vColor, vec3(1.0, 1.0, 1.0), softCore * 0.7);
    gl_FragColor = vec4(finalColor, totalIntensity * vAlpha * 0.95);
  }
`;

// ==========================================
// HELPER CLASSES
// ==========================================

class ImmersiveStroke {
  maxPoints = 2000;
  pointCount = 0;
  points: THREE.Vector3[] = [];
  pathLength = 0;
  baseWidth: number;
  currentWidth: number;
  level: number;
  seed = Math.random();
  lengthUniform = { value: 0 };
  progressUniform = { value: 0.0 };
  timeUniform = { value: 0.0 };
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;

  constructor(sceneGroup: THREE.Group, baseWidth = 0.45, level = 0, colorHex = 0xf5e4cf) {
    this.baseWidth = baseWidth;
    this.currentWidth = baseWidth;
    this.level = level;

    this.positions = new Float32Array(this.maxPoints * 2 * 3);
    this.uvs = new Float32Array(this.maxPoints * 2 * 2);
    this.indices = new Uint16Array(this.maxPoints * 6);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: sumiVertexShader,
      fragmentShader: sumiFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(colorHex) },
        uTotalLength: this.lengthUniform,
        uProgress: this.progressUniform,
        uTime: this.timeUniform
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    sceneGroup.add(this.mesh);
  }

  addPoint(p: THREE.Vector3, widthScale = 1.0) {
    if (this.pointCount >= this.maxPoints - 1) return;

    let dir = new THREE.Vector3(0, 1, 0);
    let dist = 0.5;

    if (this.pointCount > 0) {
      const lastP = this.points[this.pointCount - 1];
      dir.subVectors(p, lastP);
      dist = dir.length();
      if (dist < 0.02) return;
      dir.normalize();
    }

    const currentPoint = p.clone();
    this.points.push(currentPoint);
    this.pathLength += dist * 0.5;

    const up = new THREE.Vector3(0, 0, 1);
    let normal = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (normal.lengthSq() < 0.001) {
      normal = new THREE.Vector3(1, 0, 0);
    }

    const normDist = Math.min(1.0, this.pathLength / 8.0);
    const pressureMod = 1.0 + 0.32 * Math.sin(normDist * Math.PI * 4.5 + this.seed * 7.0) + 0.12 * Math.cos(normDist * Math.PI * 9.0);
    const finalWidthScale = widthScale * Math.max(0.40, Math.min(1.40, pressureMod));

    const targetWidth = Math.max(0.035, this.baseWidth * finalWidthScale);
    this.currentWidth += (targetWidth - this.currentWidth) * 0.25;
    const width = this.currentWidth;

    const left = currentPoint.clone().add(normal.clone().multiplyScalar(width * 0.5));
    const right = currentPoint.clone().sub(normal.clone().multiplyScalar(width * 0.5));

    const i = this.pointCount * 6;
    this.positions[i] = left.x;
    this.positions[i + 1] = left.y;
    this.positions[i + 2] = left.z;

    this.positions[i + 3] = right.x;
    this.positions[i + 4] = right.y;
    this.positions[i + 5] = right.z;

    const u = this.pointCount * 4;
    this.uvs[u] = 0;
    this.uvs[u + 1] = this.pathLength;
    this.uvs[u + 2] = 1;
    this.uvs[u + 3] = this.pathLength;

    if (this.pointCount > 0) {
      const idx = (this.pointCount - 1) * 6;
      const vIdx = (this.pointCount - 1) * 2;
      this.indices[idx] = vIdx;
      this.indices[idx + 1] = vIdx + 1;
      this.indices[idx + 2] = vIdx + 2;
      this.indices[idx + 3] = vIdx + 1;
      this.indices[idx + 4] = vIdx + 3;
      this.indices[idx + 5] = vIdx + 2;
    }

    this.pointCount++;
    this.lengthUniform.value = this.pathLength;

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    if (this.geometry.index) this.geometry.index.needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(0, (this.pointCount - 1) * 6));
  }

  setProgress(progress: number) {
    this.progressUniform.value = progress;
  }

  setTime(t: number) {
    this.timeUniform.value = t;
  }
}

class OrbNode {
  basePosition: THREE.Vector3;
  position: THREE.Vector3;
  parentBranchInfo: { curve: THREE.CatmullRomCurve3; stroke: ImmersiveStroke; level: number; totalLength: number } | null;
  level: number;
  roundId: number;
  type: string;
  alpha = 0.0;
  active = false;
  userDrawn = false;
  seed = Math.random();
  isExploding = false;
  explosionTimer = 0.0;
  explosionDuration = 0.40;
  targetChildLength: number;
  angleRad: number;
  guideDir: THREE.Vector3;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  guideLine?: THREE.Line;

  constructor(
    orbGroup: THREE.Group,
    parentBranchInfo: { curve: THREE.CatmullRomCurve3; stroke: ImmersiveStroke; level: number; totalLength: number } | null,
    level: number,
    roundId: number,
    orbT: number,
    type = 'branch',
    customPos: THREE.Vector3 | null = null
  ) {
    this.basePosition = customPos ? customPos.clone() : (parentBranchInfo ? parentBranchInfo.curve.getPointAt(orbT).clone() : new THREE.Vector3(0, 0, 0));
    this.position = this.basePosition.clone();
    this.parentBranchInfo = parentBranchInfo;
    this.level = level;
    this.roundId = roundId;
    this.type = type;

    const parentLen = parentBranchInfo ? parentBranchInfo.totalLength : 16.0;
    this.targetChildLength = parentLen * (0.45 + Math.random() * 0.12);

    const sideSign = Math.random() > 0.5 ? 1 : -1;
    const angleDeg = sideSign * (20 + Math.random() * 20);
    this.angleRad = THREE.MathUtils.degToRad(angleDeg);
    this.guideDir = new THREE.Vector3(Math.cos(this.angleRad), Math.sin(this.angleRad), 0).normalize();

    const planeSize = this.type === 'petal' ? 1.1 : 2.2;
    const geom = new THREE.PlaneGeometry(planeSize, planeSize);

    if (this.type === 'petal') {
      this.material = new THREE.ShaderMaterial({
        vertexShader: orbMeshVertexShader,
        fragmentShader: ringFragmentShader,
        uniforms: {
          uAlpha: { value: 0.0 },
          uTime: { value: 0.0 }
        },
        transparent: true,
        depthWrite: false
      });
    } else {
      const orbColor = this.type === 'branch' ? new THREE.Color(0xffb5dc) : new THREE.Color(0xff33cc);
      this.material = new THREE.ShaderMaterial({
        vertexShader: orbMeshVertexShader,
        fragmentShader: orbFragmentShader,
        uniforms: {
          uAlpha: { value: 0.0 },
          uTime: { value: 0.0 },
          uColor: { value: orbColor }
        },
        transparent: true,
        depthWrite: false
      });
    }

    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.copy(this.position);
    this.mesh.position.z += 0.15;
    orbGroup.add(this.mesh);

    if (this.type === 'branch') {
      const lineMat = new THREE.LineDashedMaterial({
        color: 0xffffff,
        dashSize: 0.22,
        gapSize: 0.12,
        transparent: true,
        opacity: 0.0,
        depthWrite: false
      });

      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3().copy(this.guideDir).multiplyScalar(0.95)
      ]);

      this.guideLine = new THREE.Line(lineGeom, lineMat);
      this.guideLine.computeLineDistances();
      this.mesh.add(this.guideLine);
    }
  }

  triggerExplosion() {
    this.isExploding = true;
    this.userDrawn = true;
    this.explosionTimer = 0.0;
  }

  setAlpha(a: number) {
    if (!this.isExploding) {
      this.alpha = a;
      this.material.uniforms.uAlpha.value = a;
    }
    if (this.guideLine) (this.guideLine.material as THREE.LineDashedMaterial).opacity = a * 0.75;
  }

  update(time: number, delta = 0.016) {
    this.material.uniforms.uTime.value = time;
    const normX = Math.max(0.0, Math.min(1.0, (this.basePosition.x + 11.5) / 20.0));
    const mainSway = Math.sin(time * 1.25) * 0.38;
    const subSway = Math.sin(time * 0.60) * 0.14;
    const swayY = (mainSway + subSway) * normX;

    this.position.y = this.basePosition.y + swayY;
    this.mesh.position.copy(this.position);
    this.mesh.position.z += 0.15;

    if (this.isExploding) {
      this.explosionTimer += delta;
      const t = Math.min(1.0, this.explosionTimer / this.explosionDuration);
      const easeOut = 1.0 - Math.pow(1.0 - t, 3.0);
      const currentScale = 1.0 + easeOut * 2.2;
      this.mesh.scale.setScalar(currentScale);
      this.alpha = (1.0 - t) * 0.95;
      this.material.uniforms.uAlpha.value = this.alpha;

      if (t >= 1.0) {
        this.active = false;
        this.mesh.visible = false;
      }
    }
  }

  destroy(orbGroup: THREE.Group) {
    orbGroup.remove(this.mesh);
  }
}

interface SakuraCanvasProps extends ExperienceComponentProps {
  onExit?: () => void;
}

export function SakuraCanvas({
  intensity,
  bass,
  sendInteraction,
  onRendererReady,
  onExit
}: SakuraCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // App & Artwork Mode State
  const [activeMode, setActiveMode] = useState<'bluten' | 'plexus' | 'wald'>('bluten');
  const [frozenMode, setFrozenMode] = useState<'bluten' | 'plexus' | 'wald' | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [completedArtworksCount, setCompletedArtworksCount] = useState(0);
  const [blutenCounted, setBlutenCounted] = useState(false);
  const [plexusCounted, setPlexusCounted] = useState(false);
  const [waldCounted, setWaldCounted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Step-by-Step Artwork Phase Lifecycle State
  const [currentPhase, setCurrentPhase] = useState<'BRANCH' | 'BLOSSOM' | 'PETAL'>('BRANCH');
  const [currentRound, setCurrentRound] = useState(1);
  const [isTrunkGrowing, setIsTrunkGrowing] = useState(true);
  const maxRoundsPerPhase = 5;

  const activeModeRef = useRef(activeMode);
  const frozenModeRef = useRef(frozenMode);
  const isPausedRef = useRef(isPaused);

  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
  useEffect(() => { frozenModeRef.current = frozenMode; }, [frozenMode]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

  const updateCameraDistance = useCallback((w: number, h: number, mode: 'bluten' | 'plexus' | 'wald') => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    const aspect = w / h;

    if (mode === 'bluten' || mode === 'wald') {
      camera.fov = 45;
      camera.updateProjectionMatrix();
      const visibleWidth = 2 * Math.tan(THREE.MathUtils.degToRad(22.5)) * 16 * aspect;
      const targetCamX = -9.6 + (visibleWidth * 0.48);
      camera.position.set(targetCamX, -0.4, 16);
      camera.lookAt(new THREE.Vector3(targetCamX, -0.4, 0));
    } else {
      camera.fov = 60;
      camera.updateProjectionMatrix();
      const widthScale = Math.max(0.35, Math.min(1.0, w / 1440));
      const baseDist = (aspect < 1.0 ? 680 : 540) / widthScale;
      camera.position.set(0, 0, baseDist / 3.5);
      camera.lookAt(new THREE.Vector3(0, 0, 0));
    }
  }, []);

  const handleSwitchMode = useCallback((newMode: 'bluten' | 'plexus' | 'wald') => {
    if (activeModeRef.current === newMode) return;
    setFrozenMode(activeModeRef.current);
    setActiveMode(newMode);
    if (containerRef.current) {
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      updateCameraDistance(w, h, newMode);
    }
    if (newMode === 'wald') {
      markArtworkCompleted('wald');
      showToast('🌸 Sakura Modus gestartet!');
    }
    sendInteraction('MODE_SWITCH', { mode: newMode });
  }, [markArtworkCompleted, sendInteraction, showToast, updateCameraDistance]);

  const togglePause = useCallback(() => {
    setIsPaused(p => !p);
    showToast(!isPaused ? 'Session pausiert' : 'Session fortgesetzt');
    sendInteraction('PAUSE_TOGGLE', { isPaused: !isPaused });
  }, [isPaused, sendInteraction, showToast]);

  const toggleAudio = useCallback(() => {
    setIsAudioMuted(m => !m);
    showToast(!isAudioMuted ? 'Audio stummgeschaltet' : 'Audio aktiviert');
  }, [isAudioMuted, showToast]);

  const handleRestart = useCallback(() => {
    showToast('Kunstwerk zurückgesetzt — Beginn von vorn!');
    sendInteraction('RESTART_ARTWORK', {});
  }, [sendInteraction, showToast]);

  const handleExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      window.location.reload();
    }
  }, [onExit]);

  // Main Three.js Scene Setup & Native WebGL Engine
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // Renderer
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
    const noiseTex = createNoiseTexture();

    const bgUniforms = {
      iResolution: { value: new THREE.Vector3(width, height, 1) },
      iTime: { value: 0 },
      iChannel0: { value: noiseTex },
      uKaleidoscope: { value: 0.0 },
      uGridVibe: { value: 0.0 },
      uRippleActive: { value: 0.0 },
      uRippleTime: { value: 0.0 }
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

    // Main 3D Scene
    const mainScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    cameraRef.current = camera;
    updateCameraDistance(width, height, activeModeRef.current);

    // Groups
    const strokeGroup = new THREE.Group();
    const orbGroup = new THREE.Group();
    const petalGroup = new THREE.Group();
    mainScene.add(strokeGroup);
    mainScene.add(orbGroup);
    mainScene.add(petalGroup);

    // Mouse Tracking Vectors
    const mouseScreen = new THREE.Vector2(0.5, 0.5);
    const mouseWorld = new THREE.Vector3(0, 0, 0);

    // 1. Instanced Sakura Petals (600 Petals)
    const petalGeo = new THREE.PlaneGeometry(0.9, 0.9);
    const petalMat = new THREE.MeshBasicMaterial({
      map: generatePetalTexture(),
      color: new THREE.Color(1.2, 1.2, 1.2),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const instancedPetalMesh = new THREE.InstancedMesh(petalGeo, petalMat, MAX_PETALS);
    instancedPetalMesh.matrixAutoUpdate = false;
    instancedPetalMesh.visible = false; // Hidden until Petal phase!
    petalGroup.add(instancedPetalMesh);

    const petalOriginX = new Float32Array(MAX_PETALS);
    const petalOriginY = new Float32Array(MAX_PETALS);
    const petalRadiusX = new Float32Array(MAX_PETALS);
    const petalRadiusY = new Float32Array(MAX_PETALS);
    const petalSpeed = new Float32Array(MAX_PETALS);
    const petalAngle = new Float32Array(MAX_PETALS);
    const petalPhaseZ = new Float32Array(MAX_PETALS);
    const petalScales = new Float32Array(MAX_PETALS);
    const dummy = new THREE.Object3D();
    let activePetalCount = 0;

    for (let i = 0; i < MAX_PETALS; i++) {
      petalOriginX[i] = (Math.random() - 0.5) * 16.0;
      petalOriginY[i] = (Math.random() - 0.5) * 10.0;
      petalRadiusX[i] = 4.0 + Math.random() * 8.0;
      petalRadiusY[i] = 3.0 + Math.random() * 6.0;
      petalSpeed[i] = (0.2 + Math.random() * 0.4) * (i % 2 === 0 ? 1 : -1);
      petalAngle[i] = Math.random() * Math.PI * 2.0;
      petalPhaseZ[i] = Math.random() * Math.PI * 2.0;
      petalScales[i] = 0.4 + Math.random() * 0.6;
    }

    // 2. Main Trunk & Progressive Growth Lifecycle
    const startX = -11.9;
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(startX, -3.4, 0.0),
      new THREE.Vector3(startX + 2.5, -2.2, 0.25),
      new THREE.Vector3(-5.4, -2.7, -0.20),
      new THREE.Vector3(-3.4, -1.1, 0.30),
      new THREE.Vector3(-1.6, -0.4, -0.15),
      new THREE.Vector3(0.4, 0.8, 0.20),
      new THREE.Vector3(2.2, 0.1, -0.25),
      new THREE.Vector3(4.4, 0.7, 0.15),
      new THREE.Vector3(6.8, -0.4, 0.0)
    ], false, 'centripetal', 0.5);

    const mainTrunkStroke = new ImmersiveStroke(strokeGroup, 0.58, 0, 0xf5e4cf);
    const pts = trunkCurve.getSpacedPoints(140);
    for (let i = 0; i <= 140; i++) {
      const t = i / 140;
      mainTrunkStroke.addPoint(pts[i], Math.max(0.18, 1.0 - t * 0.55));
    }
    mainTrunkStroke.setProgress(0.0);

    const parentInfo = { curve: trunkCurve, stroke: mainTrunkStroke, level: 0, totalLength: trunkCurve.getLength() };
    const activeOrbs: OrbNode[] = [];
    let isTrunkGrowthFinished = false;
    let growthProgressVal = 0.0;
    const growthDurationSeconds = 6.0;

    const spawnOrbRound = (roundNum: number, phase: 'BRANCH' | 'BLOSSOM' | 'PETAL') => {
      setCurrentPhase(phase);
      setCurrentRound(roundNum);
      activeOrbs.forEach(o => o.destroy(orbGroup));
      activeOrbs.length = 0;

      const type = phase === 'PETAL' ? 'petal' : 'branch';
      const orb1 = new OrbNode(orbGroup, parentInfo, 0, roundNum, 0.30, type);
      const orb2 = new OrbNode(orbGroup, parentInfo, 0, roundNum, 0.58, type);
      const orb3 = new OrbNode(orbGroup, parentInfo, 0, roundNum, 0.85, type);
      activeOrbs.push(orb1, orb2, orb3);
      activeOrbs.forEach(o => o.setAlpha(0.95));
    };

    // 3. Particle Trail Mesh (4,000 Starburst Flares)
    const trailPositions = new Float32Array(MAX_TRAIL_PARTICLES * 3);
    const trailColors = new Float32Array(MAX_TRAIL_PARTICLES * 3);
    const trailSizes = new Float32Array(MAX_TRAIL_PARTICLES);
    const trailAlphas = new Float32Array(MAX_TRAIL_PARTICLES);
    const trailRotations = new Float32Array(MAX_TRAIL_PARTICLES);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
    trailGeo.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1));
    trailGeo.setAttribute('alpha', new THREE.BufferAttribute(trailAlphas, 1));
    trailGeo.setAttribute('rotAngle', new THREE.BufferAttribute(trailRotations, 1));

    const trailMat = new THREE.ShaderMaterial({
      vertexShader: particleTrailVertexShader,
      fragmentShader: particleTrailFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const trailPointsMesh = new THREE.Points(trailGeo, trailMat);
    mainScene.add(trailPointsMesh);

    // 4. Plexus Mesh
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TOTAL_LINES * 6), 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_TOTAL_LINES * 6), 3));
    const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
    const plexusLinesMesh = new THREE.LineSegments(lineGeo, lineMat);
    mainScene.add(plexusLinesMesh);

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TOTAL_NODES * 3), 3));
    nodeGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_TOTAL_NODES * 3), 3));
    nodeGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(MAX_TOTAL_NODES), 1));
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

    // Interactive Pointer Handlers
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      mouseScreen.x = clientX / window.innerWidth;
      mouseScreen.y = 1.0 - (clientY / window.innerHeight);

      if (cameraRef.current) {
        const vector = new THREE.Vector3(mouseScreen.x * 2 - 1, mouseScreen.y * 2 - 1, 0.5);
        vector.unproject(cameraRef.current);
        const dir = vector.sub(cameraRef.current.position).normalize();
        const dist = -cameraRef.current.position.z / dir.z;
        mouseWorld.copy(cameraRef.current.position).add(dir.multiplyScalar(dist));
      }
    };

    const handlePointerDown = () => {
      if (isPausedRef.current || !isTrunkGrowthFinished) return;

      activeOrbs.forEach(orb => {
        if (!orb.userDrawn && mouseWorld.distanceTo(orb.position) < 2.5) {
          orb.triggerExplosion();

          if (currentPhase === 'PETAL') {
            instancedPetalMesh.visible = true;
            activePetalCount = Math.min(MAX_PETALS, activePetalCount + 120);
          }

          markArtworkCompleted('bluten');
          showToast('🌸 Interaktiver Knotenpunkt aktiviert!');
        }
      });
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerMove);

    // Animation Loop
    let animFrameId: number;
    const clock = new THREE.Clock();
    let totalAnimTime = 0;

    const animateLoop = () => {
      animFrameId = requestAnimationFrame(animateLoop);
      const delta = Math.min(clock.getDelta(), 0.1);
      if (isPausedRef.current) return;

      totalAnimTime += delta;

      // Update uniforms
      bgUniforms.iTime.value = totalAnimTime;
      mainTrunkStroke.setTime(totalAnimTime);

      // Step-by-Step Trunk Growth Animation (0.0 -> 1.0 over 6 seconds)
      if (!isTrunkGrowthFinished) {
        growthProgressVal += delta / growthDurationSeconds;
        if (growthProgressVal >= 1.0) {
          growthProgressVal = 1.0;
          isTrunkGrowthFinished = true;
          setIsTrunkGrowing(false);
          spawnOrbRound(1, 'BRANCH');
          showToast('🌱 Astphase gestartet — Klicke die Knotenpunkte!');
        }
        mainTrunkStroke.setProgress(growthProgressVal);
      }

      // Visibility sync
      const showBlüten = activeModeRef.current === 'bluten' || frozenModeRef.current === 'bluten';
      strokeGroup.visible = showBlüten;
      orbGroup.visible = showBlüten;
      petalGroup.visible = showBlüten;

      const showPlexus = activeModeRef.current === 'plexus' || frozenModeRef.current === 'plexus' || activeModeRef.current === 'wald' || frozenModeRef.current === 'wald';
      plexusLinesMesh.visible = showPlexus;
      plexusPointsMesh.visible = showPlexus;

      // Update Instanced Petals
      if (showBlüten && instancedPetalMesh.visible) {
        const renderPetals = Math.min(MAX_PETALS, activePetalCount);
        for (let i = 0; i < renderPetals; i++) {
          petalAngle[i] += petalSpeed[i] * delta;
          const a = petalAngle[i];
          const px = petalOriginX[i] + Math.cos(a) * petalRadiusX[i];
          const py = petalOriginY[i] + Math.sin(a * 0.8) * petalRadiusY[i];
          const pz = Math.sin(totalAnimTime * 1.5 + petalPhaseZ[i]) * 1.5;

          dummy.position.set(px, py, pz);
          dummy.rotation.set(totalAnimTime * 0.5 + i, totalAnimTime * 0.7 + i, a);
          dummy.scale.setScalar(petalScales[i]);
          dummy.updateMatrix();
          instancedPetalMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedPetalMesh.instanceMatrix.needsUpdate = true;
      }

      // Update Orbs
      activeOrbs.forEach(orb => orb.update(totalAnimTime, delta));

      // Render dual pass
      renderer.clear();
      renderer.render(bgScene, bgCamera);
      renderer.clearDepth();
      renderer.render(mainScene, camera);
    };

    animateLoop();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      updateCameraDistance(w, h, activeModeRef.current);
      renderer.setSize(w, h);
      bgUniforms.iResolution.value.set(w, h, 1);
    };
    window.addEventListener('resize', handleResize);

    // Register API
    onRendererReady({
      start: () => clock.start(),
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
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameId);
      renderer.dispose();
      bgMat.dispose();
      nodeMat.dispose();
      lineMat.dispose();
      lineGeo.dispose();
      nodeGeo.dispose();
      petalMat.dispose();
      petalGeo.dispose();
      trailMat.dispose();
      trailGeo.dispose();
      noiseTex.dispose();
    };
  }, [onRendererReady, handleSwitchMode, markArtworkCompleted, showToast, updateCameraDistance]);

  const isSakuraUnlocked = blutenCounted && plexusCounted;
  const isCreationUnlocked = completedArtworksCount >= 3;

  // Dynamic Instruction Text Calculation based on step-by-step phase
  const instructionTitle = isTrunkGrowing
    ? 'Stammwuchs (Initialisierung)'
    : activeMode === 'bluten'
      ? `Sumi-e Blütenkunst (${currentPhase} - Runde ${currentRound}/${maxRoundsPerPhase})`
      : activeMode === 'plexus'
        ? 'Plexus Konstellation'
        : '🌸 Sakura Kunstwerk';

  const instructionBody = isTrunkGrowing
    ? 'Der Stamm wächst heran... Lehne dich zurück und beobachte den Wuchs.'
    : activeMode === 'bluten'
      ? currentPhase === 'BRANCH'
        ? 'Halte an einem Knotenpunkt die Maus gedrückt und ziehe entlang der Hilfslinie, um einen weiteren Ast wachsen zu lassen.'
        : currentPhase === 'BLOSSOM'
          ? 'Drücke auf einen Knotenpunkt, um Sakurablüten zu erzeugen.'
          : 'Klicke auf die Blüten, um das Kunstwerk mit Blütenblättern zu füllen.'
      : activeMode === 'plexus'
        ? 'Bewege deine Maus/Touch, um leuchtende Partikel-Knoten und Energielinien zu verbinden.'
        : 'Harmonischer Sakura-Wald. Verbinde Blüten & Plexus zu einem Gesamtkunstwerk.';

  return (
    <div ref={containerRef} className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#08000c] select-none z-0">
      {/* Three.js Fullscreen Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block cursor-pointer" />

      {/* Toast Notification Message */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-[#120c1c]/90 text-white text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full border border-[#4ee2ec]/60 backdrop-blur-md shadow-[0_8px_25px_rgba(0,0,0,0.5)] animate-pulse z-50 pointer-events-none uppercase">
          {toastMessage}
        </div>
      )}

      {/* Modern 4-Corner Glassmorphic HUD Layer */}
      <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none z-40">
        
        {/* TOP BAR: Instruction Box (Left) & Control Buttons (Right) */}
        <div className="flex justify-between items-start w-full">
          {/* Top Left: Dynamic Instruction Box */}
          <div className="pointer-events-auto flex flex-col gap-1.5 p-4 bg-[#120c1c]/85 backdrop-blur-md border border-[#ff69b4]/40 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.4)] max-w-[440px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff2a9d] shadow-[0_0_10px_#ff2a9d] animate-ping" />
              <span className="text-[11px] font-bold tracking-[2px] uppercase text-[#ffb4dc]/95">
                {instructionTitle} {isPaused && '(Pausiert)'}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-white/90 font-normal">
              {instructionBody}
            </p>
          </div>

          {/* Top Right: Sound, Pause, Restart & EXIT Control Buttons */}
          <div className="pointer-events-auto flex items-center gap-2.5">
            <button
              onClick={toggleAudio}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#120c1c]/85 backdrop-blur-md border border-[#ff69b4]/40 hover:border-[#ff2a9d] hover:bg-[#ff2a9d]/30 text-white text-[11px] font-semibold tracking-[1.5px] uppercase rounded-full shadow-lg transition-all"
            >
              <span>{isAudioMuted ? '🔇' : '🎵'}</span>
              <span>{isAudioMuted ? 'Sound OFF' : 'Sound ON'}</span>
            </button>

            <button
              onClick={togglePause}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#120c1c]/85 backdrop-blur-md border border-[#ff69b4]/40 hover:border-[#ff2a9d] hover:bg-[#ff2a9d]/30 text-white text-[11px] font-semibold tracking-[1.5px] uppercase rounded-full shadow-lg transition-all"
            >
              <span>{isPaused ? '▶️' : '⏸️'}</span>
              <span>{isPaused ? 'Play' : 'Pause'}</span>
            </button>

            <button
              onClick={handleRestart}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#120c1c]/85 backdrop-blur-md border border-[#ff69b4]/40 hover:border-[#ff2a9d] hover:bg-[#ff2a9d]/30 text-white text-[11px] font-semibold tracking-[1.5px] uppercase rounded-full shadow-lg transition-all"
            >
              <span>🔄</span>
              <span>Restart</span>
            </button>

            <button
              onClick={handleExit}
              className="inline-flex items-center gap-2 px-4.5 py-2 bg-gradient-to-r from-pink-500/80 to-rose-600/80 hover:from-pink-500 hover:to-rose-600 backdrop-blur-md border border-pink-400/60 text-white text-[11px] font-bold tracking-[1.5px] uppercase rounded-full shadow-[0_0_15px_rgba(255,42,157,0.4)] transition-all cursor-pointer"
              title="Zurück zur Startseite"
            >
              <span>🚪</span>
              <span>Exit</span>
            </button>
          </div>
        </div>

        {/* BOTTOM BAR: Brand Title (Left), Mode Selector (Center), Action Button (Right) */}
        <div className="flex justify-between items-end w-full">
          {/* Bottom Left: Brand Title */}
          <div className="flex flex-col gap-1 select-none">
            <h1 className="text-2xl font-bold tracking-[4px] uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-[#ff80df] to-[#ff2a9d] drop-shadow-[0_0_20px_rgba(255,42,157,0.7)]">
              Sakura: Reborn
            </h1>
            <p className="text-[11px] font-medium tracking-[2.5px] uppercase text-[#ffc8eb]/75">
              Collaborative Artwork Experience
            </p>
          </div>

          {/* Bottom Center: Mode Selector */}
          <div className="pointer-events-auto flex flex-col gap-1.5 items-center">
            <span className="text-[10px] font-semibold tracking-[2px] uppercase text-[#ffb4dc]/70">
              Artwork Mode
            </span>
            <div className="flex gap-2 p-1.5 bg-[#120c1c]/85 backdrop-blur-md border border-[#ff69b4]/30 rounded-full shadow-xl">
              <button
                onClick={() => handleSwitchMode('bluten')}
                className={`px-4.5 py-2 rounded-full text-xs font-semibold tracking-[1.5px] uppercase transition-all ${
                  activeMode === 'bluten'
                    ? 'bg-gradient-to-r from-[#ff2a9d]/80 to-[#120c1c]/90 text-white border border-[#ffb4dc]/80 shadow-[0_0_15px_rgba(255,42,157,0.5)]'
                    : 'text-[#ffc8eb]/60 hover:text-white hover:bg-[#ff69b4]/20'
                }`}
              >
                Blüten
              </button>

              <button
                onClick={() => handleSwitchMode('plexus')}
                className={`px-4.5 py-2 rounded-full text-xs font-semibold tracking-[1.5px] uppercase transition-all ${
                  activeMode === 'plexus'
                    ? 'bg-gradient-to-r from-[#00f0ff]/80 to-[#120c1c]/90 text-white border border-[#4ee2ec]/80 shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                    : 'text-[#ffc8eb]/60 hover:text-white hover:bg-[#ff69b4]/20'
                }`}
              >
                Plexus
              </button>

              <button
                onClick={() => isSakuraUnlocked && handleSwitchMode('wald')}
                disabled={!isSakuraUnlocked}
                title={isSakuraUnlocked ? '🌸 Sakura Modus ist bereit!' : 'Spiele zuerst Blüten und Plexus durch'}
                className={`px-4.5 py-2 rounded-full text-xs font-semibold tracking-[1.5px] uppercase transition-all ${
                  !isSakuraUnlocked
                    ? 'opacity-35 cursor-not-allowed text-[#ffc8eb]/40'
                    : activeMode === 'wald'
                      ? 'bg-gradient-to-r from-[#a855f7]/80 to-[#120c1c]/90 text-white border border-[#4ee2ec]/80 shadow-[0_0_22px_rgba(78,226,236,0.8)]'
                      : 'text-[#4ee2ec] border border-[#4ee2ec]/80 hover:bg-[#4ee2ec]/20'
                }`}
              >
                Sakura {!isSakuraUnlocked && '🔒'}
              </button>
            </div>
          </div>

          {/* Bottom Right: Creation Action Button */}
          <div className="pointer-events-auto">
            <button
              disabled={!isCreationUnlocked}
              onClick={handleRestart}
              className={`relative overflow-hidden px-9 py-4 rounded-full text-xs font-semibold tracking-[2px] uppercase transition-all shadow-2xl flex items-center gap-2.5 ${
                isCreationUnlocked
                  ? 'bg-gradient-to-r from-[#ff2a9d]/55 to-[#4ee2ec]/30 text-white border border-[#4ee2ec] shadow-[0_12px_35px_rgba(255,42,157,0.4)] animate-bounce cursor-pointer'
                  : 'bg-[#120c1c]/85 text-white/50 border border-[#ff69b4]/30 cursor-not-allowed'
              }`}
            >
              {/* Progress Bar Fill */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#ff2a9d]/25 to-[#4ee2ec]/25 transition-all duration-300 pointer-events-none"
                style={{ width: `${(completedArtworksCount / 3) * 100}%` }}
              />
              <span className="relative z-10 font-mono text-[11px] px-2 py-0.5 bg-white/10 rounded-full text-white/70">
                {isCreationUnlocked ? '(3/3) Bereit!' : `(${completedArtworksCount}/3)`}
              </span>
              <span className="relative z-10">
                Kunstwerk erstellen
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
