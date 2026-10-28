/**
 * Tier 3 Pairwise Test: Svelte Adapter + Canvas2D Graceful Fallback
 * Tests Svelte component running in software fallback environment without WebGL acceleration.
 */

import { describe, it, expect } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  MockCanvasRenderingContext2D
} from '../harness/index.ts';
import { SvelteShaderCanvasAdapter } from '../tier1-features/adapters.test.ts';
import { Canvas2DFallbackDriver } from '../tier1-features/core-drivers.test.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';

describe('Tier 3: Pairwise - Svelte Adapter + Canvas2D Fallback', () => {
  it('runs Svelte adapter with Canvas2D fallback when WebGL2 is disabled', () => {
    const canvas = new MockCanvasElement();
    canvas.allowWebGL2 = false; // Disable WebGL2 acceleration

    const svelteAdapter = new SvelteShaderCanvasAdapter(canvas);
    svelteAdapter.onMount();
    expect(svelteAdapter.getIsDestroyed()).toBe(false);

    // Fallback driver renders software procedural fallback
    const fallbackDriver = new Canvas2DFallbackDriver(canvas);
    const fallbackFn = STARTER_SHADERS['liquid-chrome'].canvas2dFallback;

    expect(() => {
      fallbackDriver.render(1.0, [0.5, 0.5], fallbackFn);
    }).not.toThrow();

    const c2d = canvas.getContext('2d') as MockCanvasRenderingContext2D;
    expect(c2d.drawOps.length).toBeGreaterThan(0);

    svelteAdapter.onDestroy();
    expect(svelteAdapter.getIsDestroyed()).toBe(true);
    fallbackDriver.dispose();
  });
});
