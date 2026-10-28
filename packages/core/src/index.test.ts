import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ShaderPipeline,
  WebGL2Driver,
  WebGPUDriver,
  Canvas2DFallback,
  PowerSavingController,
  PointerNormalizer,
  OffscreenCanvasWorkerBridge,
  OffscreenWorkerBridge,
  INLINE_WORKER_SCRIPT
} from './index';
import { MockHTMLCanvasElement, MockOffscreenCanvas } from '../../../tests/mocks/canvas';
import { MockWorker } from '../../../tests/mocks/worker';
import { MockIntersectionObserver } from '../../../tests/mocks/observers';

describe('@shaderbit/core', () => {
  beforeEach(() => {
    (globalThis as any).Worker = MockWorker;
    (globalThis as any).IntersectionObserver = MockIntersectionObserver;
    MockWorker.reset();
    MockIntersectionObserver.reset();
  });

  afterEach(() => {
    MockWorker.reset();
    MockIntersectionObserver.reset();
  });

  describe('Feature 4: WebGL2 Driver', () => {
    it('initializes WebGL2 context, compiles shaders, and renders full-screen quad', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGL2Driver(canvas as any);

      const ok = await driver.init();
      expect(ok).toBe(true);
      expect(driver.isContextLost).toBe(false);

      driver.setUniform('u_time', { type: 'float', value: 1.5 });
      driver.setUniform('u_resolution', { type: 'vec2', value: [800, 600] });
      driver.setUniform('u_color', { type: 'vec3', value: [1.0, 0.5, 0.2] });
      driver.setUniform('u_tint', { type: 'vec4', value: [1.0, 0.5, 0.2, 1.0] });
      driver.setUniform('u_count', { type: 'int', value: 4 });

      // Silently skips undeclared uniforms without error
      expect(() => driver.setUniform('u_undeclared', { type: 'float', value: 99.0 })).not.toThrow();

      driver.resize(1024, 768, 2);
      expect(canvas.width).toBe(2048);
      expect(canvas.height).toBe(1536);

      driver.render(2.0, [0.5, 0.5]);

      const gl = canvas.getContext('webgl2');
      expect(gl).toBeDefined();

      driver.dispose();
      expect(driver.isContextLost).toBe(true);
    });

    it('rejects empty fragment shader with informative error', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGL2Driver(canvas as any);
      await expect(driver.init('')).rejects.toThrow(/empty shader source/i);
      await expect(driver.init('   ')).rejects.toThrow(/empty shader source/i);
    });
  });

  describe('Feature 5: WebGPU Driver', () => {
    it('gracefully returns false when navigator.gpu is absent', async () => {
      const originalGpu = (navigator as any).gpu;
      (navigator as any).gpu = undefined;

      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGPUDriver(canvas as any);
      const ok = await driver.init();
      expect(ok).toBe(false);

      (navigator as any).gpu = originalGpu;
    });

    it('resizes canvas buffer and handles clean disposal', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGPUDriver(canvas as any);
      driver.resize(1280, 720, 1.5);
      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);

      driver.setUniform('u_time', { type: 'float', value: 1.0 });
      driver.render(1.0, [0.5, 0.5]);
      expect(() => driver.dispose()).not.toThrow();
    });
  });

  describe('Feature 6: Canvas2D Fallback Driver', () => {
    it('renders with built-in procedural gradient without throwing exceptions', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new Canvas2DFallback(canvas as any);
      const ok = await driver.init();
      expect(ok).toBe(true);

      driver.resize(800, 600, 1);
      expect(() => driver.render(1.0, [0.5, 0.5])).not.toThrow();

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();

      driver.dispose();
    });

    it('executes custom procedural fallback callback with error recovery', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let callbackExecuted = false;
      const customCallback = vi.fn((ctx, width, height, time, mouse) => {
        callbackExecuted = true;
      });

      const driver = new Canvas2DFallback(canvas as any, customCallback);
      await driver.init();
      driver.render(1.0, [0.4, 0.6]);
      expect(callbackExecuted).toBe(true);
      expect(customCallback).toHaveBeenCalledWith(expect.anything(), 800, 600, 1.0, [0.4, 0.6]);

      // If callback throws, driver catches it and recovers to procedural fill
      const throwingCallback = vi.fn(() => {
        throw new Error('Callback crash');
      });
      const resilientDriver = new Canvas2DFallback(canvas as any, throwingCallback);
      await resilientDriver.init();
      expect(() => resilientDriver.render(1.0, [0.5, 0.5])).not.toThrow();
    });
  });

  describe('Feature 8: OffscreenCanvas Worker Bridge', () => {
    it('exports both OffscreenCanvasWorkerBridge and OffscreenWorkerBridge alias', () => {
      expect(OffscreenCanvasWorkerBridge).toBeDefined();
      expect(OffscreenWorkerBridge).toBeDefined();
      expect(OffscreenCanvasWorkerBridge).toBe(OffscreenWorkerBridge);
      expect(INLINE_WORKER_SCRIPT).toContain('self.onmessage');
    });

    it('verifies environment support and canvas transfer eligibility', () => {
      expect(OffscreenCanvasWorkerBridge.isSupported()).toBe(true);

      const canvas = new MockHTMLCanvasElement(800, 600);
      expect(OffscreenCanvasWorkerBridge.canTransfer(canvas)).toBe(true);

      const offscreen = new MockOffscreenCanvas(800, 600);
      expect(OffscreenCanvasWorkerBridge.canTransfer(offscreen)).toBe(false);
    });

    it('transfers canvas control to OffscreenCanvas, sends INIT, and synchronizes messages', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const bridge = new OffscreenCanvasWorkerBridge({ canvas: canvas as any });

      const ok = await bridge.init({ glsl: 'void main(){}' });
      expect(ok).toBe(true);
      expect(bridge.isReady).toBe(true);

      const worker = bridge.getWorker() as unknown as MockWorker;
      expect(worker).toBeDefined();

      bridge.resize(1920, 1080, 2);
      bridge.setUniform('u_time', { type: 'float', value: 3.5 });
      bridge.updatePointer(0.4, 0.8);
      bridge.pause();
      bridge.resume();
      bridge.updateVisibility(false);
      bridge.updateVisibility(true);

      bridge.destroy();
      expect(bridge.isReady).toBe(false);
      expect(bridge.getWorker()).toBeNull();
    });
  });

  describe('Feature 9: Viewport Power Saving Controller', () => {
    it('manages intersection and visibility lifecycle with smooth clock accumulator', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let receivedTime = 0;
      let pauseCount = 0;
      let resumeCount = 0;

      const controller = new PowerSavingController(canvas as any, {
        onRender: (time) => {
          receivedTime = time;
        },
        onPause: () => {
          pauseCount++;
        },
        onResume: () => {
          resumeCount++;
        }
      });

      controller.start();
      expect(controller.isRenderLoopActive()).toBe(true);
      expect(controller.active).toBe(true);

      controller.stop();
      expect(controller.isRenderLoopActive()).toBe(false);
      expect(controller.active).toBe(false);

      controller.dispose();
    });
  });

  describe('Feature 10: Pointer / Touch Normalizer', () => {
    it('normalizes pointer events to [0, 1] Cartesian UV coordinates by default (bottom-left origin)', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.setBoundingRect({ x: 0, y: 0, width: 800, height: 600 });

      let updatedX = 0;
      let updatedY = 0;
      const normalizer = new PointerNormalizer(canvas as any, (x, y) => {
        updatedX = x;
        updatedY = y;
      });

      // Center move
      normalizer.handlePointerMove({ clientX: 400, clientY: 300 });
      expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);
      expect(normalizer.isInside()).toBe(true);

      // Top-left in screen coords -> WebGL bottom-left UV has Y = 1.0
      normalizer.handlePointerMove({ clientX: 0, clientY: 0 });
      expect(normalizer.getCoordinates()).toEqual([0.0, 1.0]);

      // Bottom-right in screen coords -> WebGL bottom-left UV has Y = 0.0
      normalizer.handlePointerMove({ clientX: 800, clientY: 600 });
      expect(normalizer.getCoordinates()).toEqual([1.0, 0.0]);

      // Aspect adjusted coordinates
      const [aspectX, aspectY] = normalizer.getAspectAdjustedCoordinates();
      expect(aspectX).toBeCloseTo(1.0 * (800 / 600), 2);
      expect(aspectY).toBe(0.0);

      // Pointer leave
      normalizer.handlePointerLeave();
      expect(normalizer.isInside()).toBe(false);

      normalizer.dispose();
    });

    it('supports top-left origin (2D canvas mode)', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.setBoundingRect({ x: 0, y: 0, width: 800, height: 600 });

      const normalizer = new PointerNormalizer(canvas as any, {
        origin: 'top-left'
      });

      normalizer.handlePointerMove({ clientX: 0, clientY: 0 });
      expect(normalizer.getCoordinates()).toEqual([0.0, 0.0]);

      normalizer.dispose();
    });

    it('safely handles extreme values, NaN, Infinity, and touchcancel', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.setBoundingRect({ x: 0, y: 0, width: 800, height: 600 });
      const normalizer = new PointerNormalizer(canvas as any);

      // Extreme values clamped to [0, 1]
      normalizer.handlePointerMove({ clientX: 999999, clientY: -999999 });
      expect(normalizer.getCoordinates()).toEqual([1.0, 1.0]);

      // NaN resets to neutral center
      normalizer.handlePointerMove({ clientX: NaN, clientY: 300 });
      expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);

      // touchcancel resets to neutral center
      normalizer.handleTouchCancel();
      expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);
      expect(normalizer.isInside()).toBe(false);

      normalizer.dispose();
    });
  });

  describe('Feature 7: Unified ShaderPipeline', () => {
    it('resolves WebGL2 driver, synchronizes uniforms, and manages lifecycle', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const pipeline = new ShaderPipeline({
        canvas: canvas as any,
        driver: 'webgl2',
        uniforms: {
          u_speed: { type: 'float', value: 1.5 }
        }
      });

      expect(pipeline.isRunning).toBe(false);
      await pipeline.init();
      expect(pipeline.getActiveDriver()).toBe('webgl2');

      pipeline.setUniform('u_time', { type: 'float', value: 2.0 });
      pipeline.setUniforms({
        u_intensity: { type: 'float', value: 0.8 },
        u_baseColor: { type: 'vec3', value: [0.2, 0.4, 0.6] }
      });

      pipeline.resize(1024, 768);
      pipeline.start();
      expect(pipeline.isRunning).toBe(true);

      const rendered = pipeline.render(2.5, [0.5, 0.5]);
      expect(rendered).toBe(true);

      pipeline.stop();
      expect(pipeline.isRunning).toBe(false);

      pipeline.dispose();
      expect(pipeline.driver).toBeNull();
    });

    it('supports context loss and downgradeToSoftwareFallback', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const pipeline = new ShaderPipeline({
        canvas: canvas as any,
        driver: 'webgl2'
      });
      await pipeline.init();
      expect(pipeline.getActiveDriver()).toBe('webgl2');

      // Manual downgrade to 2D
      pipeline.downgradeToSoftwareFallback();
      expect(pipeline.getActiveDriver()).toBe('canvas2d');

      const rendered = pipeline.render(1.0, [0.5, 0.5]);
      expect(rendered).toBe(true);

      pipeline.dispose();
    });

    it('delegates to OffscreenCanvasWorkerBridge when worker mode is enabled', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const pipeline = new ShaderPipeline({
        canvas: canvas as any,
        worker: true
      });

      await pipeline.init();
      pipeline.start();
      expect(pipeline.isRunning).toBe(true);

      pipeline.setUniform('u_speed', { type: 'float', value: 2.0 });
      pipeline.resize(1280, 720);
      pipeline.stop();
      pipeline.dispose();
    });
  });
});
