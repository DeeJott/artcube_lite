'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { createPostProcessing } from '../../lib/three/postProcessing';
import { createCinematicCamera, updateCinematicCamera } from '../../lib/three/cinematicCamera';
import type { ExperienceComponentProps, ExperienceRendererAPI } from '../../lib/experience-types';

const ASPECT = 1920 / 1080;

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform float uTime;
  uniform float uPhase; // 0.0 to 1.0 (elapsed / duration)
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  varying vec2 vUv;

  // Simple 2D hash function
  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  // 2D Perlin-like value noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), 
                   hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), 
                   hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  // 2D Fractional Brownian Motion (fBm)
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    // Rotate matrix to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Center and scale coordinates
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= 1.777; // Aspect ratio adjustment

    // Fluid speed driven by uTime and continuous mid-frequencies
    float speed = uTime * (0.05 + uMid * 0.04);

    // Domain Warping for fluid cherry blossom movements
    // Warp 1
    vec2 q = vec2(
      fbm(p + vec2(0.0, 0.0) + speed * 0.5),
      fbm(p + vec2(5.2, 1.3) + speed * 0.4)
    );

    // Warp 2
    vec2 r = vec2(
      fbm(p + 4.0 * q + vec2(1.7, 9.2) - speed * 0.6),
      fbm(p + 4.0 * q + vec2(8.3, 2.8) + speed * 0.5)
    );

    // Warp 3 (Final noise)
    float f = fbm(p + 4.0 * r);

    // Calculate normal vectors of the noise field to create glossy metallic sheen
    float eps = 0.015;
    float f_x = fbm(p + vec2(eps, 0.0) + 4.0 * r);
    float f_y = fbm(p + vec2(0.0, eps) + 4.0 * r);
    
    float dx = (f_x - f) / eps;
    float dy = (f_y - f) / eps;

    // Normal vector. Smooth bumpiness factor scaled for realistic waves
    float bump = 0.05;
    vec3 normal = normalize(vec3(-dx * bump, -dy * bump, 1.0));

    // Light source
    vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);

    // Specular highlight calculation (Phongs gloss effect) - tighter and sharper
    float shininess = 60.0 + uTreble * 30.0;
    float specAngle = dot(normal, halfDir);
    float spec = pow(max(specAngle, 0.0), shininess);

    // Phase 1 Colors: Blooming (Even darker, extremely saturated magenta/plum)
    vec3 colA_phase1 = vec3(0.001, 0.0, 0.0005);  // Velvet black
    vec3 colB_phase1 = vec3(0.22, 0.002, 0.08);   // Dark rich Shibuya Stage magenta
    vec3 colC_phase1 = vec3(0.15, 0.005, 0.07);   // Saturated velvet rose

    // Phase 2 Colors: Peak/Vollblüte (Saturated very dark magenta, mirroring Shibuya Sakura Stage)
    vec3 colA_phase2 = vec3(0.002, 0.0, 0.001);   // Velvet black-purple
    vec3 colB_phase2 = vec3(0.38, 0.003, 0.16);   // Highly saturated rich neon-magenta
    vec3 colC_phase2 = vec3(0.24, 0.006, 0.11);   // Deep metallic cherry-pink

    // Phase 3 Colors: Wilting (Almost absolute black)
    vec3 colA_phase3 = vec3(0.0005, 0.0, 0.0003); // Pure black
    vec3 colB_phase3 = vec3(0.05, 0.008, 0.025);  // Muted darker rose
    vec3 colC_phase3 = vec3(0.03, 0.012, 0.018);  // Dusty plum-grey

    // Interpolate colors smoothly over uPhase (0.0 to 1.0)
    vec3 colA, colB, colC;
    if (uPhase < 0.5) {
      float t = smoothstep(0.0, 1.0, uPhase * 2.0);
      colA = mix(colA_phase1, colA_phase2, t);
      colB = mix(colB_phase1, colB_phase2, t);
      colC = mix(colC_phase1, colC_phase2, t);
    } else {
      float t = smoothstep(0.0, 1.0, (uPhase - 0.5) * 2.0);
      colA = mix(colA_phase2, colA_phase3, t);
      colB = mix(colB_phase2, colB_phase3, t);
      colC = mix(colC_phase2, colC_phase3, t);
    }

    // Blend the fluid layers - Lowered thresholds to expand magenta-veins across the canvas
    float contrast_f = smoothstep(0.20, 0.45, f);
    vec3 baseColor = mix(colA, colB, contrast_f);
    
    float q_blend = smoothstep(0.2, 0.6, length(q) * 0.75);
    baseColor = mix(baseColor, colC, q_blend);
    
    float r_blend = smoothstep(0.2, 0.6, r.x * 0.55);
    baseColor = mix(baseColor, colB, r_blend);

    // Metallic Chrome Reflections: High-contrast dark bands (black, deep plum, neon magenta highlights)
    float chrome = sin(normal.y * 12.0 + normal.x * 6.0) * 0.5 + 0.5;
    chrome = smoothstep(0.40, 0.60, chrome); // Sharper reflections for highly polished lacquer look

    vec3 chromeDark = vec3(0.0, 0.0, 0.0);        // Pure black reflection (dominant)
    vec3 chromeMid = vec3(0.05, 0.01, 0.03);      // Deep metallic plum
    vec3 chromeLight = vec3(0.55, 0.08, 0.32);     // Vibrant neon-magenta metallic reflection

    // Blend reflections based on chrome pattern and specular angle
    vec3 metalReflect = mix(chromeDark, chromeMid, chrome);
    metalReflect = mix(metalReflect, chromeLight, pow(max(specAngle, 0.0), 8.0) * 0.6);

    // Fresnel reflection (liquid metal effect at grazing angles)
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

    // Specular intensity rises with bass beats
    float specIntensity = 0.35 + uBass * 0.50;

    // Fade the specular sheen during wilting phase
    specIntensity *= (1.0 - smoothstep(0.6, 1.0, uPhase) * 0.85);

    // Mix base fluid color with metallic reflections in specular and fresnel regions
    float metalFactor = clamp(spec * 2.2 + fresnel * 0.45, 0.0, 1.0) * specIntensity;
    vec3 finalColor = mix(baseColor, metalReflect, metalFactor);
    
    // Add specular and fresnel metallic pink/magenta highlights glow
    finalColor += spec * vec3(0.12, 0.02, 0.07) * specIntensity;
    finalColor += fresnel * vec3(0.08, 0.01, 0.04) * specIntensity;

    // Apply gentle vignette
    float vignette = 1.0 - dot(p, p) * 0.16;
    finalColor *= clamp(vignette, 0.25, 1.0);

    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
  }
`;

export function SakuraCanvas({
  isRunning: _isRunning,
  intensity,
  bass,
  mid,
  treble,
  onCanvasesReady,
  onRendererReady,
}: ExperienceComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(0);
  const bassRef = useRef(0);
  const midRef = useRef(0);
  const trebleRef = useRef(0);
  const isStartedRef = useRef(false);
  const startTimeRef = useRef(0);

  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { bassRef.current = bass; }, [bass]);
  useEffect(() => { midRef.current = mid; }, [mid]);
  useEffect(() => { trebleRef.current = treble; }, [treble]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Helper: Create curved 3D petal geometry
    const createPetalGeometry = () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(0.12, 0.08, 0.28, 0.28, 0.28, 0.52);
      shape.bezierCurveTo(0.28, 0.72, 0.16, 0.85, 0.04, 0.90);
      shape.lineTo(0.0, 0.82);
      shape.lineTo(-0.04, 0.90);
      shape.bezierCurveTo(-0.16, 0.85, -0.28, 0.72, -0.28, 0.52);
      shape.bezierCurveTo(-0.28, 0.28, -0.12, 0.08, 0.0, 0.0);

      const extrudeSettings = {
        depth: 0.012,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.006,
        bevelThickness: 0.006
      };

      const petalGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      // Spoon curve & transverse cupping on CPU
      const posAttr = petalGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        let x = posAttr.getX(i);
        let y = posAttr.getY(i);
        let z = posAttr.getZ(i);
        let yNorm = y / 0.9;
        z += Math.sin(yNorm * Math.PI) * 0.14;
        z += (1.0 - Math.cos((x / 0.28) * Math.PI * 0.5)) * 0.07;
        posAttr.setXYZ(i, x, y, z);
      }
      petalGeo.computeVertexNormals();
      return petalGeo;
    };

    // Helper: Assemble individual blossom with petals, ovary, and filaments
    interface PetalData {
      angle: number;
      baseRotX: number;
      index: number;
      isDetached: boolean;
      vel: THREE.Vector3;
      rotVel: THREE.Vector3;
      detachTime: number;
      initialPos: THREE.Vector3;
      initialRot: THREE.Vector3;
    }

    const createBlossomGroup = (
      petalGeo: THREE.BufferGeometry,
      petalMat: THREE.Material,
      stamenCylGeo: THREE.BufferGeometry,
      filamentMat: THREE.Material,
      antherGeo: THREE.BufferGeometry,
      antherMat: THREE.Material,
      ovaryGeo: THREE.BufferGeometry,
      ovaryMat: THREE.Material
    ) => {
      const group = new THREE.Group();

      const petalsGroup = new THREE.Group();
      group.add(petalsGroup);

      const blossomPetals: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = i * ((Math.PI * 2) / 5);
        const petalPivot = new THREE.Group();
        petalPivot.rotation.z = angle;

        const petalMesh = new THREE.Mesh(petalGeo, petalMat);
        petalMesh.rotation.x = 0.28;
        petalMesh.position.y = 0.01;
        petalMesh.castShadow = true;

        petalMesh.userData = {
          angle: angle,
          baseRotX: 0.28,
          index: i,
          isDetached: false,
          vel: new THREE.Vector3(),
          rotVel: new THREE.Vector3(),
          detachTime: 0,
          initialPos: new THREE.Vector3(0, 0.01, 0),
          initialRot: new THREE.Vector3(0.28, 0, 0)
        } as PetalData;

        petalPivot.add(petalMesh);
        petalsGroup.add(petalPivot);
        blossomPetals.push(petalMesh);
      }

      // No ovary or stamen meshes are added here! Only the 5 petals in the group.
      return { group, petals: blossomPetals };

      return { group, petals: blossomPetals };
    };

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(1920, 1080, false);
    renderer.setClearColor(0x0a0108, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0108, 0.22);

    const cam = createCinematicCamera(ASPECT);

    const composer = createPostProcessing(renderer, scene, cam, {
      bloomStrength: 1.4,
      bloomRadius: 0.75,
      bloomThreshold: 0.85,
      filmIntensity: 0.08,
      chromaticAberration: true,
    });

    // Custom background shader plane
    const bgGeo = new THREE.PlaneGeometry(ASPECT * 2.5, 2.5);
    const bgUniforms = {
      uTime: { value: 0 },
      uPhase: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
    };

    const bgMat = new THREE.ShaderMaterial({
      uniforms: bgUniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthWrite: false,
    });

    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, 0, -0.2);
    scene.add(bgMesh);

    // 3D Tree and Canopy Lighting
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(2, 3, 2);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const hemisphereLight3D = new THREE.HemisphereLight(0xffc5df, 0x10020a, 0.55);
    scene.add(hemisphereLight3D);

    // 3D Tree construction (BFS Orthogonal Gitterbaum)
    const TRUNK_HEIGHT = 1.35;
    const treeGroup = new THREE.Group();
    treeGroup.position.set(0, -0.32, 0.2);
    treeGroup.scale.set(0.32, 0.32, 0.32);
    scene.add(treeGroup);

    // Trunk
    const trunkCylGeo = new THREE.CylinderGeometry(0.04, 0.05, TRUNK_HEIGHT, 16);
    trunkCylGeo.translate(0, TRUNK_HEIGHT / 2, 0);
    const trunkMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.16,
      metalness: 0.72,
      roughness: 0.1,
      clearcoat: 0.8,
      clearcoatRoughness: 0.05
    });
    const trunkMesh = new THREE.Mesh(trunkCylGeo, trunkMat);
    trunkMesh.castShadow = true;
    treeGroup.add(trunkMesh);

    // Canopy groups
    const canopyGroup = new THREE.Group();
    const ledGroup = new THREE.Group();
    const blossomsGroup = new THREE.Group();
    treeGroup.add(canopyGroup);
    treeGroup.add(ledGroup);
    treeGroup.add(blossomsGroup);

    // Grid details
    const gridSpacingX = 0.33;
    const gridSpacingY = 0.22;
    const gridSpacingZ = 0.33;

    interface GridNode {
      ix: number;
      iy: number;
      iz: number;
      pos: THREE.Vector3;
      depth: number;
      edgesCount: number;
      ledMesh?: THREE.Mesh;
    }

    interface GridEdge {
      p1: THREE.Vector3;
      p2: THREE.Vector3;
      depth: number;
      dir: THREE.Vector3;
      nodeKey: string;
      pivot?: THREE.Group;
    }

    const nodes: Record<string, GridNode> = {};
    const edges: GridEdge[] = [];
    const queue: GridNode[] = [];
    const rootKey = '0,0,0';

    nodes[rootKey] = {
      ix: 0,
      iy: 0,
      iz: 0,
      pos: new THREE.Vector3(0, TRUNK_HEIGHT, 0),
      depth: 0,
      edgesCount: 0
    };
    queue.push(nodes[rootKey]);

    const dirs = [
      { ix: 1,  iy: 0,  iz: 0 },
      { ix: -1, iy: 0,  iz: 0 },
      { ix: 0,  iy: 1,  iz: 0 },
      { ix: 0,  iy: 0,  iz: 1 },
      { ix: 0,  iy: 0,  iz: -1 }
    ];

    const isValid = (ix: number, iy: number, iz: number) => {
      if (iy < 0 || iy > 4) return false;
      let maxR = 0;
      if (iy === 0) maxR = 1;
      else if (iy === 1) maxR = 2;
      else if (iy === 2) maxR = 3;
      else if (iy === 3) maxR = 3;
      else if (iy === 4) maxR = 4;
      return Math.abs(ix) <= maxR && Math.abs(iz) <= maxR;
    };

    const maxDepth = 6;
    const visited = new Set<string>();
    visited.add(rootKey);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      const shuffledDirs = [...dirs].sort(() => Math.random() - 0.5);
      let branchesCreated = 0;

      for (const d of shuffledDirs) {
        const nix = current.ix + d.ix;
        const niy = current.iy + d.iy;
        const niz = current.iz + d.iz;
        const nkey = `${nix},${niy},${niz}`;

        if (isValid(nix, niy, niz)) {
          if (!visited.has(nkey)) {
            const newNode = {
              ix: nix,
              iy: niy,
              iz: niz,
              pos: new THREE.Vector3(nix * gridSpacingX, TRUNK_HEIGHT + niy * gridSpacingY, niz * gridSpacingZ),
              depth: current.depth + 1,
              edgesCount: 1
            };
            nodes[nkey] = newNode;
            visited.add(nkey);
            queue.push(newNode);

            edges.push({
              p1: current.pos.clone(),
              p2: newNode.pos.clone(),
              depth: current.depth,
              dir: new THREE.Vector3(d.ix, d.iy, d.iz),
              nodeKey: nkey
            });
            branchesCreated++;
            current.edgesCount++;
            if (branchesCreated >= 3) break;
          } else {
            if (Math.random() < 0.25) {
              const neighbor = nodes[nkey];
              const exists = edges.some(
                (e) =>
                  (e.p1.equals(current.pos) && e.p2.equals(neighbor.pos)) ||
                  (e.p1.equals(neighbor.pos) && e.p2.equals(current.pos))
              );
              if (!exists) {
                edges.push({
                  p1: current.pos.clone(),
                  p2: neighbor.pos.clone(),
                  depth: Math.max(current.depth, neighbor.depth),
                  dir: new THREE.Vector3(d.ix, d.iy, d.iz),
                  nodeKey: nkey
                });
              }
            }
          }
        }
      }
    }

    // Edge Rods setup
    const rodThickness = 0.016;
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xfff0f7,
      emissive: 0xff2b88,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.08
    });

    edges.forEach((edge) => {
      const pivot = new THREE.Group();
      pivot.position.copy(edge.p1);

      let rodGeo;
      if (edge.dir.x !== 0) {
        rodGeo = new THREE.BoxGeometry(gridSpacingX, rodThickness, rodThickness);
        rodGeo.translate(edge.dir.x * (gridSpacingX / 2), 0, 0);
      } else if (edge.dir.y !== 0) {
        rodGeo = new THREE.BoxGeometry(rodThickness, gridSpacingY, rodThickness);
        rodGeo.translate(0, edge.dir.y * (gridSpacingY / 2), 0);
      } else {
        rodGeo = new THREE.BoxGeometry(rodThickness, rodThickness, gridSpacingZ);
        rodGeo.translate(0, 0, edge.dir.z * (gridSpacingZ / 2));
      }

      const mesh = new THREE.Mesh(rodGeo, rodMat);
      mesh.castShadow = true;
      pivot.add(mesh);
      canopyGroup.add(pivot);
      edge.pivot = pivot;
    });

    // LED Setup
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff0066,
      emissiveIntensity: 4.0,
      roughness: 0.1
    });
    const ledGeo = new THREE.SphereGeometry(0.018, 8, 8);

    // Blossom shared elements
    const petalGeo = createPetalGeometry();
    const petalMat = new THREE.MeshPhysicalMaterial({
      color: 0xffd1df,
      emissive: 0xff5c8a,
      emissiveIntensity: 0.15,
      roughness: 0.30,
      metalness: 0.05,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      transmission: 0.25,
      thickness: 0.06,
      side: THREE.DoubleSide
    });
    const stamenCylGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4);
    stamenCylGeo.translate(0, 0.1, 0);
    const filamentMat = new THREE.MeshStandardMaterial({ color: 0xff3b9d, roughness: 0.4 });
    const antherGeo = new THREE.SphereGeometry(0.014, 4, 4);
    const antherMat = new THREE.MeshStandardMaterial({
      color: 0xfff500,
      emissive: 0xffcc00,
      emissiveIntensity: 3.5,
      roughness: 0.2
    });
    const ovaryGeo = new THREE.SphereGeometry(0.06, 6, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const ovaryMat = new THREE.MeshStandardMaterial({ color: 0x90e050, roughness: 0.5 });

    interface BlossomData {
      group: THREE.Group;
      petals: THREE.Mesh[];
      nodeKey: string;
      depth: number;
    }
    const blossomsList: BlossomData[] = [];

    // Create LEDs at joint nodes
    // Create LEDs and blossoms at joint nodes
    Object.keys(nodes).forEach((key) => {
      const node = nodes[key];

      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.copy(node.pos);
      ledMesh.visible = false; // Initial invisible, activated dynamically in animate()
      ledGroup.add(ledMesh);
      node.ledMesh = ledMesh;

      // Sprout petals from joint nodes (excluding the root node)
      if (key !== rootKey) {
        const blossom = createBlossomGroup(
          petalGeo, petalMat, stamenCylGeo, filamentMat,
          antherGeo, antherMat, ovaryGeo, ovaryMat
        );
        blossom.group.position.copy(node.pos);
        
        // Random base rotation for the group
        blossom.group.rotation.set(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5
        );
        blossom.group.scale.set(0, 0, 0); // initial scale 0
        blossomsGroup.add(blossom.group);

        blossomsList.push({
          group: blossom.group,
          petals: blossom.petals,
          nodeKey: key,
          depth: node.depth
        });
      }
    });

    onCanvasesReady(canvas, canvas);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      const phase = Math.min(1.0, elapsed / 80.0); // 80s total experience

      // Update background shader uniforms
      bgUniforms.uTime.value = elapsed;
      bgUniforms.uPhase.value = phase;
      bgUniforms.uBass.value = bassRef.current;
      bgUniforms.uMid.value = midRef.current;
      bgUniforms.uTreble.value = trebleRef.current;

      // 1. Trunk growth: 0s to 4.5s
      const trunkProgress = Math.min(1.0, elapsed / 4.5);
      trunkMesh.scale.y = trunkProgress;

      // 2. Canopy grid growth: 4.5s to 18s
      const maxEdgeDepth = edges.reduce((max, e) => Math.max(max, e.depth), 0);
      const stepDuration = (20.0 - 4.5) / (maxEdgeDepth + 1);

      edges.forEach((edge) => {
        const startTime = 4.5 + edge.depth * stepDuration;
        const endTime = startTime + stepDuration;

        if (elapsed < startTime) {
          edge.pivot!.scale.set(0, 0, 0);
        } else if (elapsed > endTime) {
          edge.pivot!.scale.set(1, 1, 1);
        } else {
          const progress = (elapsed - startTime) / stepDuration;
          if (edge.dir.x !== 0) {
            edge.pivot!.scale.set(progress, 1, 1);
          } else if (edge.dir.y !== 0) {
            edge.pivot!.scale.set(1, progress, 1);
          } else {
            edge.pivot!.scale.set(1, 1, progress);
          }
        }
      });

      // 3. LED Diodes activation
      Object.keys(nodes).forEach((key) => {
        const node = nodes[key];
        const leadingEdges = edges.filter(e => e.nodeKey === key);

        let isCompleted = false;
        if (leadingEdges.length === 0) {
          isCompleted = (elapsed >= 4.5);
        } else {
          isCompleted = leadingEdges.some(e => {
            const edgeEndTime = 4.5 + e.depth * stepDuration + stepDuration;
            return (elapsed >= edgeEndTime);
          });
        }

        node.ledMesh!.visible = isCompleted;
        if (isCompleted) {
          ((node.ledMesh!.material) as THREE.MeshStandardMaterial).emissiveIntensity = 3.0 + Math.sin(performance.now() * 0.009) * 0.8;
        }
      });
      // 4. Set blossoms group container scale (individual petals handle their own visibility)
      blossomsList.forEach((blossom) => {
        blossom.group.scale.setScalar(0.40);
      });

      // 5. Petals detaching, wind-floating & twirling: 20s to 80s
      blossomsList.forEach((blossom, bIdx) => {
        blossom.petals.forEach((petalMesh, pIdx) => {
          const data = petalMesh.userData as PetalData;
          
          // Petals start detaching/sprouting from second 20, staggered by depth and index
          const detachTime = 20.0 + blossom.depth * 1.4 + pIdx * 0.5 + Math.random() * 0.2;

          if (elapsed >= detachTime) {
            if (!data.isDetached) {
              data.isDetached = true;
              data.detachTime = detachTime;
              
              // Seed physics values (slow drift and organic tumble)
              data.vel.set(
                0.15 + Math.random() * 0.2,  // drift sideways (X)
                -0.10 - Math.random() * 0.1, // fall downwards (Y)
                (Math.random() - 0.5) * 0.1  // drift depth (Z)
              );
              data.rotVel.set(
                Math.random() * 1.5 - 0.75, // pitch speed
                Math.random() * 2.0 - 1.0,  // yaw speed
                Math.random() * 1.5 - 0.75  // roll speed
              );
            }

            const dt = elapsed - data.detachTime;
            const localScaleFactor = 1.0 / 0.32; // correct local scaling for falling physics

            // Complex wind-blown floating movement
            const windSpeedX = 0.35;
            const windSpeedY = -0.12; 
            const windSpeedZ = 0.10;

            const floatX = Math.sin(dt * 1.6 + bIdx * 0.7) * 0.22;
            const floatY = Math.cos(dt * 1.1 + bIdx * 0.5) * 0.14; 
            const floatZ = Math.sin(dt * 2.2 + bIdx * 0.3) * 0.22;

            const xOffset = (windSpeedX * dt + floatX) * localScaleFactor;
            const yOffset = (windSpeedY * dt + floatY) * localScaleFactor;
            const zOffset = (windSpeedZ * dt + floatZ) * localScaleFactor;

            petalMesh.position.set(
              data.initialPos.x + xOffset,
              data.initialPos.y + yOffset,
              data.initialPos.z + zOffset
            );

            // Leaf twirling: pitch, yaw, roll wiggles
            const pitch = data.initialRot.x + data.rotVel.x * dt + Math.sin(dt * 3.2 + bIdx) * 0.5;
            const yaw = data.rotVel.y * dt + Math.cos(dt * 2.0 + bIdx) * 0.7;
            const roll = data.rotVel.z * dt + Math.sin(dt * 3.8 + bIdx) * 0.9;

            petalMesh.rotation.set(pitch, yaw, roll);

            // Fade in at spawn, fade out at end of life (fade out starting at dt = 10s)
            let scale = 1.0;
            if (dt < 0.8) {
              scale = dt / 0.8;
            } else if (dt > 10.0) {
              scale = Math.max(0.0, 1.0 - (dt - 10.0) / 3.0);
            }
            petalMesh.scale.setScalar(scale);

          } else {
            // Invisible before spawning/detaching
            petalMesh.position.copy(data.initialPos);
            petalMesh.rotation.set(data.initialRot.x, 0, 0);
            petalMesh.scale.setScalar(0.0); // Make completely invisible before second 20
          }
        });

        // Slowly shrink and fade the remaining stamen cores in the final phase (60s to 80s)
        if (elapsed > 60.0) {
          const fadeProgress = Math.max(0.0, 1.0 - (elapsed - 60.0) / 18.0);
          blossom.group.scale.setScalar(0.40 * fadeProgress);
        }
      });;

      // Update cinematic camera
      updateCinematicCamera(cam, elapsed, 0, 0, 0.6);

      composer.render();
    };

    const api: ExperienceRendererAPI = {
      start: () => {
        isStartedRef.current = true;
        startTimeRef.current = performance.now();
        animate();
      },
    };
    onRendererReady(api);

    return () => {
      cancelAnimationFrame(rafId);
      
      // Cleanup geometries
      bgGeo.dispose();
      trunkCylGeo.dispose();
      ledGeo.dispose();
      petalGeo.dispose();
      stamenCylGeo.dispose();
      antherGeo.dispose();
      ovaryGeo.dispose();

      // Cleanup materials
      bgMat.dispose();
      trunkMat.dispose();
      rodMat.dispose();
      ledMat.dispose();
      petalMat.dispose();
      filamentMat.dispose();
      antherMat.dispose();
      ovaryMat.dispose();

      composer.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ aspectRatio: '16/9' }}
      />
    </div>
  );
}
