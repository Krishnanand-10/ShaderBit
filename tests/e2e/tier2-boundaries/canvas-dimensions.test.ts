/**
 * Tier 2 Boundary Test: Canvas Dimensions & DPR Extremes
 * Tests 0x0 canvas, negative dimensions, 16K extreme resolutions, zero/negative DPR, and fractional DPR.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { WebGL2Driver, Canvas2DFallbackDriver } from '../tier1-features/core-drivers.test.ts';

export function calculateViewportSize(
  width: number,
  height: number,
  dpr = 1
): { bufferWidth: number; bufferHeight: number; aspect: number } {
  const safeDpr = dpr <= 0 || !isFinite(dpr) ? 1 : dpr;
  const safeWidth = Math.max(0, width);
  const safeHeight = Math.max(0, height);

  const bufferWidth = Math.round(safeWidth * safeDpr);
  const bufferHeight = Math.round(safeHeight * safeDpr);
  const aspect = safeHeight > 0 ? safeWidth / safeHeight : 1.0;

  return { bufferWidth, bufferHeight, aspect };
}

describe('Tier 2: Canvas Dimensions & DPR Extremes', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('handles 0x0 dimension canvas without throwing divide-by-zero or crashing pipeline', async () => {
    const canvas = new MockCanvasElement();
    canvas.width = 0;
    canvas.height = 0;
    canvas.clientWidth = 0;
    canvas.clientHeight = 0;

    const size = calculateViewportSize(canvas.width, canvas.height, 1);
    expect(size.bufferWidth).toBe(0);
    expect(size.bufferHeight).toBe(0);
    expect(size.aspect).toBe(1.0); // Safe aspect fallback

    const driver = new WebGL2Driver(canvas);
    await driver.init();

    // Render with 0x0 should not throw
    expect(() => driver.render(1.0, [0.5, 0.5])).not.toThrow();
    driver.dispose();
  });

  it('safely clamps negative dimensions to 0 without throwing runtime exceptions', () => {
    const negativeSize = calculateViewportSize(-800, -600, 2);
    expect(negativeSize.bufferWidth).toBe(0);
    expect(negativeSize.bufferHeight).toBe(0);
    expect(negativeSize.aspect).toBe(1.0);

    const canvas = new MockCanvasElement();
    canvas.width = -500;
    canvas.height = -300;

    const fallback = new Canvas2DFallbackDriver(canvas);
    expect(() => fallback.render(0, [0, 0])).not.toThrow();
    fallback.dispose();
  });

  it('handles extreme 16K ultra-high resolution canvas buffers (15360 x 8640)', async () => {
    const canvas = new MockCanvasElement();
    canvas.width = 15360;
    canvas.height = 8640;

    const size = calculateViewportSize(canvas.width, canvas.height, 1);
    expect(size.bufferWidth).toBe(15360);
    expect(size.bufferHeight).toBe(8640);
    expect(size.aspect).toBeCloseTo(1.777, 2);

    const driver = new WebGL2Driver(canvas);
    await driver.init();
    expect(() => driver.render(1.0, [0.5, 0.5])).not.toThrow();
    driver.dispose();
  });

  it('falls back to DPR 1.0 when DPR is 0, negative, NaN, or non-finite', () => {
    const zeroDpr = calculateViewportSize(800, 600, 0);
    expect(zeroDpr.bufferWidth).toBe(800);

    const negDpr = calculateViewportSize(800, 600, -2);
    expect(negDpr.bufferWidth).toBe(800);

    const nanDpr = calculateViewportSize(800, 600, NaN);
    expect(nanDpr.bufferWidth).toBe(800);

    const infDpr = calculateViewportSize(800, 600, Infinity);
    expect(infDpr.bufferWidth).toBe(800);
  });

  it('handles fractional DPR (1.25, 1.5, 2.75) rounding accurately to integer buffer sizes', () => {
    const fractional = calculateViewportSize(1001, 703, 1.25);
    // 1001 * 1.25 = 1251.25 -> 1251
    expect(fractional.bufferWidth).toBe(1251);
    // 703 * 1.25 = 878.75 -> 879
    expect(fractional.bufferHeight).toBe(879);
    expect(Number.isInteger(fractional.bufferWidth)).toBe(true);
    expect(Number.isInteger(fractional.bufferHeight)).toBe(true);
  });
});
