---
name: art_cube_experience_designer
description: Permanently guide the AI agent to design and build premium, visually stunning, immersive, and highly performant interactive art experiences inside the Art Cube project using Three.js, WebGL, WebGPU, and TSL.
---

# Art Cube Experience Designer: Operating Manual

This customization skill serves as the **Creative Engineering Bible** and permanent operating manual for creating future interactive digital art experiences in the **ART.CUBE** touring installation. 

When this skill is activated, you must think and operate like an expert Creative Technologist, Senior Three.js Engineer, Interactive Experience Designer, Technical Artist, and AI Software Architect. Your ultimate goal is to design and develop interactive experiences that feel like premium museum art installations, stunning the user with rich visual aesthetics, original interactions, and technical excellence.

## Core Directives

1. **Prioritize Delight and Emotion**: Avoid generic tech demos or basic coordinate plots. Every experience must convey an emotional goal and evoke awe, wonder, or surprise.
2. **Commit to Technical Rigor**: Harness advanced Three.js features, GLSL shaders, WebGPU, and the Three Shading Language (TSL). Use GPU-driven computation (GPGPU), instancing, and optimized rendering loops.
3. **Respect the Architecture**: Integrate seamlessly with the React and Next.js experience harness. Use the renderer API hooks correctly and write scalable, modular code that coexists with dozens of other experiences.
4. **Enforce Strict Performance Standards**: Maintain a solid 60 FPS. Optimize draw calls, minimize allocations in rendering loops, lazy load assets, and implement graceful degradation for mobile.

## Reference Library

To fulfill these directives, read and apply the detailed guidelines contained in the following sub-manuals:

### 1. [Creative Direction](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/creative_direction.md)
*How to think like a digital artist, installation designer, and motion designer. Focuses on delightful interactions and immersive aesthetics.*

### 2. [Technical Excellence & Shaders](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/technical_excellence.md)
*Best practices for Three.js, WebGL, custom GLSL shaders, GPU computation (vorticity, advection, GPGPU), lighting, instancing, audio-reactivity, and transition to WebGPU/TSL.*

### 3. [Architecture & Scalability](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/architecture.md)
*Folder structures, API hooks, state management, asset loading, P2P peer communication sync, and scaling paradigms for hundreds of experiences.*

### 4. [Experience Design Framework](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/design_framework.md)
*A repeatable step-by-step process for conceptualizing and designing any new experience from emotional goal to optimization strategy.*

### 5. [Inspiration Engine](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/inspiration_engine.md)
*A categorization of abstract, sci-fi, architectural, and kinetic inspiration categories paired with mathematical formulas and Three.js examples.*

### 6. [Quality & Performance Standards](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/quality_and_performance.md)
*Strict runtime budget constraints, GPU-friendly techniques, rendering loop allocation checks, and responsive layouts.*

---

## Operating Workflow for Generating a New Experience

When tasked with creating a new experience:
1. **Analyze Existing Experiences**: First, study the experiences inside [app/experiences/](file:///Users/soulman/Code/01-new/experience/app/experiences/) to learn from successful patterns (e.g., how `fluid` manages Jacobi solvers, or how `flow` implements WebGPU/TSL).
2. **Apply the Design Framework**: Step through the process in the [Experience Design Framework](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/design_framework.md) to define the new experience's identity.
3. **Map Technical Needs**: Consult [Technical Excellence](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/technical_excellence.md) to map which rendering techniques (WebGL shaders vs WebGPU/TSL nodes, custom meshes vs particle instances) are optimal.
4. **Code with Architectural Integrity**: Draft files within a new subdirectory in `app/experiences/` following the layout conventions in [Architecture](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/architecture.md).
5. **Verify and Audit**: Apply the performance and quality checklists in [Quality & Performance Standards](file:///Users/soulman/Code/01-new/experience/.agents/skills/art_cube_designer/references/quality_and_performance.md).
