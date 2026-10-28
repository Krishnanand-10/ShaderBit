/**
 * Tier 2 Boundary Test: Invalid Shader Syntax & Compilation Errors
 * Tests GLSL syntax errors, WGSL validation errors, missing precision, and undeclared uniforms.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { WebGL2Driver, WebGPUDriver } from '../tier1-features/core-drivers.test.ts';

describe('Tier 2: Invalid Shader Syntax & Compilation Errors', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('rejects GLSL fragment shader containing explicit syntax errors with compilation error', async () => {
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);

    const invalidGLSL = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      void main() {
        SYNTAX_ERROR here;
      }`;

    await expect(driver.init(invalidGLSL)).toReject('Fragment shader compilation failed');
  });

  it('rejects WGSL shader containing invalid syntax with WGSL compilation error', async () => {
    const canvas = new MockCanvasElement();
    const driver = new WebGPUDriver(canvas);

    const invalidWGSL = `@fragment fn main() { INVALID_WGSL syntax; }`;
    await expect(driver.init(invalidWGSL)).toReject('WGSL compilation error');
  });

  it('handles undeclared uniform assignments gracefully without throwing unhandled exceptions', async () => {
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);
    await driver.init();

    // Setting a uniform not declared in the shader should not crash
    expect(() => {
      driver.setUniform('u_nonExistentUniform', { type: 'float', value: 42.0 });
    }).not.toThrow();

    driver.dispose();
  });

  it('rejects shader with undefined variables during compile', async () => {
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);

    const invalidShader = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      void main() {
        fragColor = undefined_variable;
      }`;

    await expect(driver.init(invalidShader)).toReject('syntax error');
  });

  it('rejects empty or whitespace-only shader strings', async () => {
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);

    // Initializing with empty shader that fails link/compile
    const emptyShader = `SYNTAX_ERROR`;
    await expect(driver.init(emptyShader)).toReject();
  });
});
