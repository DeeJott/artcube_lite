'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { ExperienceComponentProps } from '../../lib/experience-types';

// ==========================================
// SHADERS & TEXTURES
// ==========================================

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

// 1. Background Metallic Fluid Shader with Refraction Wave
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

// 3. Glowing Orbs & Shiny Blue Rings
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

// 4. Shining Star Particle Trails (4-Pointed Starburst Flares)
const particleTrailVertexShader = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  attribute float alpha;
  attribute float rotAngle;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;

  void main() {
    vColor = color;
    vAlpha = alpha;
    vRot = rotAngle;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (540.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleTrailFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;

  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float c = cos(vRot);
    float s = sin(vRot);
    p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);

    float d = length(p);
    if (d > 0.5) discard;

    vec2 av = abs(p);
    float starPattern = max(0.0, 1.0 - (av.x * av.y) * 550.0);
    starPattern = pow(starPattern, 3.2);

    float core = 1.0 / (1.0 + d * 12.0);
    core = pow(core, 2.2);

    vec3 finalColor = (vColor * 2.6 + vec3(1.0, 0.95, 1.0) * starPattern * 2.5) * (core + starPattern * 1.5);
    float finalAlpha = vAlpha * (core * 0.85 + starPattern * 0.95);

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

// ==========================================
// HELPER CLASSES & GEOMETRIES
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
  parentBranchInfo: { curve: THREE.CatmullRomCurve3; stroke: ImmersiveStroke; level: number; totalLength: number };
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
    parentBranchInfo: { curve: THREE.CatmullRomCurve3; stroke: ImmersiveStroke; level: number; totalLength: number },
    level: number,
    roundId: number,
    orbT: number,
    type = 'branch',
    customPos: THREE.Vector3 | null = null
  ) {
    this.basePosition = customPos ? customPos.clone() : parentBranchInfo.curve.getPointAt(orbT).clone();
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

function create2DPetalGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.18, 0.08, 0.28, 0.25, 0.22, 0.45);
  shape.bezierCurveTo(0.18, 0.58, 0.08, 0.72, -0.08, 0.85);
  shape.bezierCurveTo(-0.14, 0.82, -0.12, 0.75, -0.10, 0.68);
  shape.bezierCurveTo(-0.14, 0.52, -0.06, 0.38, -0.10, 0.22);
  shape.bezierCurveTo(-0.12, 0.12, -0.06, 0.04, 0, 0);
  return new THREE.ShapeGeometry(shape);
}

const shared2DPetalGeometry = create2DPetalGeometry();

class Floating2DPetal {
  posX: number;
  posY: number;
  baseZ: number;
  targetZ: number;
  posZ: number;
  seed: number;
  speedX: number;
  speedY: number;
  amplitudeX: number;
  amplitudeY: number;
  amplitudeZ: number;
  freqX: number;
  freqY: number;
  freqZ: number;
  phaseX: number;
  phaseY: number;
  phaseZ: number;
  age = 0.0;
  fadeInDuration = 0.8;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh;
  baseScale: number;

  constructor(petalGroup: THREE.Group, originPos: THREE.Vector3) {
    this.posX = originPos.x;
    this.posY = originPos.y;
    this.baseZ = -3.5 - Math.random() * 1.5;
    this.targetZ = 2.2 + Math.random() * 1.5;
    this.posZ = this.baseZ;

    this.seed = Math.random() * 100.0;
    this.speedX = (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.8);
    this.speedY = (Math.random() - 0.5) * 0.4;
    this.amplitudeX = 1.6 + Math.random() * 2.2;
    this.amplitudeY = 1.2 + Math.random() * 1.8;
    this.amplitudeZ = 0.8 + Math.random() * 1.2;
    this.freqX = 0.3 + Math.random() * 0.4;
    this.freqY = 0.25 + Math.random() * 0.35;
    this.freqZ = 0.4 + Math.random() * 0.5;
    this.phaseX = Math.random() * Math.PI * 2.0;
    this.phaseY = Math.random() * Math.PI * 2.0;
    this.phaseZ = Math.random() * Math.PI * 2.0;

    const pinkColors = [0xff66cc, 0xff88dd, 0xff44aa, 0xffbbee, 0xff33aa];
    const color = pinkColors[Math.floor(Math.random() * pinkColors.length)];

    this.material = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(shared2DPetalGeometry, this.material);
    this.baseScale = 0.525 + Math.random() * 0.15;
    this.mesh.scale.setScalar(this.baseScale);
    this.mesh.position.set(this.posX, this.posY, this.posZ);
    petalGroup.add(this.mesh);
  }

  update(delta: number, totalElapsedTime: number, isVortexActive: boolean) {
    this.age += delta;
    const fadeFactor = Math.min(1.0, this.age / this.fadeInDuration);
    this.material.opacity = fadeFactor * 0.92;

    if (!isVortexActive) {
      this.posX += this.speedX * delta;
      this.posY += this.speedY * delta;
    }

    if (this.posZ < this.targetZ) {
      this.posZ += 0.45 * delta;
    }

    const swayX = Math.sin(totalElapsedTime * this.freqX + this.phaseX) * this.amplitudeX;
    const swayY = Math.cos(totalElapsedTime * this.freqY + this.phaseY) * this.amplitudeY;
    const swayZ = Math.sin(totalElapsedTime * this.freqZ + this.phaseZ) * this.amplitudeZ;

    this.mesh.position.set(this.posX + swayX, this.posY + swayY, this.posZ + swayZ);
    this.mesh.rotation.x = totalElapsedTime * 0.8 + this.seed;
    this.mesh.rotation.y = totalElapsedTime * 1.2 + this.seed;
  }

  destroy(petalGroup: THREE.Group) {
    petalGroup.remove(this.mesh);
    this.material.dispose();
  }
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

  // App & Artwork Mode State
  const [activeMode, setActiveMode] = useState<'bluten' | 'plexus' | 'wald'>('bluten');
  const [frozenMode, setFrozenMode] = useState<'bluten' | 'plexus' | 'wald' | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [completedArtworksCount, setCompletedArtworksCount] = useState(0);
  const [blutenCounted, setBlutenCounted] = useState(false);
  const [plexusCounted, setPlexusCounted] = useState(false);
  const [waldCounted, setWaldCounted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Main Three.js Scene Initialization & Loop
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

    // Main Scene
    const mainScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(0, 0, 540);

    // Groups
    const strokeGroup = new THREE.Group();
    const orbGroup = new THREE.Group();
    const petalGroup = new THREE.Group();
    mainScene.add(strokeGroup);
    mainScene.add(orbGroup);
    mainScene.add(petalGroup);

    // Initial Trunk
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
    mainTrunkStroke.setProgress(1.0);

    const parentInfo = { curve: trunkCurve, stroke: mainTrunkStroke, level: 0, totalLength: trunkCurve.getLength() };
    const activeOrbs: OrbNode[] = [
      new OrbNode(orbGroup, parentInfo, 0, 1, 0.30, 'branch'),
      new OrbNode(orbGroup, parentInfo, 0, 1, 0.58, 'branch'),
      new OrbNode(orbGroup, parentInfo, 0, 1, 0.85, 'branch')
    ];
    activeOrbs.forEach(o => o.setAlpha(0.95));

    // Floating 2D Petals Collection
    const floatingPetals: Floating2DPetal[] = [];
    for (let i = 0; i < 40; i++) {
      const origin = new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8, 0);
      floatingPetals.push(new Floating2DPetal(petalGroup, origin));
    }

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

    // Animation variables
    let animFrameId: number;
    const clock = new THREE.Clock();
    let totalAnimTime = 0;

    const animateLoop = () => {
      animFrameId = requestAnimationFrame(animateLoop);
      const delta = clock.getDelta();
      if (isPausedRef.current) return;

      totalAnimTime += delta;

      // Update uniforms
      bgUniforms.iTime.value = totalAnimTime;
      mainTrunkStroke.setTime(totalAnimTime);

      // Mode visibility sync
      const showBlüten = activeModeRef.current === 'bluten' || frozenModeRef.current === 'bluten';
      strokeGroup.visible = showBlüten;
      orbGroup.visible = showBlüten;
      petalGroup.visible = showBlüten;

      const showPlexus = activeModeRef.current === 'plexus' || frozenModeRef.current === 'plexus' || activeModeRef.current === 'wald' || frozenModeRef.current === 'wald';
      plexusLinesMesh.visible = showPlexus;
      plexusPointsMesh.visible = showPlexus;

      // Update Orbs & Petals
      activeOrbs.forEach(orb => orb.update(totalAnimTime, delta));
      floatingPetals.forEach(p => p.update(delta, totalAnimTime, false));

      // Render double pass
      renderer.clear();
      renderer.render(bgScene, bgCamera);
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
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameId);
      renderer.dispose();
      bgMat.dispose();
      nodeMat.dispose();
      lineMat.dispose();
      lineGeo.dispose();
      nodeGeo.dispose();
      noiseTex.dispose();
    };
  }, [onRendererReady, handleSwitchMode, showToast]);

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
            ? 'Interactive Sakura Flow & Sumi-e Branches'
            : activeMode === 'plexus'
              ? 'Interactive Plexus Star-Cluster Constellations'
              : 'Harmonious Sakura Forest'}
        </p>
      </div>

      {/* Glassmorphic Bottom Navigation Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-xl border border-white/15 rounded-full px-5 py-2.5 shadow-2xl z-40">
        <button
          onClick={togglePause}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
        >
          <span>{isPaused ? '▶️ Play' : '⏸️ Pause'}</span>
        </button>

        <div className="w-[1px] h-6 bg-white/15" />

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

        <button
          disabled={!isCreationUnlocked}
          className={`relative overflow-hidden px-5 py-2 rounded-full text-xs font-semibold transition-all ${
            isCreationUnlocked
              ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white shadow-[0_0_20px_rgba(255,0,119,0.6)] animate-bounce cursor-pointer'
              : 'bg-white/10 text-white/60 cursor-not-allowed'
          }`}
        >
          <span className="relative z-10">
            Kunstwerk erstellen {isCreationUnlocked ? '(3/3) Bereit!' : `(${completedArtworksCount}/3)`}
          </span>
        </button>
      </div>
    </div>
  );
}
