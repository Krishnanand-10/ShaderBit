/**
 * Milestone 5 Adversarial Challenge & Empirical Stress Test Suite
 * Agent: m5_challenger_2
 *
 * Focus: Developer CLI Tool (@shaderbit/cli) and Standalone Generated Code
 * 
 * Verifications:
 * 1. Injected Standalone Code Integrity across all 4 starter shaders and 4 frameworks (32 permutations)
 * 2. Strict zero 3D runtime dependency enforcement
 * 3. Embedded shaders and Canvas2D fallback validation
 * 4. TypeScript compilation (tsc) of generated components:
 *    - Empirical reproduction of TS7006 noImplicitAny vulnerability in generated Canvas2D fallback
 *    - Compilation under standard permissive mode
 * 5. Direct CLI binary execution (init, list, add) with flags, batches, and atomic guards
 * 6. Programmatic exports and public API resolution
 * 7. Hostile fuzzing and boundary conditions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import { listComponents, getComponent } from '../../packages/registry/src/index';
import { generateComponent, toPascalCase, toPropName, getFileExtension } from '../../packages/cli/src/codegen';
import { detectProject } from '../../packages/cli/src/detector';
import { validateConfig, loadAndValidateConfig } from '../../packages/cli/src/config';
import { initCommand } from '../../packages/cli/src/commands/init';
import { listCommand } from '../../packages/cli/src/commands/list';
import { addCommand } from '../../packages/cli/src/commands/add';

const REPO_ROOT = path.resolve(__dirname, '../..');
const CLI_BIN = path.resolve(REPO_ROOT, 'packages/cli/dist/index.js');
const STARTER_IDS = ['liquid-chrome', 'mesh-gradient', 'interactive-noise', 'caustics'];
const FRAMEWORKS = ['react', 'vue', 'svelte', 'vanilla'] as const;

describe('Milestone 5 Empirical Challenger 2: Adversarial CLI & Codegen Verification', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderbit-m5-challenger-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // =========================================================================
  // 1. Standalone Generated Code Integrity (32 Permutations)
  // =========================================================================
  describe('1. Standalone Generated Code Integrity (32 Permutations)', () => {
    const forbiddenPatterns = [
      /\bfrom\s+['"]three['"]/i,
      /\bfrom\s+['"]@types\/three['"]/i,
      /\bfrom\s+['"]babylonjs['"]/i,
      /\bfrom\s+['"]twgl(\.js)?['"]/i,
      /\bfrom\s+['"]regl['"]/i,
      /\bfrom\s+['"]pixi(\.js)?['"]/i,
      /\bfrom\s+['"]ogl['"]/i,
      /\bTHREE\./,
      /\bBABYLON\./
    ];

    for (const shaderId of STARTER_IDS) {
      for (const framework of FRAMEWORKS) {
        for (const typescript of [true, false]) {
          const modeLabel = `${shaderId} | ${framework} | ${typescript ? 'TS' : 'JS'}`;

          it(`generates valid standalone code for ${modeLabel}`, () => {
            const comp = getComponent(shaderId)!;
            expect(comp).toBeDefined();

            const { filename, content } = generateComponent(comp, framework, typescript);

            // Extension check
            const expectedExt = getFileExtension(framework, typescript);
            expect(filename).toBe(`${shaderId}.${expectedExt}`);

            // 1. Strict zero 3D runtime dependency enforcement
            for (const pattern of forbiddenPatterns) {
              expect(content).not.toMatch(pattern);
            }

            // 2. Standalone zero-dependency import check
            // Must import from @shaderbit/core
            expect(content).toContain('@shaderbit/core');
            expect(content).toContain('ShaderPipeline');

            // Must NOT import from @shaderbit/registry (must be self-contained)
            expect(content).not.toContain('@shaderbit/registry');

            // Must NOT import adapter packages (standalone generation)
            expect(content).not.toContain('@shaderbit/react');
            expect(content).not.toContain('@shaderbit/vue');
            expect(content).not.toContain('@shaderbit/svelte');
            expect(content).not.toContain('@shaderbit/elements');

            // 3. Embedded shaders check
            expect(content).toContain('#version 300 es');
            expect(content).toContain('@fragment');

            // 4. Procedural fallback check
            if (comp.canvas2dFallback) {
              expect(content).toContain('fallback');
            }

            // 5. Uniform props check
            for (const u of comp.uniforms) {
              const propName = toPropName(u.name);
              expect(content).toContain(propName);
            }

            // 6. Framework specific lifecycle and reactive sync check
            if (framework === 'react') {
              expect(content).toContain("import React, { useEffect, useRef } from 'react'");
              expect(content).toContain(`export function ${toPascalCase(shaderId)}`);
              expect(content).toContain('pipelineRef.current.setUniforms');
            } else if (framework === 'vue') {
              expect(content).toContain('<template>');
              expect(content).toContain('<script setup');
              expect(content).toContain("import { ref, onMounted, onBeforeUnmount, watch } from 'vue'");
              expect(content).toContain('pipeline.setUniforms(getUniforms())');
            } else if (framework === 'svelte') {
              expect(content).toContain('<script');
              expect(content).toContain("import { onMount, onDestroy } from 'svelte'");
              expect(content).toContain('$: if (pipeline)');
              expect(content).toContain('pipeline.setUniforms');
            } else if (framework === 'vanilla') {
              expect(content).toContain(`export class ${toPascalCase(shaderId)}Element extends HTMLElement`);
              expect(content).toContain('connectedCallback');
              expect(content).toContain('disconnectedCallback');
              expect(content).toContain('attributeChangedCallback');
              expect(content).toContain(`customElements.define('shader-${shaderId}', ${toPascalCase(shaderId)}Element)`);
            }
          });
        }
      }
    }
  });

  // =========================================================================
  // 2. TypeScript Compilation Analysis of Standalone Generated Code
  // =========================================================================
  describe('2. TypeScript Compilation Analysis of Standalone Generated Code', () => {
    it('verifies standalone generated code compiles cleanly under strict tsc compilation with no TS7006 errors', () => {
      const componentsDir = path.join(tempDir, 'src/components');
      fs.mkdirSync(componentsDir, { recursive: true });

      // Generate Vanilla TS component for liquid-chrome
      const comp = getComponent('liquid-chrome')!;
      const vanillaRes = generateComponent(comp, 'vanilla', true);
      fs.writeFileSync(path.join(componentsDir, vanillaRes.filename), vanillaRes.content, 'utf8');

      // Setup strict tsconfig (strict: true => noImplicitAny: true)
      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          paths: {
            '@shaderbit/core': [path.resolve(REPO_ROOT, 'packages/core/src/index.ts')]
          }
        },
        include: ['src/**/*']
      };
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf8');

      const tscBin = path.resolve(REPO_ROOT, 'node_modules/.bin/tsc');
      const result = spawnSync(tscBin, ['--noEmit'], {
        cwd: tempDir,
        encoding: 'utf8',
        shell: true
      });

      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain('error TS7006');
      expect(result.stderr || '').toBe('');
    });

    it('compiles standalone components cleanly when noImplicitAny is disabled', () => {
      const componentsDir = path.join(tempDir, 'src/components');
      fs.mkdirSync(componentsDir, { recursive: true });

      // Generate Vanilla TS for all 4 starter shaders
      for (const shaderId of STARTER_IDS) {
        const comp = getComponent(shaderId)!;
        const vanillaRes = generateComponent(comp, 'vanilla', true);
        fs.writeFileSync(path.join(componentsDir, vanillaRes.filename), vanillaRes.content, 'utf8');
      }

      // Permissive tsconfig
      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          noImplicitAny: false,
          noEmit: true,
          paths: {
            '@shaderbit/core': [path.resolve(REPO_ROOT, 'packages/core/src/index.ts')]
          }
        },
        include: ['src/**/*']
      };
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf8');

      const tscBin = path.resolve(REPO_ROOT, 'node_modules/.bin/tsc');
      const result = spawnSync(tscBin, ['--noEmit'], {
        cwd: tempDir,
        encoding: 'utf8',
        shell: true
      });

      expect(result.status).toBe(0);
    });
  });

  // =========================================================================
  // 3. Direct CLI Binary Execution (init, list, add)
  // =========================================================================
  describe('3. Direct CLI Binary Execution (init, list, add)', () => {
    it('executes "shaderbit --help" with exit code 0 and proper descriptions', () => {
      const res = spawnSync('node', [CLI_BIN, '--help'], { encoding: 'utf8' });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('shaderbit [options] [command]');
      expect(res.stdout).toContain('init');
      expect(res.stdout).toContain('list');
      expect(res.stdout).toContain('add');
    });

    it('executes "shaderbit init" with flags and overwrite protection', () => {
      // 1. Initial init with -y
      const init1 = spawnSync('node', [CLI_BIN, 'init', '-y', '-f', 'react', '--ts'], {
        cwd: tempDir,
        encoding: 'utf8'
      });
      expect(init1.status).toBe(0);
      const configPath = path.join(tempDir, 'shaderbit.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const parsed1 = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(parsed1.framework).toBe('react');
      expect(parsed1.typescript).toBe(true);
      expect(parsed1.paths.components).toBe('@/components/shaders');

      // 2. Second init without overwrite flag must fail with exit code 1
      const init2 = spawnSync('node', [CLI_BIN, 'init', '-f', 'vue'], {
        cwd: tempDir,
        encoding: 'utf8'
      });
      expect(init2.status).toBe(1);
      expect(init2.stderr).toContain('already exists');

      // 3. Init with -o / --overwrite flag must succeed and replace configuration
      const init3 = spawnSync(
        'node',
        [CLI_BIN, 'init', '-o', '-f', 'vue', '--js', '-d', 'webgpu', '--components-dir', 'src/shaders'],
        { cwd: tempDir, encoding: 'utf8' }
      );
      expect(init3.status).toBe(0);
      const parsed3 = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(parsed3.framework).toBe('vue');
      expect(parsed3.typescript).toBe(false);
      expect(parsed3.driver).toBe('webgpu');
      expect(parsed3.paths.components).toBe('src/shaders');
    });

    it('executes "shaderbit list" with terminal formatting and --json filtering', () => {
      // Plain text list
      const listText = spawnSync('node', [CLI_BIN, 'list'], { encoding: 'utf8' });
      expect(listText.status).toBe(0);
      expect(listText.stdout).toContain('liquid-chrome');
      expect(listText.stdout).toContain('mesh-gradient');
      expect(listText.stdout).toContain('interactive-noise');
      expect(listText.stdout).toContain('caustics');

      // JSON list
      const listJson = spawnSync('node', [CLI_BIN, 'list', '--json'], { encoding: 'utf8' });
      expect(listJson.status).toBe(0);
      const catalog = JSON.parse(listJson.stdout);
      expect(Array.isArray(catalog)).toBe(true);
      expect(catalog.length).toBe(4);
      expect(catalog.map((c: any) => c.id)).toEqual(
        expect.arrayContaining(['liquid-chrome', 'mesh-gradient', 'interactive-noise', 'caustics'])
      );

      // Filter by category tag (e.g., 'liquid' matches liquid-chrome)
      const listCat = spawnSync('node', [CLI_BIN, 'list', '--json', '-c', 'liquid'], { encoding: 'utf8' });
      expect(listCat.status).toBe(0);
      const liquidCatalog = JSON.parse(listCat.stdout);
      expect(liquidCatalog.length).toBe(1);
      expect(liquidCatalog[0].id).toBe('liquid-chrome');

      // Filter by driver
      const listDriver = spawnSync('node', [CLI_BIN, 'list', '--json', '-d', 'webgpu'], { encoding: 'utf8' });
      expect(listDriver.status).toBe(0);
      const webgpuCatalog = JSON.parse(listDriver.stdout);
      expect(webgpuCatalog.length).toBe(4);
    });

    it('executes "shaderbit add" with single, batch, atomic failure, and overwrite guard', () => {
      // Setup shaderbit.json in tempDir
      fs.writeFileSync(
        path.join(tempDir, 'shaderbit.json'),
        JSON.stringify({
          framework: 'react',
          typescript: true,
          paths: { components: 'src/components/shaders' }
        }),
        'utf8'
      );

      const targetDir = path.join(tempDir, 'src/components/shaders');

      // 1. Single add
      const add1 = spawnSync('node', [CLI_BIN, 'add', 'liquid-chrome'], {
        cwd: tempDir,
        encoding: 'utf8'
      });
      expect(add1.status).toBe(0);
      const liquidPath = path.join(targetDir, 'liquid-chrome.tsx');
      expect(fs.existsSync(liquidPath)).toBe(true);

      // 2. Add without --overwrite when file exists must fail
      const add2 = spawnSync('node', [CLI_BIN, 'add', 'liquid-chrome'], {
        cwd: tempDir,
        encoding: 'utf8'
      });
      expect(add2.status).toBe(1);
      expect(add2.stderr).toContain('already exists');

      // 3. Add with --overwrite succeeds
      const add3 = spawnSync('node', [CLI_BIN, 'add', 'liquid-chrome', '-o'], {
        cwd: tempDir,
        encoding: 'utf8'
      });
      expect(add3.status).toBe(0);

      // 4. Batch add
      const addBatch = spawnSync('node', [CLI_BIN, 'add', 'mesh-gradient', 'caustics'], {
        cwd: tempDir,
        encoding: 'utf8'
      });
      expect(addBatch.status).toBe(0);
      expect(fs.existsSync(path.join(targetDir, 'mesh-gradient.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'caustics.tsx'))).toBe(true);

      // 5. Atomic failure: one valid, one invalid component
      const addAtomic = spawnSync('node', [CLI_BIN, 'add', 'interactive-noise', 'non-existent-effect'], {
        cwd: tempDir,
        encoding: 'utf8'
      });
      expect(addAtomic.status).toBe(1);
      expect(addAtomic.stderr).toContain("Component 'non-existent-effect' not found");
      // Must NOT have written interactive-noise.tsx
      expect(fs.existsSync(path.join(targetDir, 'interactive-noise.tsx'))).toBe(false);

      // 6. Add all components with --all -o
      const addAll = spawnSync('node', [CLI_BIN, 'add', '--all', '-o'], {
        cwd: tempDir,
        encoding: 'utf8'
      });
      expect(addAll.status).toBe(0);
      expect(fs.existsSync(path.join(targetDir, 'liquid-chrome.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'mesh-gradient.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'interactive-noise.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'caustics.tsx'))).toBe(true);
    });

    it('rejects "shaderbit add" without arguments in non-TTY environment', () => {
      const res = spawnSync('node', [CLI_BIN, 'add'], {
        cwd: tempDir,
        encoding: 'utf8'
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Please specify at least one component name or use --all');
    });
  });

  // =========================================================================
  // 4. Programmatic API and Resolution Contracts
  // =========================================================================
  describe('4. Programmatic API and Resolution Contracts', () => {
    it('exports all 11 required programmatic functions from dist/index.js', async () => {
      const cli = await import(CLI_BIN);

      const requiredExports = [
        'createCli',
        'runCli',
        'listAvailableShaders',
        'addShaderComponent',
        'initCommand',
        'listCommand',
        'addCommand',
        'loadConfig',
        'saveConfig',
        'detectProject',
        'generateComponent'
      ];

      for (const exp of requiredExports) {
        expect(cli[exp], `Expected export '${exp}'`).toBeDefined();
        expect(typeof cli[exp]).toBe('function');
      }
    });

    it('executes programmatic functions directly without throwing uncaught errors', async () => {
      const cli = await import(CLI_BIN);

      // listAvailableShaders
      const shaders = cli.listAvailableShaders();
      expect(shaders).toEqual(['liquid-chrome', 'mesh-gradient', 'interactive-noise', 'caustics']);

      // listCommand
      const listRes = cli.listCommand({ json: true });
      expect(listRes.data.length).toBe(4);

      // initCommand programmatic call
      const initRes = await cli.initCommand({
        cwd: tempDir,
        framework: 'svelte',
        typescript: true,
        yes: true
      });
      expect(initRes.success).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'shaderbit.json'))).toBe(true);

      // loadConfig programmatic call
      const loaded = await cli.loadConfig(tempDir);
      expect(loaded).not.toBeNull();
      expect(loaded?.framework).toBe('svelte');

      // addCommand programmatic call
      const addRes = await cli.addCommand(['liquid-chrome'], {
        cwd: tempDir,
        overwrite: true
      });
      expect(addRes.success).toBe(true);
      expect(addRes.writtenFiles.length).toBe(1);
      expect(fs.existsSync(addRes.writtenFiles[0])).toBe(true);

      // addShaderComponent wrapper
      await expect(
        cli.addShaderComponent('non-existent-shader', { cwd: tempDir })
      ).rejects.toThrow("Component 'non-existent-shader' not found");
    });
  });

  // =========================================================================
  // 5. Adversarial Boundary Conditions & Configuration Validation
  // =========================================================================
  describe('5. Adversarial Boundary Conditions & Configuration Validation', () => {
    it('detects and reports exact error messages for invalid configs', () => {
      // 1. Missing file
      const nonExistent = loadAndValidateConfig(path.join(tempDir, 'missing.json'));
      expect(nonExistent.valid).toBe(false);
      expect(nonExistent.error).toBe('Configuration file shaderbit.json does not exist');

      // 2. Corrupted JSON syntax
      const malformedPath = path.join(tempDir, 'shaderbit.json');
      fs.writeFileSync(malformedPath, '{ "framework": "react", trailing_comma: }', 'utf8');
      const malformed = loadAndValidateConfig(malformedPath);
      expect(malformed.valid).toBe(false);
      expect(malformed.error).toContain('JSON parse error in shaderbit.json:');

      // 3. Invalid framework
      fs.writeFileSync(malformedPath, JSON.stringify({ framework: 'angular', paths: { components: 'src' } }), 'utf8');
      const invalidFw = loadAndValidateConfig(malformedPath);
      expect(invalidFw.valid).toBe(false);
      expect(invalidFw.error).toBe('Invalid framework specified: angular');

      // 4. Missing paths.components
      fs.writeFileSync(malformedPath, JSON.stringify({ framework: 'react', paths: {} }), 'utf8');
      const missingPaths = loadAndValidateConfig(malformedPath);
      expect(missingPaths.valid).toBe(false);
      expect(missingPaths.error).toBe('Missing required configuration field: paths.components');
    });

    it('correctly detects project environment heuristics from package.json and tsconfig.json', () => {
      // React detection
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ dependencies: { react: '^18.0.0' } }), 'utf8');
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}', 'utf8');
      expect(detectProject(tempDir)).toEqual({ framework: 'react', typescript: true });

      // Vue detection
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ dependencies: { vue: '^3.0.0' } }), 'utf8');
      fs.rmSync(path.join(tempDir, 'tsconfig.json'));
      expect(detectProject(tempDir)).toEqual({ framework: 'vue', typescript: false });

      // Svelte detection
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ devDependencies: { '@sveltejs/kit': '^2.0.0' } }), 'utf8');
      expect(detectProject(tempDir)).toEqual({ framework: 'svelte', typescript: false });

      // Vanilla fallback
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({}), 'utf8');
      expect(detectProject(tempDir)).toEqual({ framework: 'vanilla', typescript: false });
    });
  });
});
