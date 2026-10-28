/**
 * Tier 3 Pairwise Test: Vue 3 Adapter + Starter Shaders
 * Tests Vue 3 component wrapper mounted with Interactive Noise & Caustics, and reactive watcher synchronization.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { VueShaderCanvasAdapter } from '../tier1-features/adapters.test.ts';

describe('Tier 3: Pairwise - Vue 3 Adapter + Starter Shaders', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('mounts Vue 3 adapter with Interactive Noise effect and updates reactive uniforms', () => {
    const canvas = new MockCanvasElement();
    const adapter = new VueShaderCanvasAdapter(canvas);

    adapter.onMounted();
    expect(adapter.getIsMounted()).toBe(true);

    // Initial reactive props
    adapter.watchUniforms({
      u_noiseScale: 3.0,
      u_frequency: 1.0,
      u_amplitude: 0.5
    });
    expect(adapter.getUniforms().u_noiseScale).toBe(3.0);

    // Reactive watcher updates upon prop change
    adapter.watchUniforms({
      u_noiseScale: 5.5,
      u_frequency: 2.0,
      u_amplitude: 0.8
    });
    expect(adapter.getUniforms().u_noiseScale).toBe(5.5);
    expect(adapter.getUniforms().u_frequency).toBe(2.0);

    adapter.onBeforeUnmount();
    expect(adapter.getIsMounted()).toBe(false);
  });

  it('mounts Vue 3 adapter with Caustics effect and tears down before unmount', () => {
    const canvas = new MockCanvasElement();
    const adapter = new VueShaderCanvasAdapter(canvas);

    adapter.onMounted();
    adapter.watchUniforms({
      u_causticScale: 4.0,
      u_depth: 1.0,
      u_brightness: 1.2
    });

    expect(adapter.getUniforms().u_brightness).toBe(1.2);

    adapter.onBeforeUnmount();
    expect(adapter.getIsMounted()).toBe(false);
    expect(Object.keys(adapter.getUniforms())).toHaveLength(0);
  });
});
