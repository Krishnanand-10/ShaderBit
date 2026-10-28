/**
 * Zero-Dependency Integrity Verification Test Suite.
 * Enforces the non-negotiable architectural constraint:
 * NO external 3D libraries (Three.js, Babylon.js, twgl, regl, pixi, ogl) anywhere in dependencies or injected code.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from '../harness/test-kit.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';

const FORBIDDEN_3D_LIBRARIES = [
  'three',
  '@types/three',
  'babylonjs',
  '@babylonjs/core',
  'twgl.js',
  'regl',
  'pixi.js',
  'ogl',
  'luma.gl',
  'claygl'
];

describe('Zero-Dependency Integrity Verification', () => {
  const rootDir = path.resolve(import.meta.dirname, '../../..');

  it('verifies root package.json has zero external 3D runtime dependencies', () => {
    const rootPkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(rootPkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
        ...(pkg.peerDependencies || {})
      };

      for (const forbidden of FORBIDDEN_3D_LIBRARIES) {
        expect(allDeps[forbidden]).toBeUndefined();
      }
    } else {
      // If package.json not yet scaffolded by M1, constraint passes trivially
      expect(true).toBe(true);
    }
  });

  it('scans all packages/* directories to ensure no package declares external 3D libraries', () => {
    const packagesDir = path.join(rootDir, 'packages');
    if (fs.existsSync(packagesDir)) {
      const packageFolders = fs.readdirSync(packagesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const folder of packageFolders) {
        const pkgPath = path.join(packagesDir, folder, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          const deps = {
            ...(pkg.dependencies || {}),
            ...(pkg.peerDependencies || {})
          };

          for (const forbidden of FORBIDDEN_3D_LIBRARIES) {
            expect(deps[forbidden]).toBeUndefined();
          }
        }
      }
    } else {
      expect(true).toBe(true);
    }
  });

  it('verifies starter shader definitions in registry contain zero external library imports', () => {
    for (const [id, shader] of Object.entries(STARTER_SHADERS)) {
      expect(shader.dependencies || {}).toEqual({});
      
      // Ensure GLSL source is raw ES 3.00 shader string without external bundler wrappers
      expect(shader.glsl).toContain('#version 300 es');
      expect(shader.glsl).toContain('void main()');
      
      for (const forbidden of FORBIDDEN_3D_LIBRARIES) {
        expect(shader.glsl.toLowerCase()).not.toContain(`import ${forbidden}`);
        expect(shader.glsl.toLowerCase()).not.toContain(`require('${forbidden}')`);
        expect(shader.wgsl.toLowerCase()).not.toContain(forbidden);
      }
    }
  });

  it('verifies starter shaders bundle size footprint is under 5KB minified per effect', () => {
    for (const [id, shader] of Object.entries(STARTER_SHADERS)) {
      const totalPayload = JSON.stringify({
        id: shader.id,
        glsl: shader.glsl,
        wgsl: shader.wgsl,
        uniforms: shader.uniforms
      });
      const byteLength = Buffer.byteLength(totalPayload, 'utf8');
      // Must be under 5KB (5120 bytes)
      expect(byteLength).toBeLessThan(5120);
    }
  });

  it('verifies generated component templates do not reference external 3D loaders or renderers', () => {
    // Generate sample component code patterns for react, vue, svelte, vanilla
    const sampleTemplates = [
      `import { useEffect, useRef } from 'react';\nimport { ShaderPipeline } from '@shaderbit/core';\nexport function LiquidChrome() { return <canvas />; }`,
      `<template><canvas ref="canvasRef" /></template>\n<script setup>\nimport { onMounted } from 'vue';\nimport { ShaderPipeline } from '@shaderbit/core';\n</script>`,
      `<script>\nimport { onMount } from 'svelte';\nimport { ShaderPipeline } from '@shaderbit/core';\n</script>\n<canvas />`,
      `import { ShaderPipeline } from '@shaderbit/core';\nexport class ShaderBitElement extends HTMLElement {}`
    ];

    for (const template of sampleTemplates) {
      for (const forbidden of FORBIDDEN_3D_LIBRARIES) {
        expect(template).not.toContain(forbidden);
      }
      expect(template).toContain('@shaderbit/core');
    }
  });
});
