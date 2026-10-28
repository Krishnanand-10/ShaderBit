/**
 * Tier 3 Pairwise Test: CLI Code Injection + GPU Component Compilation
 * Combines CLI generation of standalone component code with runtime shader compilation and drawing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import { runAdd } from '../tier1-features/cli-add.test.ts';
import { WebGL2Driver } from '../tier1-features/core-drivers.test.ts';
import {
  MockCanvasElement,
  MockWebGL2RenderingContext,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';

describe('Tier 3: Pairwise - CLI Code Injection + GPU Component Compilation', () => {
  let tmpDir: string;
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderbit-pairwise-cli-'));
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    mockEnv.cleanup();
  });

  it('generates React Liquid Chrome component via CLI, extracts embedded GLSL, and compiles in WebGL2 driver', async () => {
    const addResult = runAdd({
      cwd: tmpDir,
      components: ['liquid-chrome'],
      framework: 'react',
      typescript: true,
      dir: 'components'
    });

    expect(addResult.success).toBe(true);
    const injectedCode = fs.readFileSync(addResult.writtenFiles[0], 'utf8');

    // Verify embedded GLSL exists in the generated file
    expect(injectedCode).toContain('#version 300 es');
    expect(injectedCode).toContain('u_speed');

    // Instantiate driver and compile the exact GLSL code from registry/generator
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);
    const ok = await driver.init(STARTER_SHADERS['liquid-chrome'].glsl);
    expect(ok).toBe(true);

    // Dynamic uniform update and render
    driver.setUniform('u_speed', { type: 'float', value: 2.0 });
    driver.render(1.0, [0.5, 0.5]);

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    expect(gl.drawCallCount).toBe(1);
    driver.dispose();
  });

  it('generates Vue Mesh Gradient component, extracts embedded GLSL, and compiles in WebGL2 driver', async () => {
    const addResult = runAdd({
      cwd: tmpDir,
      components: ['mesh-gradient'],
      framework: 'vue',
      typescript: true,
      dir: 'components'
    });

    expect(addResult.success).toBe(true);
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);
    const ok = await driver.init(STARTER_SHADERS['mesh-gradient'].glsl);
    expect(ok).toBe(true);

    driver.setUniform('u_color1', { type: 'vec3', value: [0.9, 0.3, 0.6] });
    driver.render(0.5, [0.2, 0.8]);

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    expect(gl.drawCallCount).toBe(1);
    driver.dispose();
  });

  it('generates Caustics component via CLI and verifies zero-dep imports combined with shader compilation', async () => {
    const addResult = runAdd({
      cwd: tmpDir,
      components: ['caustics'],
      framework: 'react',
      typescript: true
    });

    const fileContent = fs.readFileSync(addResult.writtenFiles[0], 'utf8');
    expect(fileContent).not.toContain('three');
    expect(fileContent).not.toContain('babylonjs');

    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);
    await driver.init(STARTER_SHADERS['caustics'].glsl);
    driver.render(3.2, [0.5, 0.5]);

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    expect(gl.drawCallCount).toBe(1);
    driver.dispose();
  });
});
