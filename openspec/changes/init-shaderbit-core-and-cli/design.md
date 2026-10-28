# Design

## Context

See `proposal.md` for background and motivation. The project is being created as a zero-dependency GPU shader component registry (inspired by shadcn/ui and Aceternity). Modern frontends want fast, visually rich shader backgrounds without importing massive libraries like Three.js (~600KB).

## Goals / Non-Goals

**Goals:**
- Provide a zero-dependency core engine (< 5KB minified) capable of rendering fragment shaders on WebGL2 with WebGPU support and 2D Canvas/CSS procedural fallback.
- Support OffscreenCanvas rendering inside Web Workers so heavy animations run at 60fps without blocking main thread interactions.
- Implement automatic pause/resume via IntersectionObserver and Page Visibility APIs for GPU power and battery savings.
- Establish a CLI tool (`shaderbit`) that inspects the registry and injects copy-pasteable component source directly into user projects (like shadcn/ui).
- Provide modular framework adapters for React, Vue, Svelte, and vanilla Web Components.

**Non-Goals:**
- Complex 3D scene graphs, lighting models, OBJ/GLTF mesh loaders, or physics simulations (this is strictly a 2D screen-space GPU shader pipeline).
- Bundling heavy external math or matrix libraries (all screen-space math is handled by minimal inline utility helpers).

## Decisions

### Decision 1: Monorepo Structure with npm/pnpm workspaces
- **Choice**: Multi-package workspace with:
  - `packages/core`: Zero-dependency WebGL2/WebGPU pipeline, render loop, uniform manager, OffscreenCanvas bridge, intersection observer.
  - `packages/registry`: Shader catalog, GLSL fragment sources, uniform schemas, and effect presets.
  - `packages/cli`: CLI binary (`shaderbit`) for project scaffolding and component injection.
  - `packages/react`, `packages/vue`, `packages/svelte`: Framework component wrappers.
- **Rationale**: Keeps the core strictly zero runtime dependencies while allowing the CLI and registry to be independently versioned or executed via `npx shaderbit`.
- **Alternatives Considered**: Single monolithic package — rejected because users of React shouldn't carry Vue/Svelte dependencies, and CLI tools should run independently via npx.

### Decision 2: Shader Pipeline Architecture & Fallbacks
- **Choice**: A unified `ShaderPipeline` interface with three driver implementations:
  1. `WebGL2Driver`: Compiles a standard full-screen quad (2 triangles / vertex buffer), binds uniforms (`u_resolution`, `u_time`, `u_mouse`, `u_dpr`, custom floats/vectors), and runs fragment shaders.
  2. `WebGPUDriver`: Pipeline for modern browsers using WGSL with a render pass over a screen quad.
  3. `Canvas2DFallback`: Emulates basic gradients or visual noise via 2D canvas context if WebGL2 fails or is disabled by user environment.
- **Rationale**: WebGL2 is supported in >96% of browsers today, WebGPU offers cutting-edge efficiency where supported, and 2D canvas guarantees graceful degradation without breaking UI layout.

### Decision 3: CLI Code-Injection Paradigm (shadcn style)
- **Choice**: The CLI generates clean, self-contained single-file components into the user's codebase (e.g. `components/shaders/liquid-chrome.tsx`) that import either the user's local helper or embed the minimal core runner directly.
- **Rationale**: Developers want full control over their code, styling, and bundle size without depending on an opaque third-party npm runtime.

### Decision 4: OffscreenCanvas & Web Worker Bridge
- **Choice**: The core exposes an optional `worker: true` mode. When enabled and supported (`typeof OffscreenCanvas !== 'undefined'`), the canvas is transferred (`canvas.transferControlToOffscreen()`) and communicated to a dedicated inline or bundled Web Worker.
- **Rationale**: Ensures silky 60fps rendering even during heavy CPU tasks (hydration, routing, complex UI computations) on the main thread.

## Risks / Trade-offs

- **[Risk] OffscreenCanvas browser compatibility or transfer failures** → **Mitigation**: Detect `transferControlToOffscreen` support safely; gracefully fallback to main-thread WebGL2 context if unsupported or already detached.
- **[Risk] Device battery drain from continuous rendering** → **Mitigation**: Automatically stop `requestAnimationFrame` when `isIntersecting === false` or `document.hidden === true`.
- **[Risk] Complex GLSL portability between mobile and desktop GPUs** → **Mitigation**: Enforce GLSL ES 3.00 with explicit `precision highp float;` and strict precision fallback for mobile chips.
