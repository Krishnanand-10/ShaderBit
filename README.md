# ShaderBit ⚡

> **The Zero-Dependency GPU Shader Component Registry**  
> Inspired by `shadcn/ui` and `Aceternity UI`, engineered from scratch for native WebGL2 & WebGPU fragment shaders.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-5.5%20Strict-blue.svg)](https://www.typescriptlang.org/)
[![Vitest: 100% Pass](https://img.shields.io/badge/Vitest-370%20Tests%20Passing-brightgreen.svg)](https://vitest.dev/)
[![E2E: 100% Pass](https://img.shields.io/badge/E2E-28%20Suites%20%7C%20216%20Tests-brightgreen.svg)](#testing--verification)
[![Zero 3D Runtime Dependencies](https://img.shields.io/badge/Runtime%203D%20Dependencies-0-success.svg)](#-the-philosophy-zero-3d-runtime-dependencies)

---

## 💡 The Problem

Modern web experiences demand striking, interactive visual backgrounds: **iridescent liquid chrome, multi-point mesh gradients, subsurface caustics, and pointer-reactive noise fields**.

Until now, achieving these effects required:
- **Massive Bundle Overhead**: Importing 3D engines like **Three.js (~600KB)** or **Babylon.js (~1MB)** simply to draw a 2D screen-space fragment shader quad.
- **Complex Boilerplate**: Manually orchestrating vertex buffers, VAOs, texture units, device pixel ratios, resize listeners, and uniform caches across hundreds of lines of code.
- **Battery Drain & UI Lag**: Continuous 60fps render loops running when canvases are offscreen or tabs are backgrounded, while heavy shader math blocks the browser's main UI thread.

---

## ✨ The Solution: ShaderBit

ShaderBit is a headless shader registry and developer CLI that injects **self-contained, copy-pasteable shader components** directly into your project.

- 🚀 **Strictly Zero 3D Runtime Dependencies**: No Three.js, Babylon.js, or TWGL. Core engine bundles are **under 5KB minified**.
- 🛡️ **Autonomous Multi-Driver Fallbacks**: WebGPU ➔ WebGL2 ➔ Procedural 2D Canvas fallback (software rendering guaranteed).
- 🏎️ **OffscreenCanvas Web Worker Bridge**: Render intensive shader animations entirely off the main thread at silky 60fps.
- 🔋 **Power-Saving Lifecycle**: Automatically pauses `requestAnimationFrame` loops via `IntersectionObserver` when offscreen and resumes upon visibility with clock delta preservation.
- 📦 **Copy-Paste Code Injection**: Like `shadcn/ui`, `npx shaderbit add <effect>` generates standalone, customizable code inside your repository.
- 🌐 **First-Class Framework Adapters**: Official wrappers for **React**, **Vue 3**, **Svelte 5**, and vanilla HTML **Web Components**.

---

## 📊 Bundle Size Comparison

| Library / Approach | Core Runtime Size | External Dependencies | Suitable for Screen Shaders |
| :--- | :--- | :--- | :--- |
| **Three.js** | ~600 KB | None | ❌ Overkill for 2D screen quad |
| **Babylon.js** | ~1.2 MB | None | ❌ Overkill for 2D screen quad |
| **React Three Fiber** | ~680 KB (Three.js + R3F) | React, Three.js | ❌ Heavy bundle bloat |
| **ShaderBit** ⚡ | **< 5 KB** | **0 (Zero)** | ✅ **Engineered specifically for screen shaders** |

---

## 🚀 Quickstart Guide

Get up and running in your project in under 60 seconds.

### 1. Initialize ShaderBit
Run the initialization wizard in your project root:
```bash
npx shaderbit init
```
This automatically detects your framework (React, Vue, Svelte, or Vanilla), TypeScript setup, and target component paths, creating `shaderbit.json`:

```json
{
  "$schema": "https://shaderbit.dev/schema.json",
  "framework": "react",
  "typescript": true,
  "paths": {
    "components": "@/components/shaders",
    "lib": "@/lib/shaders"
  },
  "driver": "auto"
}
```

### 2. Browse the Registry Catalog
Inspect all available production-ready shader effects:
```bash
npx shaderbit list
```
*(Tip: pass `--json` for machine-readable output, or `--category <tag>` to filter).*

### 3. Add an Effect to Your Codebase
Inject a standalone component into your project:
```bash
npx shaderbit add liquid-chrome
```
This generates a self-contained component file directly in your components folder (e.g., `src/components/shaders/liquid-chrome.tsx`) that you can freely customize.

---

## 🎨 Starter Shaders Showcase

ShaderBit includes four production-ready, schema-validated starter shaders. Each effect is implemented in **GLSL ES 3.00**, **WGSL**, and software **2D Canvas**:

### 1. Liquid Chrome (`liquid-chrome`)
An iridescent metallic fluid ripple reflection effect with specular highlights responding to mouse movement.

| Uniform | Type | Default | Range / Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| `u_speed` | `float` | `1.0` | `0.1` - `5.0` | Flow speed multiplier |
| `u_reflection` | `float` | `0.8` | `0.0` - `1.0` | Reflection sheen intensity |
| `u_roughness` | `float` | `0.2` | `0.0` - `1.0` | Surface roughness |
| `u_baseColor` | `vec3` | `[0.7, 0.75, 0.8]` | Hex string or RGB floats | Base metallic tint |
| `u_lightColor` | `vec3` | `[1.0, 0.95, 0.9]` | Hex string or RGB floats | Specular highlight color |

### 2. Mesh Gradient (`mesh-gradient`)
A multi-point smooth animated mesh color gradient blending 4 independent color anchors across flowing sine waves.

| Uniform | Type | Default | Range / Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| `u_speed` | `float` | `0.5` | `0.1` - `3.0` | Wave animation speed |
| `u_waveAmplitude` | `float` | `0.3` | `0.0` - `1.0` | Wave distortion magnitude |
| `u_color1` | `vec3` | `[0.93, 0.28, 0.6]` | Hex string or RGB floats | Primary mesh color |
| `u_color2` | `vec3` | `[0.38, 0.45, 0.95]` | Hex string or RGB floats | Secondary mesh color |
| `u_color3` | `vec3` | `[0.24, 0.86, 0.66]` | Hex string or RGB floats | Tertiary mesh color |
| `u_color4` | `vec3` | `[0.98, 0.74, 0.23]` | Hex string or RGB floats | Quaternary mesh color |

### 3. Interactive Noise (`interactive-noise`)
A generative simplex/perlin noise field that ripples and displaces dynamically as the user moves their cursor.

| Uniform | Type | Default | Range / Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| `u_noiseScale` | `float` | `3.0` | `0.5` - `10.0` | Spatial noise frequency |
| `u_frequency` | `float` | `1.0` | `0.1` - `5.0` | Animation speed |
| `u_amplitude` | `float` | `0.5` | `0.0` - `1.0` | Turbulence magnitude |
| `u_mouseRadius` | `float` | `0.25` | `0.05` - `0.8` | Pointer displacement radius |
| `u_mouseIntensity` | `float` | `1.5` | `0.0` - `5.0` | Displacement push force |

### 4. Caustics (`caustics`)
Underwater sunlight caustic light refraction with procedural dispersion mimicking oceanic depths.

| Uniform | Type | Default | Range / Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| `u_causticScale` | `float` | `4.0` | `1.0` - `10.0` | Wave pattern frequency |
| `u_depth` | `float` | `1.0` | `0.1` - `5.0` | Light refraction depth |
| `u_brightness` | `float` | `1.2` | `0.2` - `3.0` | Light ray concentration |
| `u_waterColor` | `vec3` | `[0.05, 0.35, 0.65]` | Hex string or RGB floats | Underwater absorption color |

---

## 💻 Framework Usage Examples

### React (`@shaderbit/react`)

```tsx
import React from 'react';
import { ShaderCanvas } from '@shaderbit/react';
import { getComponent } from '@shaderbit/registry';

const liquidChrome = getComponent('liquid-chrome')!;

export function HeroSection() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ShaderCanvas
        effect={liquidChrome}
        driver="auto"
        worker={true}
        powerSaving={true}
        uniforms={{
          u_speed: 1.5,
          u_reflection: 0.9,
          u_baseColor: [0.2, 0.4, 0.8]
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <div style={{ position: 'relative', zIndex: 1, color: '#fff', textAlign: 'center', paddingTop: '20vh' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 800 }}>Zero-Dependency GPU Shaders</h1>
        <p style={{ fontSize: '1.25rem', opacity: 0.8 }}>Blazing 60fps WebGL2 & WebGPU backgrounds.</p>
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
  <div class="shader-container">
    <ShaderCanvas
      :effect="meshGradient"
      driver="auto"
      :worker="false"
      :power-saving="true"
      :uniforms="{
        u_speed: 1.2,
        u_waveAmplitude: 0.4
      }"
      style="width: 100vw; height: 100vh;"
    />
  </div>
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
    powerSaving: true,
    uniforms: {
      u_brightness: 1.5,
      u_depth: 2.0
    }
  }}
  style="width: 100vw; height: 100vh;"
/>
```

### Vanilla HTML / Web Components (`@shaderbit/elements`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script type="module" src="./node_modules/@shaderbit/elements/dist/index.js"></script>
</head>
<body style="margin: 0; background: #000;">
  <shader-bit
    effect="interactive-noise"
    driver="auto"
    power-saving="true"
    u-noise-scale="4.0"
    u-mouse-intensity="2.0"
    style="width: 100vw; height: 100vh; display: block;"
  ></shader-bit>
</body>
</html>
```

---

## 🏛️ Monorepo Architecture & Packages

ShaderBit is organized as a modular, lightweight pnpm monorepo:

```
ShaderBit/
├── packages/
│   ├── core/         # Zero-dependency Headless GPU Engine (<5KB)
│   ├── registry/     # Shader component catalog, schemas & starter effects
│   ├── cli/          # shadcn-style CLI generator (shaderbit init/list/add)
│   ├── react/        # React 18 component & useShaderPipeline hook
│   ├── vue/          # Vue 3 component & useShaderCanvas composable
│   ├── svelte/       # Svelte component wrapper & canvas action
│   └── elements/     # Vanilla Custom Element (<shader-bit>)
├── apps/
│   └── playground/   # Interactive Vite showcase demoing all shaders & drivers
└── tests/
    └── e2e/          # 28 requirement-driven test suites (Tiers 1-4)
```

| Package | Version | Description |
| :--- | :--- | :--- |
| [`@shaderbit/core`](./packages/core) | `0.1.0` | Zero-dependency headless GPU canvas engine (WebGL2, WebGPU, 2D Canvas fallback, OffscreenCanvas Worker bridge, Power-Saving lifecycle) |
| [`@shaderbit/registry`](./packages/registry) | `0.1.0` | Zod schema validation, uniform abstraction engine, shader diagnostics, and 4 starter shaders |
| [`@shaderbit/cli`](./packages/cli) | `0.1.0` | Command-line utility (`shaderbit init`, `shaderbit list`, `shaderbit add <component>`) |
| [`@shaderbit/react`](./packages/react) | `0.1.0` | React adapter with `<ShaderCanvas />`, forwardRef, and React 18 StrictMode resilience |
| [`@shaderbit/vue`](./packages/vue) | `0.1.0` | Vue 3 adapter with `ShaderCanvas` and `useShaderCanvas` composable |
| [`@shaderbit/svelte`](./packages/svelte) | `0.1.0` | Svelte adapter with `ShaderCanvas.svelte` and `shaderCanvas` action |
| [`@shaderbit/elements`](./packages/elements) | `0.1.0` | Vanilla Custom Element `<shader-bit>` Web Component for zero-framework HTML apps |
| [`playground`](./apps/playground) | `0.1.0` | Interactive Vite showcase demonstrating all effects, real-time driver switching, and uniform sliders |

---

## 🎮 Interactive Showcase Playground

To experience the shader effects interactively with real-time parameter tweaking and driver switching:

```bash
# 1. Install dependencies
pnpm install

# 2. Start the playground development server
pnpm --filter playground dev
```

Open your browser at `http://localhost:5173`. The playground provides:
- **Effect Switcher**: Real-time switching between Liquid Chrome, Mesh Gradient, Interactive Noise, and Caustics.
- **Driver Switcher**: Toggle dynamically between `Auto`, `WebGPU`, `WebGL2`, and `Canvas2D Fallback`.
- **Worker Mode**: Toggle `OffscreenCanvas` Web Worker background rendering on and off.
- **Uniform Controls**: Interactive floating panel with range sliders and HTML5 color pickers.
- **Cursor Tracking**: Real-time pointer interaction feedback.

---

## 🧪 Testing & Verification Guide

ShaderBit enforces rigorous quality assurance across unit tests, adversarial stress probes, mock harnesses, and end-to-end user scenarios.

```bash
# 1. Run full unit and stress test suites (370 passing tests)
pnpm test

# 2. Run master E2E requirement-driven test runner (28 suites, 216 passing tests)
node --experimental-strip-types tests/e2e/runner.ts

# 3. Verify zero external 3D runtime dependencies
node --experimental-strip-types --test tests/e2e/integrity/zero-dependency.test.ts

# 4. Validate TypeScript strict typechecking
pnpm run typecheck

# 5. Build all packages and the playground application
pnpm run build
```

### Test Coverage Architecture

- **Tier 1 (Core Functional Contracts)**: Validates WebGL2/WebGPU/2D drivers, worker bridges, lifecycle pausing, pointer normalizers, registry schemas, and CLI operations.
- **Tier 2 (Boundary & Failure Modes)**: Canvas 0x0 / 4K DPR boundaries, WebGL context loss and restoration, invalid shader syntax diagnostics, and CLI unknown component errors.
- **Tier 3 (Pairwise Combinations)**: CLI code injection + GPU compile, WebGL2 + Worker + Power saving, Framework adapters + Starter shaders.
- **Tier 4 (End-to-End Scenarios)**: Real-world user flows simulating project initialization, shader installation, and multi-driver resilience.
- **Tier 5 (Adversarial Hardening)**: White-box stress testing, memory leak verification, and driver crash recovery.

---

## 📄 License

MIT © 2026 ShaderBit Contributors.
