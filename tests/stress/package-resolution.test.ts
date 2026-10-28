import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const repoRoot = resolve(__dirname, '../..');

describe('Milestone 1 Empirical Package Resolution & Export Contracts', () => {
  describe('1. Direct Artifact Resolution & PROJECT.md Contracts', () => {
    it('@shaderbit/core exports match PROJECT.md interface contract', async () => {
      const core = await import(resolve(repoRoot, 'packages/core/dist/index.js'));

      // PROJECT.md: ShaderPipeline class
      expect(core.ShaderPipeline).toBeDefined();
      expect(typeof core.ShaderPipeline).toBe('function');

      // Instantiate ShaderPipeline and check required methods from PROJECT.md:
      // init(), setUniform(), setUniforms(), resize(), start(), stop(), dispose()
      const mockCanvas: any = { width: 800, height: 600 };
      const pipeline = new core.ShaderPipeline({ canvas: mockCanvas, driver: 'canvas2d' });
      expect(typeof pipeline.init).toBe('function');
      expect(typeof pipeline.setUniform).toBe('function');
      expect(typeof pipeline.setUniforms).toBe('function');
      expect(typeof pipeline.resize).toBe('function');
      expect(typeof pipeline.start).toBe('function');
      expect(typeof pipeline.stop).toBe('function');
      expect(typeof pipeline.dispose).toBe('function');

      // Core drivers & controllers
      expect(core.WebGL2Driver).toBeDefined();
      expect(core.WebGPUDriver).toBeDefined();
      expect(core.Canvas2DFallback).toBeDefined();
      expect(core.PowerSavingController).toBeDefined();
      expect(core.PointerNormalizer).toBeDefined();
      expect(core.OffscreenWorkerBridge).toBeDefined();
    });

    it('@shaderbit/registry exports match PROJECT.md interface contract', async () => {
      const registry = await import(resolve(repoRoot, 'packages/registry/dist/index.js'));

      // Validation schemas & helpers
      expect(registry.UniformDescriptorSchema).toBeDefined();
      expect(registry.ShaderComponentSchema).toBeDefined();
      expect(typeof registry.validateComponent).toBe('function');

      // Starter shader effects (GLSL, WGSL, uniforms, metadata)
      expect(registry.liquidChrome).toBeDefined();
      expect(registry.liquidChrome.id).toBe('liquid-chrome');
      expect(registry.liquidChrome.glsl).toBeTruthy();
      expect(registry.liquidChrome.wgsl).toBeTruthy();
      expect(Array.isArray(registry.liquidChrome.uniforms)).toBe(true);

      expect(registry.meshGradient).toBeDefined();
      expect(registry.meshGradient.id).toBe('mesh-gradient');

      expect(registry.interactiveNoise).toBeDefined();
      expect(registry.interactiveNoise.id).toBe('interactive-noise');

      expect(registry.caustics).toBeDefined();
      expect(registry.caustics.id).toBe('caustics');

      // Catalog functions
      expect(typeof registry.listComponents).toBe('function');
      expect(typeof registry.getComponent).toBe('function');
      expect(typeof registry.registerComponent).toBe('function');
      expect(registry.listComponents().length).toBeGreaterThanOrEqual(4);
    });

    it('@shaderbit/cli exports CLI entrypoints and commands', async () => {
      const cli = await import(resolve(repoRoot, 'packages/cli/dist/index.js'));

      expect(typeof cli.createCli).toBe('function');
      expect(typeof cli.runCli).toBe('function');
      expect(typeof cli.listAvailableShaders).toBe('function');
      expect(typeof cli.addShaderComponent).toBe('function');
      expect(typeof cli.initCommand).toBe('function');
      expect(typeof cli.listCommand).toBe('function');
      expect(typeof cli.addCommand).toBe('function');
      expect(typeof cli.loadConfig).toBe('function');
      expect(typeof cli.saveConfig).toBe('function');
      expect(typeof cli.detectProject).toBe('function');
      expect(typeof cli.generateComponent).toBe('function');
    });

    it('@shaderbit/react exports React adapter contracts', async () => {
      const reactAdapter = await import(resolve(repoRoot, 'packages/react/dist/index.js'));
      expect(reactAdapter.ShaderCanvas).toBeDefined();
      expect(typeof reactAdapter.useShaderPipeline).toBe('function');
    });

    it('@shaderbit/vue exports Vue 3 adapter contracts (verified in clean Node environment)', () => {
      const out = execSync(
        `node -e "import('./packages/vue/dist/index.js').then(v => console.log(typeof v.ShaderCanvas, typeof v.useShaderCanvas))"`,
        { cwd: repoRoot, encoding: 'utf-8' }
      );
      expect(out.trim()).toBe('object function');
    });

    it('@shaderbit/svelte exports Svelte adapter contracts (exports shaderCanvas action instead of ShaderCanvas component)', async () => {
      const svelteAdapter = await import(resolve(repoRoot, 'packages/svelte/dist/index.js'));
      // Note: PROJECT.md specifies ShaderCanvas.svelte wrapper, but M1 implements shaderCanvas action
      expect(svelteAdapter.shaderCanvas).toBeDefined();
      expect(typeof svelteAdapter.shaderCanvas).toBe('function');
    });

    it('@shaderbit/elements exports Custom Element contract', async () => {
      const elementsAdapter = await import(resolve(repoRoot, 'packages/elements/dist/index.js'));
      expect(elementsAdapter.ShaderBitElement).toBeDefined();
      expect(typeof elementsAdapter.ShaderBitElement).toBe('function');
    });
  });

  describe('2. Dual-Format Artifact Resolution (ESM & CJS)', () => {
    it('resolves CJS bundles via require() for dual-format packages in clean process', () => {
      const coreCjs = require(resolve(repoRoot, 'packages/core/dist/index.cjs'));
      expect(coreCjs.ShaderPipeline).toBeDefined();
      expect(coreCjs.WebGL2Driver).toBeDefined();

      const regCjs = require(resolve(repoRoot, 'packages/registry/dist/index.cjs'));
      expect(regCjs.liquidChrome).toBeDefined();
      expect(regCjs.listComponents).toBeDefined();

      const reactCjs = require(resolve(repoRoot, 'packages/react/dist/index.cjs'));
      expect(reactCjs.ShaderCanvas).toBeDefined();
      expect(reactCjs.useShaderPipeline).toBeDefined();

      const svelteCjs = require(resolve(repoRoot, 'packages/svelte/dist/index.cjs'));
      expect(svelteCjs.shaderCanvas).toBeDefined();

      const elementsCjs = require(resolve(repoRoot, 'packages/elements/dist/index.cjs'));
      expect(elementsCjs.ShaderBitElement).toBeDefined();

      // Vue CJS in clean environment (without global document pollution)
      const vueCjsOut = execSync(
        `node -e "const v = require('./packages/vue/dist/index.cjs'); console.log(typeof v.ShaderCanvas, typeof v.useShaderCanvas)"`,
        { cwd: repoRoot, encoding: 'utf-8' }
      );
      expect(vueCjsOut.trim()).toBe('object function');
    });

    it('resolves ESM bundles via dynamic import() for all packages', async () => {
      const coreEsm = await import(resolve(repoRoot, 'packages/core/dist/index.js'));
      expect(coreEsm.ShaderPipeline).toBeDefined();

      const regEsm = await import(resolve(repoRoot, 'packages/registry/dist/index.js'));
      expect(regEsm.liquidChrome).toBeDefined();

      const cliEsm = await import(resolve(repoRoot, 'packages/cli/dist/index.js'));
      expect(cliEsm.createCli).toBeDefined();
    });
  });

  describe('3. Cross-Package Sister Dependency Resolution via Node.js', () => {
    it('@shaderbit/registry successfully imports @shaderbit/core in its runtime context', () => {
      const out = execSync(
        `node -e "import('@shaderbit/core').then(m => console.log('OK', typeof m.ShaderPipeline))"`,
        { cwd: resolve(repoRoot, 'packages/registry'), encoding: 'utf-8' }
      );
      expect(out.trim()).toBe('OK function');
    });

    it('@shaderbit/cli successfully queries @shaderbit/registry catalog in its runtime context', () => {
      const out = execSync(
        `node -e "import('@shaderbit/registry').then(m => console.log('OK', m.listComponents().map(c => c.id).join(',')))"`,
        { cwd: resolve(repoRoot, 'packages/cli'), encoding: 'utf-8' }
      );
      expect(out.trim()).toContain('liquid-chrome');
      expect(out.trim()).toContain('mesh-gradient');
      expect(out.trim()).toContain('interactive-noise');
      expect(out.trim()).toContain('caustics');
    });

    it('@shaderbit/elements resolves both @shaderbit/core and @shaderbit/registry', () => {
      const out = execSync(
        `node -e "Promise.all([import('@shaderbit/core'), import('@shaderbit/registry')]).then(([c, r]) => console.log('OK', typeof c.ShaderPipeline, r.listComponents().length))"`,
        { cwd: resolve(repoRoot, 'packages/elements'), encoding: 'utf-8' }
      );
      expect(out.trim()).toBe('OK function 4');
    });

    it('@shaderbit/react resolves @shaderbit/core', () => {
      const out = execSync(
        `node -e "import('@shaderbit/core').then(c => console.log('OK', typeof c.ShaderPipeline))"`,
        { cwd: resolve(repoRoot, 'packages/react'), encoding: 'utf-8' }
      );
      expect(out.trim()).toBe('OK function');
    });

    it('@shaderbit/vue resolves @shaderbit/core', () => {
      const out = execSync(
        `node -e "import('@shaderbit/core').then(c => console.log('OK', typeof c.ShaderPipeline))"`,
        { cwd: resolve(repoRoot, 'packages/vue'), encoding: 'utf-8' }
      );
      expect(out.trim()).toBe('OK function');
    });

    it('@shaderbit/svelte resolves @shaderbit/core', () => {
      const out = execSync(
        `node -e "import('@shaderbit/core').then(c => console.log('OK', typeof c.ShaderPipeline))"`,
        { cwd: resolve(repoRoot, 'packages/svelte'), encoding: 'utf-8' }
      );
      expect(out.trim()).toBe('OK function');
    });

    it('apps/playground resolves @shaderbit/core, @shaderbit/registry, @shaderbit/react, @shaderbit/elements', () => {
      const out = execSync(
        `node -e "Promise.all([import('@shaderbit/core'), import('@shaderbit/registry'), import('@shaderbit/react'), import('@shaderbit/elements')]).then(([c, reg, rct, el]) => console.log('OK', typeof c.ShaderPipeline, reg.listComponents().length, typeof rct.ShaderCanvas, typeof el.ShaderBitElement))"`,
        { cwd: resolve(repoRoot, 'apps/playground'), encoding: 'utf-8' }
      );
      expect(out.trim()).toBe('OK function 4 object function');
    });

    it('identifies architectural limitation: root workspace cannot resolve @shaderbit/* bare specifiers', () => {
      // In pnpm workspaces without root dependencies or tsconfig/bundler aliases,
      // resolving @shaderbit/core from root directory fails with ERR_MODULE_NOT_FOUND.
      let failedAsExpected = false;
      try {
        execSync(`node -e "import('@shaderbit/core')"`, {
          cwd: repoRoot,
          encoding: 'utf-8',
          stdio: 'pipe'
        });
      } catch (err: any) {
        failedAsExpected = true;
        expect(err.message).toMatch(/ERR_MODULE_NOT_FOUND|Cannot find package/);
      }
      expect(failedAsExpected).toBe(true);
    });

    it('reproduces global mock pollution: tests/mocks/visibility.ts corrupts globalThis.document', () => {
      // In tests/mocks/visibility.ts:
      // (globalThis as any).document ??= new EventTarget()
      // If document is an EventTarget lacking createElement, requiring Vue CJS crashes with doc.createElement is not a function.
      let crashedAsExpected = false;
      try {
        execSync(
          `node -e "globalThis.document = new EventTarget(); require('./packages/vue/dist/index.cjs')"`,
          { cwd: repoRoot, encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (err: any) {
        crashedAsExpected = true;
        expect(err.message).toContain('doc.createElement is not a function');
      }
      expect(crashedAsExpected).toBe(true);
    });
  });
});
