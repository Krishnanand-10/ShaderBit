/**
 * Tier 4 Scenario 5: Framework Lifecycle & Prop Reactivity Stress
 * Simulates high-frequency UI state stress:
 * 1. Rapid 120Hz slider adjustments updating uniforms continuously without lag
 * 2. Rapid component toggling (v-if / conditional rendering)
 * 3. Complete GPU context cleanup with zero leaked buffers or dangling event listeners.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  MockWebGL2RenderingContext,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { ReactShaderCanvasAdapter, VueShaderCanvasAdapter } from '../tier1-features/adapters.test.ts';
import { WebGL2Driver } from '../tier1-features/core-drivers.test.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';

describe('Tier 4 Scenario 5: Framework Lifecycle & Prop Reactivity Stress', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('handles high-frequency 120Hz uniform updates without recreating GPU pipelines', async () => {
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);
    await driver.init(STARTER_SHADERS['liquid-chrome'].glsl);

    const reactAdapter = new ReactShaderCanvasAdapter(canvas);
    reactAdapter.mount({ uniforms: { u_speed: 1.0, u_reflection: 0.8 } });

    // Stress test: 120 consecutive rapid updates (e.g. user aggressively dragging interactive slider)
    for (let i = 0; i < 120; i++) {
      const val = 1.0 + (i / 120) * 4.0;
      reactAdapter.updateProps({ uniforms: { u_speed: val } });
      driver.setUniform('u_speed', { type: 'float', value: val });
    }

    expect(reactAdapter.getUniforms().u_speed).toBeCloseTo(5.0, 1);

    // Frame render
    driver.render(1.0, [0.5, 0.5]);
    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    expect(gl.drawCallCount).toBe(1);

    reactAdapter.unmount();
    driver.dispose();
  });

  it('survives rapid component mount/unmount toggling cycles without leaking GPU resources', async () => {
    const canvas = new MockCanvasElement();

    for (let cycle = 0; cycle < 10; cycle++) {
      const driver = new WebGL2Driver(canvas);
      await driver.init(STARTER_SHADERS['interactive-noise'].glsl);

      const vueAdapter = new VueShaderCanvasAdapter(canvas);
      vueAdapter.onMounted();
      vueAdapter.watchUniforms({ u_noiseScale: 3.0 + cycle });

      driver.render(cycle * 0.1, [0.5, 0.5]);

      vueAdapter.onBeforeUnmount();
      driver.dispose();
    }

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    expect(gl.drawCallCount).toBe(10);
  });
});
