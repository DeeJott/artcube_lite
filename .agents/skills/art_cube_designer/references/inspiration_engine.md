# Inspiration Engine: Creative Categories & Mathematical Patterns

Use this library of categories, mathematical abstractions, and Three.js examples to cross-pollinate ideas and construct completely original experiences. Do not copy them outright; combine, remix, and push them to new heights.

---

## 1. Aesthetic Inspiration Categories

*   **Procedural Worlds**: Infinite landscapes built dynamically using multi-layered noise.
*   **Impossible Geometry**: M.C. Escher-like shapes, self-intersecting planes, or non-Euclidean spaces where moving in one direction returns you from another.
*   **Volumetric Portals**: Dense, glowing coordinate portals that warp and distort elements that pass through them.
*   **Kinetic Sculptures**: Mechanical-looking, repeating physical structures (e.g., wind-driven wood sculptures, hanging light matrices) simulated with physics springs.
*   **Digital Nature / Cyber-Biology**: Plants, mycelia, and vines that grow, morph, and glow procedurally, responding to the proximity of the user's hand.
*   **Light Art / Projection Mapping**: Projecting virtual shadows, lines, or neon grids that wrap around invisible 3D colliders, creating structural illusions.

---

## 2. Mathematical Recipes for Generative Art

When building custom shaders or particle simulations, implement these algorithms:

### A. Curl Noise (Velocity Fields)
Generates smooth, turbulent, non-divergent (water-like) flow vectors from a standard scalar noise function.
```glsl
// In GLSL: Approximate curl of a 2D noise field
float n = noise(pos * scale + time);
vec2 curl = vec2(
  noise(pos * scale + vec2(0.0, 3.7) + time) - n,
  n - noise(pos * scale + vec2(4.1, 0.0) - time)
);
velocity += curl * strength;
```

### B. Fractional Brownian Motion (FBM)
Adds successive octaves of noise with increasing frequencies and decreasing amplitudes. Ideal for creating realistic smoke, clouds, and terrain.
```glsl
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  // Rotate to reduce axial bias
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
  for (int i = 0; i < 5; ++i) {
    v += a * noise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}
```

### C. Signed Distance Functions (SDFs)
Define 3D geometries mathematically inside fragment shaders. Enables raymarching complex shapes (spheres, toruses, mandelbulbs) with perfect reflections, refractions, and soft shadows on the GPU.

### D. Verlet Integration
Simple, stable particle integration using previous and current coordinates. Perfect for rope physics, fabric simulations, and cloth meshes that respond to pointer forces.
```javascript
// Verlet equation
let tempX = x;
x += (x - px) * friction + ax * dt * dt;
px = tempX;
```

### E. Reaction-Diffusion
Simulates chemical patterns (like zebra stripes or coral growths) on a 2D grid texture. Run it inside a WebGL pixel shader, updating state per-frame.

---

## 3. Gold Standard References from Three.js Examples

Use these official Three.js examples as design and technical templates. You can inspect their source code on the Three.js GitHub repository:

*   **GPU Computation**:
    *   `webgl_gpgpu_water`: Shows height-field calculations in shaders.
    *   `webgl_gpgpu_birds`: Shows flocking behavior (Boids) computed entirely in parallel on GPU textures.
*   **WebGPU & Node Shaders (TSL)**:
    *   `webgpu_compute_particles`: High-performance GPU particles simulated with WebGPU compute shaders.
    *   `webgpu_mrt`: Renders to multiple targets, essential for post-processing bloom masks.
*   **Advanced Rendering Techniques**:
    *   `webgl_instancing_dynamic`: Dynamic updates for instanced mesh transforms.
    *   `webgl_postprocessing_unreal_bloom`: Classic bloom reference configuration.
    *   `webgl_materials_physical_clearcoat`: Refractive coating reflections, perfect for crystalline structures.
*   **Instanced Shards (Flow inspiration)**:
    *   `webgl_instancing_billboards`: Rendering thousands of textured particles using instanced geometry.
