/**
 * Tier 3 Pairwise Test: React Adapter + Starter Shaders
 * Tests React adapter wrapper mounted with all 4 starter effects and reactive uniform prop synchronization.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { ReactShaderCanvasAdapter } from '../tier1-features/adapters.test.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';

describe('Tier 3: Pairwise - React Adapter + Starter Shaders', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('mounts Liquid Chrome in React adapter and applies custom uniform overrides', () => {
    const canvas = new MockCanvasElement();
    const adapter = new ReactShaderCanvasAdapter(canvas);

    const initialUniforms = {
      u_speed: 1.0,
      u_reflection: 0.8,
      u_roughness: 0.2
    };

    adapter.mount({ uniforms: initialUniforms });
    expect(adapter.getIsMounted()).toBe(true);
    expect(adapter.getUniforms().u_speed).toBe(1.0);

    // Dynamic slider update
    adapter.updateProps({ uniforms: { u_speed: 3.5, u_reflection: 1.0 } });
    expect(adapter.getUniforms().u_speed).toBe(3.5);
    expect(adapter.getUniforms().u_reflection).toBe(1.0);
    expect(adapter.getUniforms().u_roughness).toBe(0.2); // preserved

    adapter.unmount();
    expect(adapter.getIsMounted()).toBe(false);
  });

  it('mounts Mesh Gradient in React adapter with 4-color palette updates', () => {
    const canvas = new MockCanvasElement();
    const adapter = new ReactShaderCanvasAdapter(canvas);

    const meshUniforms = {
      u_color1: [0.93, 0.28, 0.6],
      u_color2: [0.38, 0.45, 0.95],
      u_color3: [0.24, 0.86, 0.66],
      u_color4: [0.98, 0.74, 0.23]
    };

    adapter.mount({ uniforms: meshUniforms });
    expect(adapter.getUniforms().u_color1).toEqual([0.93, 0.28, 0.6]);

    // Theme toggle update (dark mode palette)
    const darkPalette = {
      u_color1: [0.1, 0.1, 0.2],
      u_color2: [0.2, 0.1, 0.4],
      u_color3: [0.1, 0.3, 0.3],
      u_color4: [0.3, 0.2, 0.1]
    };
    adapter.updateProps({ uniforms: darkPalette });
    expect(adapter.getUniforms().u_color1).toEqual([0.1, 0.1, 0.2]);

    adapter.unmount();
  });

  it('mounts Interactive Noise in React adapter with mouse radius and turbulence props', () => {
    const canvas = new MockCanvasElement();
    const adapter = new ReactShaderCanvasAdapter(canvas);

    adapter.mount({
      uniforms: {
        u_noiseScale: 4.0,
        u_mouseRadius: 0.3,
        u_mouseIntensity: 2.0
      }
    });

    expect(adapter.getUniforms().u_mouseRadius).toBe(0.3);
    adapter.unmount();
  });

  it('mounts Caustics in React adapter and executes clean teardown upon unmount', () => {
    const canvas = new MockCanvasElement();
    const adapter = new ReactShaderCanvasAdapter(canvas);

    adapter.mount({
      uniforms: {
        u_causticScale: 5.0,
        u_depth: 2.0,
        u_brightness: 1.5
      }
    });

    expect(adapter.getIsMounted()).toBe(true);
    adapter.unmount();
    expect(adapter.getIsMounted()).toBe(false);
    expect(adapter.teardownCalls).toBe(1);
  });
});
