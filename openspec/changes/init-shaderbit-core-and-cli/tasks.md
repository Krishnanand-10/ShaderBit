# Tasks

## 1. Workspace Scaffolding and Tooling

- [ ] 1.1 Initialize root `package.json`, pnpm/npm workspace configuration, and TypeScript configs for `packages/*` and verify `npm run build` or typecheck succeeds.
- [ ] 1.2 Setup testing infrastructure with Vitest and verify test runner passes on a dummy test.

## 2. Headless GPU Canvas Engine (`@shaderbit/core`)

- [ ] 2.1 Implement WebGL2 render driver with full-screen quad VAO, shader compilation, and uniform location caching; verify unit tests pass with mock WebGL2 context.
- [ ] 2.2 Implement WebGPU driver with WGSL shader pipeline and full-screen quad vertex buffer; verify fallback gracefully to WebGL2 when WebGPU is unavailable.
- [ ] 2.3 Implement 2D Canvas fallback renderer for environments without hardware acceleration; verify fallback test renders without error.
- [ ] 2.4 Implement IntersectionObserver and Page Visibility power-saving controller; verify render loop pauses when offscreen and resumes when visible.
- [ ] 2.5 Implement OffscreenCanvas Web Worker bridge; verify worker messaging protocol and frame synchronization.
- [ ] 2.6 Implement pointer and touch event handlers to calculate normalized screen coordinates for mouse uniforms; verify event binding unit tests.

## 3. Shader Registry & Starter Effects (`@shaderbit/registry`)

- [ ] 3.1 Define shader component schema and uniform parameter types; verify validation tests on registry entries.
- [ ] 3.2 Implement Liquid Chrome shader effect (GLSL/WGSL, uniforms, and presets); verify compilation and schema compliance.
- [ ] 3.3 Implement Mesh Gradient shader effect with multi-point color interpolation; verify schema compliance and default uniform tests.
- [ ] 3.4 Implement Interactive Noise and Caustics shader effects; verify schema compliance and uniform binding tests.

## 4. Framework Adapters

- [ ] 4.1 Implement React adapter (`@shaderbit/react`) with `<ShaderCanvas />` component lifecycle and ref forwarding; verify React component rendering tests.
- [ ] 4.2 Implement Vue 3 adapter (`@shaderbit/vue`) with reactive props and canvas mount/unmount cleanup; verify Vue component tests.
- [ ] 4.3 Implement Svelte adapter (`@shaderbit/svelte`) and vanilla Custom Element (`<shader-bit>`); verify custom element lifecycle tests.

## 5. Developer CLI Tool (`@shaderbit/cli`)

- [ ] 5.1 Implement `shaderbit init` command to detect project type and generate `shaderbit.json` configuration; verify CLI test creates expected config file.
- [ ] 5.2 Implement `shaderbit list` command to display all available registry shaders; verify CLI output displays shader names and descriptions.
- [ ] 5.3 Implement `shaderbit add <component>` command to fetch/generate standalone component source files into user directory; verify generated file matches framework format without external runtime dependencies.

## 6. End-to-End Verification & Documentation

- [ ] 6.1 Create an interactive playground / showcase example illustrating the effects and verify build passes.
- [ ] 6.2 Run full test suite across all packages and verify 100% test pass rate.
- [ ] 6.3 Author README documentation with quickstart, CLI usage, and architecture overview.

## Workflow follow-up

- Review and apply change tasks using `/opsx-apply`.
- Archive change using `/opsx-archive` when implementation is verified.
