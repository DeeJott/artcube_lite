# Architecture & Scalability: Module Design & System Integration

The Art Cube project is built on Next.js, React, and Three.js. It features a decentralized, multi-user sync model where different devices (e.g., host projections and visitor mobile controller interfaces) can experience and interact with the same digital artwork simultaneously.

---

## 1. Folder Structure

To scale to hundreds of interactive experiences, the codebase adheres to a strict component hierarchy. All experiences reside inside `app/experiences/` and export a standard descriptor structure.

```
app/
├── experiences/
│   ├── index.ts               # Manifest file registering all experience modules
│   ├── aurora/
│   │   ├── index.ts           # Module description (meta-data and React component link)
│   │   └── AuroraCanvas.tsx   # Core React Three.js / WebGPU renderer
│   ├── mycelium/
│   │   ├── index.ts
│   │   └── MyceliumCanvas.tsx
│   └── ...
├── lib/
│   ├── experience-types.ts    # Typings for the experience API and harness props
│   ├── types.ts               # Core network message and platform typings
│   ├── three/
│   │   ├── cinematicCamera.ts # Reusable camera parallax and orbiting scripts
│   │   ├── flareShader.ts     # Shared light flare shaders
│   │   └── postProcessing.ts  # Standard WebGL post-processing composer setup
│   └── canvas/
│       ├── collisions.ts      # Reusable 2D physics utilities
│       └── particles.ts       # Reusable 2D particle simulation models
```

---

## 2. Integrating with the Experience Harness

Every experience must be contained within a React component that implements the `ExperienceComponentProps` interface.

```typescript
export interface ExperienceComponentProps {
  isRunning: boolean;            // True when this experience is active on the screen
  elapsed: number;               // Total elapsed run time in seconds
  elapsedRef: MutableRefObject<number>;
  intensity: number;             // Audio intensity value (0.0 to 1.0)
  bass: number;                  // Low-freq audio energy (0.0 to 1.0)
  mid: number;                   // Mid-freq audio energy (0.0 to 1.0)
  treble: number;                // High-freq audio energy (0.0 to 1.0)
  lastBeatTime: number;          // Timestamp of the last detected beat
  isMobile: boolean;             // True if rendered on a mobile controller client
  isRecording: boolean;          // True if capturing high-res capture sequence
  isHost: boolean;               // True if this instance is running on the main cube projection PC
  myName: string;                // Name of the user controlling this instance
  sendInteraction: (kind: string, data: Record<string, unknown>) => void;
  onCanvasesReady: (flare: HTMLCanvasElement, star: HTMLCanvasElement) => void;
  onRendererReady: (api: ExperienceRendererAPI) => void;
}
```

### The Initial Setup Checklist:
1.  **Ref Refs**: Maintain local React refs of incoming audio values (`bassRef.current = bass`, etc.) in `useEffect` blocks to bypass React render cycle updates in the animation loop.
2.  **Register Canvases**: Call `onCanvasesReady(canvas, canvas)` as soon as the DOM element is bound.
3.  **Provide the Renderer API**: Call `onRendererReady(api)` exposing:
    *   `start()`: Kicks off the internal requestAnimationFrame (RAF) cycle.
    *   `handlePeerMessage(msg)`: Called when an interaction event is received from other clients over the network.
4.  **Dispose Resources**: Return a clean-up function in the core setup `useEffect` that halts the RAF loop, disposes geometries, materials, shaders, composers, and disposes the WebGL/WebGPU renderer to avoid memory leaks.

---

## 3. Interaction Sync & Multi-User State

State sync is event-driven rather than frame-replicated. Frame-replication is too heavy; instead, recreate interactions procedurally using a peer-to-peer event stream.

*   **Pointers and Gestures**: When a user touches the screen, calculate normalized coordinates (`rx`, `ry` from `0` to `1`).
*   **Emitting Actions**: Call `sendInteraction(event_name, data)` to publish the action. Keep data payloads lightweight.
    ```javascript
    sendInteraction('MY_TOUCH', { rx, ry, vx, vy });
    ```
*   **Receiving Actions**: Within the `handlePeerMessage` function of the `onRendererReady` API, extract the interaction coordinates and trigger the visual solver (e.g., spawn a particle cluster, splat fluid dye, or grow a crystal).
    ```typescript
    handlePeerMessage: (msg) => {
      const m = msg as unknown as Record<string, unknown>;
      if (m.type === 'INTERACTION' && m.kind === 'MY_TOUCH') {
        spawnCluster(m.rx as number, m.ry as number);
      }
    }
    ```

---

## 4. Asset Loading Rules

To prevent frame drops during transitions:
1.  **Prefer Procedural**: Where possible, procedurally generate noise maps, environment map textures, and decals using `THREE.DataTexture` or canvas drawings (e.g., see the skybox generation in `FlowCanvas.tsx`).
2.  **Lazy Load Assets**: Do not pre-load huge assets globally. Load geometries, models, and image assets dynamically inside the experience setup promise, using loading indicators.
3.  **Garbage Collection**: Always call `.dispose()` on all custom geometries, materials, render targets, textures, and post-processing passes when the React component unmounts.
