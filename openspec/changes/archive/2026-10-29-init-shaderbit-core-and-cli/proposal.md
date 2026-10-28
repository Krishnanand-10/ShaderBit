# Proposal

## Why

Modern landing pages and creative web apps increasingly demand GPU-accelerated visual effects (mesh gradients, caustics, laser beams, liquid chrome, interactive noise), but developers face severe bundle bloat from heavyweight 3D libraries (e.g., Three.js at ~600KB) and extreme mathematical complexity when attempting raw GLSL/WGSL integration. ShaderBit provides a lightweight, zero-dependency, headless GPU shader component registry (inspired by shadcn/ui and Aceternity) where every effect is self-contained (< 5KB), runs on WebGL2/WebGPU with 2D Canvas/CSS fallbacks, supports OffscreenCanvas workers, and can be installed directly into user projects via a CLI tool.

## What Changes

- Initialize the ShaderBit project architecture as a modular monorepo (or clean multi-package workspace) containing:
  - `@shaderbit/core`: Zero-dependency headless GPU pipeline supporting WebGL2 and WebGPU, render loop management, uniform binding, mouse/pointer normalized events, OffscreenCanvas/Worker support, and IntersectionObserver/Page Visibility API power-saving.
  - `@shaderbit/registry`: The component registry definition and built-in library of starter shader effects (Liquid Chrome, Mesh Gradient, Interactive Noise, Caustics) formatted as standalone components.
  - `@shaderbit/cli`: Interactive and command-line tool (`npx shaderbit add <effect>` / `shaderbit init`) to inject shader code, uniforms, and framework component wrappers directly into the developer's codebase.
  - Framework wrappers: React, Vue, Svelte, and vanilla Web Components adapters.
- Set up build tooling, TypeScript configurations, automated tests, and documentation.

## Capabilities

### New Capabilities
- `canvas-pipeline`: Lightweight zero-dependency WebGL2 and WebGPU rendering engine with OffscreenCanvas/Worker support, automatic viewport power-saving, and 2D/CSS fallbacks.
- `shader-registry`: Standardized schema, uniform abstraction, and catalog of customizable shader effects with interactive inputs.
- `cli-tool`: Developer CLI tool to inspect, configure, and install shader components into local projects with zero runtime overhead.
- `framework-adapters`: Lightweight UI bindings for React, Vue, Svelte, and Web Components that expose declarative props and manage canvas lifecycles.

### Modified Capabilities

None. (Initial greenfield project).

## Impact

- Repository setup with TypeScript, linting, and testing pipelines.
- No external 3D runtime dependencies (pure vanilla WebGL2 / WebGPU APIs).
- Direct CLI integration workflow for end-user web applications (Next.js, Vite, Nuxt, SvelteKit, Astro).
