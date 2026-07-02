# Quality & Performance Standards: Optimization & Benchmarks

An interactive installation must maintain perfect fluid movement (60 FPS on desktop projections, and smooth rendering on visitor mobile controllers). Visual lag breaks the connection between physical movement and digital expression. Use this manual to audit your code.

---

## 1. Quality Standards Checklist

Before declaring an experience finished, ask yourself:
*   **"Would this impress experienced Three.js developers?"** Does it use standard templates, or does it utilize advanced rendering pipelines (MRT, WebGPU/TSL, GPGPU, fluid grids)?
*   **"Would this surprise someone who has seen many WebGL demos?"** Is the interaction model unique? Does it respond to audio frequencies in a nuanced way? Are the color palettes curated and visually satisfying?
*   *Action*: If either answer is no, iterate. Refine the physics parameters, add curl noise overlays, increase particle counts, or fine-tune the post-processing filters.

---

## 2. Performance Budgets & Rules

| Metric | Desktop / Projection PC | Mobile Controller |
| :--- | :--- | :--- |
| **Frame Rate** | 60 FPS (V-Sync locked) | 45-60 FPS |
| **Max Draw Calls** | < 80 per frame | < 30 per frame |
| **GPU Texture Sizes** | Up to 1024x1024 (floats) | Up to 256x256 (floats) |
| **Max Particle Count** | 30k to 100k (GPU computed) | 5k to 15k (GPGPU) |

---

## 3. Strict Javascript Loop Optimization (Zero Allocations)

Garbage collection (GC) triggers micro-stutters. A 10ms frame drop is visible. To prevent GC pauses, adhere to these rules in your `requestAnimationFrame` loop:
*   **Do not create objects**: Avoid `new THREE.Vector3()`, `new THREE.Color()`, or `[]` inside the animation callback.
*   **Use scratch instances**: Declare scratch variables (e.g., helper vectors and matrices) *outside* the loop or wrap them in refs, and update them using `.set()`, `.copy()`, or `.add()`.
    ```javascript
    // AVOID THIS inside loop:
    const velocity = new THREE.Vector3(dx, dy, 0);

    // PREFER THIS:
    // Outside the setup hook or as a local ref:
    const scratchVec = new THREE.Vector3();
    // Inside the loop:
    scratchVec.set(dx, dy, 0);
    ```

---

## 4. Mobile Degradation Strategy (`isMobile = true`)

The React component receives the `isMobile: boolean` property. Adapt the engine parameters dynamically:
1.  **Reduce Simulation Grid Resolution**:
    *   *Fluid*: Decrease `SIM_RES` (grid solver size) from `256` to `128`.
    *   *GPGPU*: Decrease position texture size (`TEX_SIZE`) from `128` to `64` (reduces particle count from 16,384 to 4,096).
2.  **Strip Post-Processing Passes**:
    *   Disable chromatic aberration, film grain, or custom vignette shaders on mobile.
    *   Simplify UnrealBloomPass (e.g., lower resolutions or turn it off entirely).
3.  **Simplify Geometry and Materials**:
    *   Swap complex instanced geometry (e.g., `RoundedBoxGeometry`) for simple `PlaneGeometry` or flat billboards.
    *   Swap expensive physically based materials (`MeshPhysicalMaterial`) for simpler standard materials (`MeshStandardMaterial` or flat vertex colors).
