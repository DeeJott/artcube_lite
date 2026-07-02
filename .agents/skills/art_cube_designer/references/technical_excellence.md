# Technical Excellence: Shaders, WebGPU, and Interactive Simulation

To build experiences that stand up to the scrutiny of senior graphics developers, you must write highly optimized, GPU-bound shaders and simulation code. This manual documents the exact implementations and mathematics utilized in the Art Cube workspace.

---

## 1. Shaders & GPU-Driven Computation

The project uses two rendering tracks: **WebGL (Classic)** and **WebGPU (Next-Gen)**.

### A. WebGL GPU Computation (`GPUComputationRenderer`)
For large particle systems (e.g., `mycelium`, `spectralmix`), do not update particle positions on the CPU. Use `GPUComputationRenderer` to simulate on the GPU using Floating-Point textures.
*   **Grid Texture Setup**: Store positions (`xy`), velocities (`xy`), age/life (`z`), and max-life (`w`) in `RGBA` floats.
*   **Dual DataTextures for Spawning**: Write CPU spawn inputs into `THREE.DataTexture` arrays, upload to GPU, and swap in the velocity/position shader to instantly re-initialize dead particles.
*   **Example Spawn Shader Logic (WebGL)**:
    ```glsl
    uniform sampler2D uSpawnTex; // r=active flag, g=spawn_x, b=spawn_y
    uniform sampler2D uSpawnTex2; // r=spawn_vx, g=spawn_vy, b=spawn_r, a=spawn_g
    // In shader:
    vec4 spawn = texture2D(uSpawnTex, uv);
    if (spawn.r > 0.5) {
        gl_FragColor = vec4(spawn.g, spawn.b, 0.0, uSpawnMaxAge); // Spawn new position
    } else {
        gl_FragColor = vec4(pos.xy + vel.xy, pos.z + uDelta, pos.w); // Integrate position
    }
    ```

### B. WebGPU & TSL (Three Shading Language)
The `flow` experience utilizes Three.js WebGPU nodes and TSL. When building for WebGPU:
*   Use `three/webgpu` instead of classic `three`.
*   Shaders are written in JavaScript using TSL nodes (imported from `three/tsl`).
*   **Instancing Matrix Calculation**: Use TSL math functions (`Fn`, `mat3`, `vec3`, `normalize`, `cross`) to calculate target rotations and scales dynamically in the vertex pipeline based on velocity buffers.
*   **Example TSL Vector Orientation**:
    ```javascript
    const calcLookAtMatrix = Fn(([direction]: any) => {
      const zDir = vec3(normalize(direction)).toVar();
      const up = vec3(0, 1.0, 0).toVar();
      const xDir = vec3(normalize(cross(zDir, up))).toVar();
      const yDir = vec3(normalize(cross(xDir, zDir))).toVar();
      return mat3(xDir, yDir, zDir);
    });
    ```

---

## 2. Advanced Interactive Physics

### A. Eulerian Fluid Simulation (GLSL Grid)
The `fluid` experience implements a grid-based fluid simulation. It consists of multiple render-to-texture passes:
1.  **Advection**: Moves velocity and dye density through the velocity field.
2.  **Divergence**: Computes the rate of expansion/contraction at each cell.
3.  **Pressure (Jacobi Solver)**: Iteratively solves Poisson pressure equations (use between 16 and 24 iterations for stability).
4.  **Gradient Subtraction**: Subtracts the pressure gradient from velocity to enforce incompressibility (divergence-free flow).
5.  **Vorticity Confinement**: Re-injects lost rotational energy (curl) back as an acceleration force to maintain turbulent swirls.
6.  **Buoyancy**: Adds vertical force proportional to the dye density (makes warm plumes rise).

### B. MLS-MPM Simulator (WebGPU Particle-Grid)
For realistic material physics (mud, sand, liquid), use the Moving Least Squares Material Point Method (MLS-MPM) implemented in `flow`.
*   Grid size is typically `64x64x64` or `64x64` to maintain real-time performance.
*   P2C (Particle-to-Grid) transfer accumulates mass and momentum onto grid nodes.
*   Grid velocities are updated, boundaries (walls) are enforced, and G2P (Grid-to-Particle) updates positions, velocities, and deformation gradients.

---

## 3. Rendering Pipeline & Post-Processing

### A. Selective Bloom via Multiple Render Targets (MRT)
To make glowing particles pop without creating a messy bloom that blows out the floor and walls:
*   Route a secondary texture output (`bloomIntensity` or emissive mask) alongside the standard color output.
*   In WebGL, configure `WebGLRenderTarget` attachments.
*   In WebGPU, use TSL `mrt({ output, bloomIntensity })`. Apply the bloom pass only to the parts of the scene where `bloomIntensity` is high.

### B. High-Dynamic-Range (HDR) Environments
*   For metallic and glossy objects, always provide an environment map for reflections.
*   Instead of shipping large `.hdr` assets, procedurally generate a high-intensity equirectangular skybox texture on a `Float32Array` containing a high-value artificial sun to drive specular reflections. See the environment generation logic in `FlowCanvas.tsx` for reference.

### C. Cinematic Camera Choreography
*   Do not allow visitors to freely orbit the camera. It breaks the illusion of scale.
*   Implement a cinematic camera script that gently orbits the scene's focus point over time using low-frequency sin/cos waves.
*   Synthesize mouse or touch coordinates into a subtle camera offset (parallax), making the viewport respond dynamically to the observer's viewing angle.

---

## 4. Audio Reactivity Mapping

Raw frequency data must be converted into smooth control signals using appropriate weights and decay filters.

*   **Frequency Bands**:
    *   `bass` (lows): Drives primary impulses (e.g., fluid splats, crystal scaling, gravity shifts).
    *   `mid` (vocals/instruments): Drives continuous forces (e.g., curl noise frequency, fluid swirl, color shift speed).
    *   `treble` (highs): Drives bright shimmers and tiny sparks (e.g., star glows, high-frequency particle size, bloom intensity spikes).
*   **Impulse Decays**: For beat-reactive pulses, use exponential decay filters to prevent choppy transitions:
    ```javascript
    // In update loop (dt in seconds)
    beatPulse = beatPulse * Math.pow(0.90, dt * 60.0);
    ```
