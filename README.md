# ShaderBit ⚡

> **The Zero-Dependency GPU Shader Component Registry**  
> Inspired by shadcn/ui and Aceternity, but engineered from scratch for WebGL2 & WebGPU fragment shaders.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tests-Passing%20100%25-brightgreen.svg)](https://vitest.dev/)
[![Zero Dependencies](https://img.shields.io/badge/Runtime%20Dependencies-0-success.svg)](#zero-runtime-dependencies)

---

## 💡 The Problem
Modern landing pages and creative apps demand striking GPU-accelerated backgrounds (liquid chrome, mesh gradients, caustics, laser beams, interactive noise). However:
- **Bundle Bloat**: Traditional 3D engines (e.g. Three.js at ~600KB, Babylon.js at ~1MB) are massive for 2D screen-space effects.
- **Math & Integration Complexity**: Raw GLSL/WGSL fragment shaders, VAO quad setup, uniform caches, and resize listeners require hundreds of lines of boilerplate.
- **Battery Drain & Thread Blocking**: Continuous render loops drain device battery when offscreen and block the main UI thread during intensive page interactions.

---

## ✨ The Solution: ShaderBit
ShaderBit is a lightweight, headless shader registry where every component is written in vanilla WebGL2 and WebGPU:
- 🚀 **Zero Runtime Dependencies**: Strictly 0 external 3D engine libraries in core bundles.
- 📦 **Micro-Bundle Footprint**: Under **5KB minified** per effect.
- 🏎️ **OffscreenCanvas & Web Workers**: Renders on background worker threads at 60fps without blocking user interactions.
- 🔋 **Power-Saving Lifecycle**: Automatically pauses `requestAnimationFrame` render loops via `IntersectionObserver` when offscreen and resumes upon visibility.
- 🛡️ **Multi-Driver Fallbacks**: WebGPU ➔ WebGL2 ➔ Procedural 2D Canvas fallback (software rendering guaranteed).
- 🛠️ **CLI Code Injection**: Like shadcn/ui, `npx shaderbit add <effect>` copies clean, standalone, customizable component code directly into your repository.
- 🌐 **Framework Adapters**: First-class support for **React**, **Vue 3**, **Svelte 5**, and vanilla HTML **Web Components**.

---

## 📦 Packages in Monorepo

| Package | Version | Description |
| :--- | :--- | :--- |
| [`@shaderbit/core`](./packages/core) | `0.1.0` | Zero-dep headless GPU canvas engine (WebGL2, WebGPU, 2D fallback, Worker bridge, Power-saving) |
| [`@shaderbit/registry`](./packages/registry) | `0.1.0` | Shader schemas, uniform manager, GLSL error diagnostics, and 4 starter shaders |
| [`@shaderbit/cli`](./packages/cli) | `0.1.0` | Command-line utility (`shaderbit init`, `list`, `add <component>`) |
| [`@shaderbit/react`](./packages/react) | `0.1.0` | React adapter with `<ShaderCanvas />`, hooks, and React 18 StrictMode resilience |
| [`@shaderbit/vue`](./packages/vue) | `0.1.0` | Vue 3 adapter with `ShaderCanvas` and `useShaderCanvas` composable |
| [`@shaderbit/svelte`](./packages/svelte) | `0.1.0` | Svelte adapter with `ShaderCanvas.svelte` and canvas action |
| [`@shaderbit/elements`](./packages/elements) | `0.1.0` | Vanilla Custom Element `<shader-bit>` Web Component |
| [`playground`](./apps/playground) | `0.1.0` | Interactive Vite showcase demoing all starter effects and adapters |

---

## 🎨 Starter Shaders

1. **Liquid Chrome** (`liquid-chrome`): Iridescent metallic liquid fluid dynamics reacting smoothly to cursor movement.
2. **Mesh Gradient** (`mesh-gradient`): Multi-point animated color blending with customizable color palettes.
3. **Interactive Noise** (`interactive-noise`): Simplex/Perlin noise field with pointer-driven ripple displacement.
4. **Caustics** (`caustics`): High-speed procedural underwater light-refraction caustic patterns.

Each effect ships with:
- Dual **GLSL ES 3.00** and **WGSL** fragment shaders.
- Procedural **2D Canvas** software fallback.
- Strongly-typed uniform parameter definitions.

---

## 🚀 Quickstart with CLI

### 1. Initialize your project
```bash
npx shaderbit init
```
This detects your framework (React, Vue, Svelte, or Vanilla), TypeScript setup, and target component directory, generating a `shaderbit.json` configuration file:

```json
{
  "framework": "react",
  "typescript": true,
  "paths": {
    "components": "src/components/shaders",
    "lib": "src/lib/shaders"
  },
  "driver": "auto"
}
```

### 2. List available shaders
```bash
npx shaderbit list
```

### 3. Add an effect to your codebase
```bash
npx shaderbit add liquid-chrome
```
This injects a standalone, zero-dependency component into your project (e.g. `src/components/shaders/liquid-chrome.tsx`).

---

## 💻 Framework Usage Examples

### React (`@shaderbit/react`)
```tsx
import { ShaderCanvas } from '@shaderbit/react';
import { getComponent } from '@shaderbit/registry';

const liquidChrome = getComponent('liquid-chrome')!;

export function HeroBanner() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <ShaderCanvas
        effect={liquidChrome}
        driver="auto"
        powerSaving={true}
        uniforms={{ u_speed: 1.5 }}
        style={{ width: '100%', height: '100%' }}
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ color: '#fff', fontSize: '3rem' }}>Next-Gen GPU Background</h1>
      </div>
    </div>
  );
}
```

### Vue 3 (`@shaderbit/vue`)
```vue
<script setup lang="ts">
import { ShaderCanvas } from '@shaderbit/vue';
import { getComponent } from '@shaderbit/registry';

const meshGradient = getComponent('mesh-gradient')!;
</script>

<template>
  <ShaderCanvas
    :effect="meshGradient"
    driver="auto"
    :power-saving="true"
    :uniforms="{ u_speed: 1.2 }"
    style="width: 100vw; height: 100vh;"
  />
</template>
```

### Svelte (`@shaderbit/svelte`)
```svelte
<script lang="ts">
  import { shaderCanvas } from '@shaderbit/svelte';
  import { getComponent } from '@shaderbit/registry';

  const caustics = getComponent('caustics')!;
</script>

<canvas
  use:shaderCanvas={{
    effect: caustics,
    driver: 'auto',
    powerSaving: true
  }}
  style="width: 100vw; height: 100vh;"
/>
```

### Vanilla HTML / Web Components (`@shaderbit/elements`)
```html
<script type="module" src="./node_modules/@shaderbit/elements/dist/index.js"></script>

<shader-bit
  effect="interactive-noise"
  driver="auto"
  power-saving="true"
  style="width: 100%; height: 500px; display: block;"
></shader-bit>
```

---

## 🧪 Testing & Verification

ShaderBit includes comprehensive test suites across unit tests, adversarial challenger probes, mock harnesses, and end-to-end user scenarios.

```bash
# Run unit & stress tests (222 tests)
pnpm test

# Run full E2E & scenario suites (28 suites, 216 tests)
node --experimental-strip-types tests/e2e/runner.ts

# Verify zero external 3D runtime dependencies
pnpm run lint

# Validate TypeScript typechecking across all packages
pnpm run typecheck

# Build all packages & the interactive playground
pnpm run build
```

---

## 📄 License
MIT © 2026 ShaderBit Contributors.
