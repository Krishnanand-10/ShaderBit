/**
 * Tier 4 Scenario 2: Multi-Driver Fallback & Context Loss Resilience
 * Simulates real-world hardware failure degradation:
 * 1. WebGPU requested on unsupported browser -> falls back to WebGL2
 * 2. WebGL2 driver runs normally
 * 3. GPU device crash triggers unrecoverable context loss -> falls back to Canvas2D
 * 4. Procedural fallback ensures 100% zero layout collapse and zero unhandled exceptions.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  MockCanvasRenderingContext2D,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { WebGL2Driver, WebGPUDriver, Canvas2DFallbackDriver } from '../tier1-features/core-drivers.test.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';

export class RobustHierarchicalPipeline {
  private canvas: MockCanvasElement;
  private activeDriverType: 'webgpu' | 'webgl2' | '2d' = '2d';
  private webgpuDriver: WebGPUDriver | null = null;
  private webgl2Driver: WebGL2Driver | null = null;
  private fallbackDriver: Canvas2DFallbackDriver | null = null;

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
  }

  async init(glsl?: string, wgsl?: string): Promise<'webgpu' | 'webgl2' | '2d'> {
    // 1. Try WebGPU
    try {
      this.webgpuDriver = new WebGPUDriver(this.canvas);
      const gpuOk = await this.webgpuDriver.init(wgsl);
      if (gpuOk) {
        this.activeDriverType = 'webgpu';
        return 'webgpu';
      }
    } catch {
      this.webgpuDriver = null;
    }

    // 2. Try WebGL2
    try {
      this.webgl2Driver = new WebGL2Driver(this.canvas);
      const glOk = await this.webgl2Driver.init(glsl);
      if (glOk) {
        this.activeDriverType = 'webgl2';
        return 'webgl2';
      }
    } catch {
      this.webgl2Driver = null;
    }

    // 3. Graceful Canvas2D software fallback
    this.fallbackDriver = new Canvas2DFallbackDriver(this.canvas);
    this.activeDriverType = '2d';
    return '2d';
  }

  render(time: number, mouse: [number, number]): void {
    if (this.activeDriverType === 'webgpu' && this.webgpuDriver) {
      this.webgpuDriver.render(time, mouse);
    } else if (this.activeDriverType === 'webgl2' && this.webgl2Driver) {
      this.webgl2Driver.render(time, mouse);
    } else if (this.fallbackDriver) {
      this.fallbackDriver.render(time, mouse, STARTER_SHADERS['liquid-chrome'].canvas2dFallback);
    }
  }

  downgradeToSoftwareFallback(): void {
    if (this.webgl2Driver) {
      this.webgl2Driver.dispose();
      this.webgl2Driver = null;
    }
    this.fallbackDriver = new Canvas2DFallbackDriver(this.canvas);
    this.activeDriverType = '2d';
  }

  getActiveDriver(): string {
    return this.activeDriverType;
  }

  dispose(): void {
    if (this.webgpuDriver) this.webgpuDriver.dispose();
    if (this.webgl2Driver) this.webgl2Driver.dispose();
    if (this.fallbackDriver) this.fallbackDriver.dispose();
  }
}

describe('Tier 4 Scenario 2: Multi-Driver Fallback & Context Loss Resilience', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('navigates full fallback hierarchy: WebGPU -> WebGL2 -> Canvas2D without uncaught errors', async () => {
    const canvas = new MockCanvasElement();

    // Disable WebGPU to test first fallback step
    (globalThis as any).navigator.gpu.enabled = false;

    const pipeline = new RobustHierarchicalPipeline(canvas);
    const resolved = await pipeline.init(
      STARTER_SHADERS['liquid-chrome'].glsl,
      STARTER_SHADERS['liquid-chrome'].wgsl
    );

    expect(resolved).toBe('webgl2');
    expect(pipeline.getActiveDriver()).toBe('webgl2');

    // Render normally with WebGL2
    expect(() => pipeline.render(1.0, [0.5, 0.5])).not.toThrow();

    // Simulate catastrophic GPU context crash requiring software downgrade
    pipeline.downgradeToSoftwareFallback();
    expect(pipeline.getActiveDriver()).toBe('2d');

    // Software procedural rendering continues uninterrupted
    expect(() => pipeline.render(2.0, [0.5, 0.5])).not.toThrow();

    const c2d = canvas.getContext('2d') as MockCanvasRenderingContext2D;
    expect(c2d.drawOps.length).toBeGreaterThan(0);

    pipeline.dispose();
  });
});
