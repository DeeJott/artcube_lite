// Three.js flare shader for art.cube background

import * as THREE from 'three';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

// Generate random vibrant color (HSL to RGB)
export function generateRandomBaseColor(): THREE.Vector3 {
  const hue = Math.random();
  const saturation = 0.7 + Math.random() * 0.3;
  const lightness = 0.4 + Math.random() * 0.2;
  return hslToRgb(hue, saturation, lightness);
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): THREE.Vector3 {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return new THREE.Vector3(r, g, b);
}

export const flareVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const flareFragmentShader = `
  uniform float uTime;
  uniform float uAlpha;
  uniform vec2 uResolution;
  uniform vec3 uColor;
  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  #define OCTAVES 4
  float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
      value += amplitude * noise(st);
      st *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= uResolution.x / uResolution.y;
    float n1 = fbm(uv * 0.8 + uTime * 0.1);
    float n2 = fbm(uv * 1.2 - uTime * 0.08);
    vec3 baseColor = uColor;
    vec3 darkColor = vec3(0.0, 0.0, 0.0);
    float noiseVal = pow(n1 * n2 * 1.4, 1.2);
    vec3 finalColor = mix(darkColor, baseColor, noiseVal * 1.2);
    gl_FragColor = vec4(finalColor * uAlpha, 1.0);
  }
`;

export function createFlareMaterial(): THREE.ShaderMaterial {
  const randomBaseColor = generateRandomBaseColor();

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(CANVAS_WIDTH, CANVAS_HEIGHT) },
      uAlpha: { value: 0 },
      uColor: { value: randomBaseColor },
    },
    vertexShader: flareVertexShader,
    fragmentShader: flareFragmentShader,
  });
}

export function createFlareScene(): {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  material: THREE.ShaderMaterial;
} {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = createFlareMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  return { scene, camera, material };
}
