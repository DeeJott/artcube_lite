# Experience Design Framework: The Creative Blueprint

To ensure every new experience meets the standards of an award-winning installation, you must run it through a rigorous design framework before writing a single line of code. For every new experience, document and resolve the following eleven design dimensions.

---

## The Eleven Design Dimensions

### 1. Emotional Goal
*   What should the visitor feel when stepping into this space?
*   *Examples*: High-tension focus, deep-ocean meditative calm, digital nature curiosity, cinematic awe, cosmic insignificance.

### 2. Interaction Model
*   How does the user's presence shape the visual world?
*   *Direct manipulation*: Pointers act as physical repellers, attractors, or fluid stirrers.
*   *Indirect trails*: Visitor movement spawns passive trails that slowly float, branch, or dissolve.
*   *Cooperative interaction*: Multiple users' touch vectors connect to form complex nets, geometry, or light channels.

### 3. Visual Language
*   What is the primary aesthetic?
*   *Abstract Geometric*: Wireframes, floating polygonal shards, sharp lines, light beams, SDF-defined shapes.
*   *Organic/Biomimetic*: Branching structures, mycelial nets, creeping vines, cell division, swirling nebulae.
*   *Volumetric*: Floating clouds, dense smoke, layered planes representing aurora sheets, foggy horizons.

### 4. Animation Language
*   How do the elements move?
*   *Fluid*: Eulerian advection, curl noise, dragging vortexes.
*   *Kinetic/Rigid*: Hard angular rotations, snapping springs, structural expansions.
*   *Particulate*: Floating dust, explosive bursts on beats, gravity-based drifting.

### 5. Color Palette
*   Specify the exact color system (limit to 3 main color accents).
*   *Example*: Dark Slate base (`0x020409`), Cyan glow (`0x00ffcc`), Purple accent (`0x7f00ff`).
*   *Rule*: Always specify a clear, non-primary gradient transition that reacts to user speed or audio intensity.

### 6. Lighting Style
*   How does light illuminate the canvas?
*   *Ambient Fog*: High fog factor to make distant items disappear into mystery.
*   *Direct Contrast*: Dynamic spotlights casting sharp shadows on back walls to add depth.
*   *Self-Emissive*: Black environment where elements glow with additive blending, emitting their own light.

### 7. Camera Movement
*   What is the camera's choreographic path?
*   *Orbiting*: Slow, low-frequency rotation around the center.
*   *Floating*: Gentle bobbing up and down.
*   *Reactive Parallax*: Shift perspective in direct proportion to visitor touch coords.

### 8. Pacing
*   What is the rhythm of the experience?
*   *Meditative*: Slow-motion drift, long lifetimes, lazy fade-outs (10-15s).
*   *Dynamic*: Rapid beat impulses, short decay times, snappy responsiveness (1-2s).

### 9. Sound Opportunities
*   How do the music frequencies map to the animation parameters?
*   *Bass*: Impulsive forces, color shifts, flashes of lights, particle bursts.
*   *Mids*: Continuous motion, noise frequency multipliers, camera speed.
*   *Treble*: Specular highlights, bloom thresholds, particle scales, high-pitched spark spawn.

### 10. Technical Implementation
*   Which graphics technologies are required?
*   *Engine*: WebGL vs WebGPU.
*   *Compute*: CPU-calculated array buffers vs GPU textures (`GPUComputationRenderer`).
*   *Materials*: Standard shaders (`ShaderMaterial`) vs node shaders (TSL).
*   *Draw Method*: Instanced meshes, Point clouds (`Points`), or connected structures (`LineSegments`).

### 11. Optimization Strategy
*   How will you protect the frame rate?
*   *Complexity constraints*: Max particle count, maximum draw calls, maximum mesh complexity.
*   *Memory bounds*: Zero object allocations inside the loop (`new THREE.Vector3()`), reusing arrays.
*   *Graceful degradation*: Decreasing simulation resolution, reducing particle counts, or disabling heavy post-processing passes (like chromatic aberration) on mobile devices.
