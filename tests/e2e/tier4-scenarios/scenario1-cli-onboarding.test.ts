/**
 * Tier 4 Scenario 1: End-to-End CLI Project Onboarding & Shader Injection
 * Simulates complete developer workflow:
 * 1. Initialize project with `shaderbit init`
 * 2. Query available shaders with `shaderbit list --json`
 * 3. Add `liquid-chrome` with `shaderbit add`
 * 4. Verify standalone component file, framework integration, zero-dependency integrity, and shader compilation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import { runInit } from '../tier1-features/cli-init.test.ts';
import { runList } from '../tier1-features/cli-list.test.ts';
import { runAdd } from '../tier1-features/cli-add.test.ts';
import { WebGL2Driver } from '../tier1-features/core-drivers.test.ts';
import {
  MockCanvasElement,
  MockWebGL2RenderingContext,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';

describe('Tier 4 Scenario 1: End-to-End CLI Project Onboarding & Shader Injection', () => {
  let projectDir: string;
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderbit-e2e-scenario1-'));
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
    mockEnv.cleanup();
  });

  it('completes realistic full developer onboarding workflow', async () => {
    // Step 1: Simulate developer project scaffolding
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'my-web-app',
        dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' }
      })
    );
    fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), '{}');

    // Step 2: Developer runs `shaderbit init`
    const initResult = runInit({ cwd: projectDir });
    expect(initResult.success).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'shaderbit.json'))).toBe(true);
    const config = JSON.parse(fs.readFileSync(path.join(projectDir, 'shaderbit.json'), 'utf8'));
    expect(config.framework).toBe('react');
    expect(config.typescript).toBe(true);

    // Step 3: Developer lists available components `shaderbit list --json`
    const listResult = runList({ json: true });
    expect(listResult.data).toBeDefined();
    expect(listResult.data!.length).toBeGreaterThanOrEqual(4);
    const hasChrome = listResult.data!.some((c) => c.id === 'liquid-chrome');
    expect(hasChrome).toBe(true);

    // Step 4: Developer runs `shaderbit add liquid-chrome`
    const addResult = runAdd({
      cwd: projectDir,
      components: ['liquid-chrome'],
      framework: config.framework,
      typescript: config.typescript,
      dir: 'src/components/shaders'
    });

    expect(addResult.success).toBe(true);
    expect(addResult.writtenFiles.length).toBe(1);
    const componentFile = addResult.writtenFiles[0];
    expect(fs.existsSync(componentFile)).toBe(true);

    // Step 5: Verify zero-dep constraint on injected component code
    const code = fs.readFileSync(componentFile, 'utf8');
    const forbidden = ['three', 'babylonjs', 'twgl.js', 'regl', 'pixi.js'];
    for (const lib of forbidden) {
      expect(code).not.toContain(lib);
    }
    expect(code).toContain('export function LiquidChrome');
    expect(code).toContain('#version 300 es');

    // Step 6: Verify component mounts and renders in WebGL2 driver
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);
    await driver.init(STARTER_SHADERS['liquid-chrome'].glsl);
    driver.setUniform('u_speed', { type: 'float', value: 1.5 });
    driver.render(0.5, [0.4, 0.6]);

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    expect(gl.drawCallCount).toBe(1);
    driver.dispose();
  });
});
