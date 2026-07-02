import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface PostProcessingOptions {
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  filmIntensity?: number;
  vignette?: boolean;
  chromaticAberration?: boolean;
}

const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uOffset: { value: 1.0 },
    uDarkness: { value: 1.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    uniform float uDarkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * uOffset;
      float vig = clamp(1.0 - dot(uv, uv) * uDarkness, 0.0, 1.0);
      gl_FragColor = vec4(texel.rgb * vig, texel.a);
    }
  `,
};

const CHROMATIC_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAmount: { value: 0.0015 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      float dist = length(dir);
      float factor = 1.0 + dist * uAmount * 100.0;
      vec2 offset = dir * uAmount * dist * 50.0;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: PostProcessingOptions = {},
): EffectComposer {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const composer = new EffectComposer(renderer);
  composer.setSize(1920, 1080);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(1920, 1080),
    options.bloomStrength ?? 1.2,
    options.bloomRadius ?? 0.6,
    options.bloomThreshold ?? 0.08,
  );
  composer.addPass(bloomPass);

  if (options.chromaticAberration) {
    const caPass = new ShaderPass(CHROMATIC_SHADER);
    composer.addPass(caPass);
  }

  const filmPass = new FilmPass(options.filmIntensity ?? 0.12, false);
  composer.addPass(filmPass);

  if (options.vignette !== false) {
    const vignettePass = new ShaderPass(VIGNETTE_SHADER);
    (vignettePass.uniforms.uOffset as { value: number }).value = 1.1;
    (vignettePass.uniforms.uDarkness as { value: number }).value = 0.8;
    composer.addPass(vignettePass);
  }

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return composer;
}
