/**
 * Milestone 2 Adversarial Stress & Empirical Challenge Suite
 * Thoroughly probes driver boundary conditions, context loss/restoration,
 * software fallback hierarchies, worker bridge handshakes, power-saving delta clamps,
 * and pointer normalizer physical state boundaries.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebGL2Driver,
  WebGPUDriver,
  Canvas2DFallback,
  OffscreenCanvasWorkerBridge,
  PowerSavingController,
  PointerNormalizer,
  ShaderPipeline,
  INLINE_WORKER_SCRIPT
} from '../../packages/core/src/index';

import {
  MockHTMLCanvasElement,
  MockOffscreenCanvas
} from '../mocks/canvas';
import { MockWebGL2RenderingContext } from '../mocks/webgl2';
import { MockWorker } from '../mocks/worker';
import { MockIntersectionObserver } from '../mocks/observers';

describe('Milestone 2 Adversarial Challenge & Stress Suite (@shaderbit/core)', () => {
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

  // =========================================================================
  // 1. WebGL2 Driver Boundary & Stress Tests
  // =========================================================================
  describe('1. WebGL2 Driver Boundary & Stress', () => {
    it('handles 20 consecutive rapid context loss and restoration cycles without state corruption', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGL2Driver(canvas as any);
      const ok = await driver.init();
      expect(ok).toBe(true);

      const gl = canvas.getContext('webgl2') as unknown as MockWebGL2RenderingContext;
      const loseExt = gl.getExtension('WEBGL_lose_context') as any;
      expect(loseExt).toBeDefined();

      for (let i = 0; i < 20; i++) {
        // Lose context
        loseExt.loseContext();
        expect(driver.isContextLost).toBe(true);
        expect(gl.isContextLost()).toBe(true);

        // Draw call during context loss must be safely suppressed
        const initialDrawCalls = gl.drawCalls.length;
        driver.render(i, [0.5, 0.5]);
        expect(gl.drawCalls.length).toBe(initialDrawCalls);

        // Restore context
        loseExt.restoreContext();
        expect(gl.isContextLost()).toBe(false);

        // Re-init after restore
        await driver.init();
        expect(driver.isContextLost).toBe(false);
        driver.render(i + 1, [0.5, 0.5]);
        expect(gl.drawCalls.length).toBeGreaterThan(initialDrawCalls);
      }

      driver.dispose();
      expect(driver.isContextLost).toBe(true);
    });

    it('rejects empty and whitespace-only GLSL shader strings with descriptive errors', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGL2Driver(canvas as any);

      await expect(driver.init('')).rejects.toThrow(/empty shader source/i);
      await expect(driver.init('   ')).rejects.toThrow(/empty shader source/i);
      await expect(driver.init('\n\t\r  ')).rejects.toThrow(/empty shader source/i);
    });

    it('reports compilation failures with shader compiler log diagnostics', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGL2Driver(canvas as any);

      const gl = canvas.getContext('webgl2') as unknown as MockWebGL2RenderingContext;
      gl.compileShader = vi.fn((shader: any) => {
        if (shader.type === gl.FRAGMENT_SHADER) {
          shader.compiled = false;
          shader.infoLog = 'SYNTAX ERROR at line 42: undeclared identifier';
        } else {
          shader.compiled = true;
          shader.infoLog = '';
        }
      });

      await expect(driver.init('void main() { INVALID; }')).rejects.toThrow(
        /Fragment shader compilation failed: SYNTAX ERROR at line 42/i
      );
    });

    it('silently ignores undeclared uniforms and handles diverse value formats', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGL2Driver(canvas as any);
      await driver.init();

      // Silently skips undeclared uniforms without exception
      expect(() => driver.setUniform('u_nonexistent', { type: 'float', value: 1.0 })).not.toThrow();

      // Various value formats
      expect(() => driver.setUniform('u_float_val', 2.5)).not.toThrow();
      expect(() => driver.setUniform('u_int_val', 10)).not.toThrow();
      expect(() => driver.setUniform('u_vec2_val', [1.0, 2.0])).not.toThrow();
      expect(() => driver.setUniform('u_vec3_val', [1.0, 2.0, 3.0])).not.toThrow();
      expect(() => driver.setUniform('u_vec4_val', [1.0, 2.0, 3.0, 4.0])).not.toThrow();

      driver.dispose();
    });

    it('clamps 0x0 and negative dimensions safely', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGL2Driver(canvas as any);

      driver.resize(0, 0, 1);
      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);

      driver.resize(-100, -200, 1);
      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);

      // Invalid DPR fallback to 1
      driver.resize(800, 600, -2);
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);

      driver.resize(800, 600, NaN);
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);

      // Extreme 16K dimensions
      driver.resize(15360, 8640, 1);
      expect(canvas.width).toBe(15360);
      expect(canvas.height).toBe(8640);
    });

    it('ensures dispose() is completely idempotent and safe against multiple invocations', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGL2Driver(canvas as any);
      await driver.init();

      expect(() => {
        driver.dispose();
        driver.dispose();
        driver.dispose();
      }).not.toThrow();

      expect(driver.isContextLost).toBe(true);
    });
  });

  // =========================================================================
  // 2. WebGPU Driver Boundary & Fallback Tests
  // =========================================================================
  describe('2. WebGPU Driver Boundary & Fallbacks', () => {
    it('returns false cleanly when navigator.gpu is absent without modifying canvas', async () => {
      const originalGpu = (navigator as any).gpu;
      (navigator as any).gpu = undefined;

      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGPUDriver(canvas as any);

      const ok = await driver.init();
      expect(ok).toBe(false);

      // Verify canvas context was not acquired, allowing subsequent WebGL2 acquisition
      expect((canvas as any)._activeContextType).toBeNull();

      (navigator as any).gpu = originalGpu;
    });

    it('returns false cleanly when requestAdapter() returns null', async () => {
      const originalGpu = (navigator as any).gpu;
      (navigator as any).gpu = {
        requestAdapter: async () => null
      };

      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGPUDriver(canvas as any);

      const ok = await driver.init();
      expect(ok).toBe(false);
      expect((canvas as any)._activeContextType).toBeNull();

      (navigator as any).gpu = originalGpu;
    });

    it('returns false cleanly when requestDevice() throws', async () => {
      const originalGpu = (navigator as any).gpu;
      (navigator as any).gpu = {
        requestAdapter: async () => ({
          requestDevice: async () => {
            throw new Error('Device allocation failure');
          }
        })
      };

      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGPUDriver(canvas as any);

      const ok = await driver.init();
      expect(ok).toBe(false);

      (navigator as any).gpu = originalGpu;
    });

    it('rejects empty and whitespace-only WGSL source code', async () => {
      const originalGpu = (navigator as any).gpu;
      (navigator as any).gpu = {
        requestAdapter: async () => ({
          requestDevice: async () => ({
            createShaderModule: () => ({}),
            createBuffer: () => ({ destroy: () => {} }),
            createRenderPipeline: () => ({}),
            destroy: () => {}
          })
        }),
        getPreferredCanvasFormat: () => 'bgra8unorm'
      };

      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGPUDriver(canvas as any);

      await expect(driver.init(undefined, '')).rejects.toThrow(/empty shader source/i);
      await expect(driver.init(undefined, '   \t\n  ')).rejects.toThrow(/empty shader source/i);

      (navigator as any).gpu = originalGpu;
    });

    it('suppresses draw calls upon device loss notification', async () => {
      let lostCallback: (() => void) | null = null;
      let drawCallExecuted = false;

      const mockDevice = {
        lost: {
          then: (cb: () => void) => {
            lostCallback = cb;
          }
        },
        createShaderModule: () => ({}),
        createBuffer: () => ({ destroy: () => {} }),
        createRenderPipeline: () => ({}),
        createCommandEncoder: () => ({
          beginRenderPass: () => ({
            setPipeline: () => {},
            draw: () => {
              drawCallExecuted = true;
            },
            end: () => {}
          }),
          finish: () => ({})
        }),
        queue: {
          submit: () => {}
        },
        destroy: () => {}
      };

      const originalGpu = (navigator as any).gpu;
      (navigator as any).gpu = {
        requestAdapter: async () => ({
          requestDevice: async () => mockDevice
        }),
        getPreferredCanvasFormat: () => 'bgra8unorm'
      };

      const canvas = new MockHTMLCanvasElement(800, 600);
      const driver = new WebGPUDriver(canvas as any);
      await driver.init();

      // Initial render works
      driver.render(1.0, [0.5, 0.5]);
      expect(drawCallExecuted).toBe(true);

      // Trigger device loss
      drawCallExecuted = false;
      if (typeof lostCallback === 'function') {
        (lostCallback as () => void)();
      }

      // Render after loss is suppressed
      driver.render(2.0, [0.5, 0.5]);
      expect(drawCallExecuted).toBe(false);

      driver.dispose();
      (navigator as any).gpu = originalGpu;
    });
  });

  // =========================================================================
  // 3. Canvas2D Software Fallback Resilience Tests
  // =========================================================================
  describe('3. Canvas2D Software Fallback Resilience', () => {
    it('executes procedural gradient without exceptions on various canvas dimensions', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const fallback = new Canvas2DFallback(canvas as any);
      const ok = await fallback.init();
      expect(ok).toBe(true);

      expect(() => fallback.render(1.0, [0.5, 0.5])).not.toThrow();

      // Zero-area canvas returns safely without draw operations
      canvas.width = 0;
      canvas.height = 0;
      expect(() => fallback.render(1.0, [0.5, 0.5])).not.toThrow();

      fallback.dispose();
    });

    it('safely catches custom fallback callback exceptions and recovers to procedural fill', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let attempts = 0;
      const failingFn = () => {
        attempts++;
        throw new Error('Kernel panic inside custom 2D shader');
      };

      const fallback = new Canvas2DFallback(canvas as any, failingFn);
      await fallback.init();

      expect(() => fallback.render(1.0, [0.5, 0.5])).not.toThrow();
      expect(attempts).toBe(1);

      fallback.dispose();
    });

    it('handles negative and non-finite DPRs safely', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const fallback = new Canvas2DFallback(canvas as any);

      fallback.resize(400, 300, -1);
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(300);

      fallback.resize(400, 300, NaN);
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(300);
    });
  });

  // =========================================================================
  // 4. OffscreenCanvas Worker Bridge Stress Tests
  // =========================================================================
  describe('4. OffscreenCanvas Worker Bridge Stress', () => {
    it('checks environment transfer eligibility correctly', () => {
      expect(OffscreenCanvasWorkerBridge.isSupported()).toBe(true);

      const htmlCanvas = new MockHTMLCanvasElement(800, 600);
      expect(OffscreenCanvasWorkerBridge.canTransfer(htmlCanvas)).toBe(true);

      const offscreenCanvas = new MockOffscreenCanvas(800, 600);
      expect(OffscreenCanvasWorkerBridge.canTransfer(offscreenCanvas)).toBe(false);

      expect(OffscreenCanvasWorkerBridge.canTransfer(null)).toBe(false);
      expect(OffscreenCanvasWorkerBridge.canTransfer(undefined)).toBe(false);
      expect(OffscreenCanvasWorkerBridge.canTransfer({})).toBe(false);
    });

    it('queues messages sent during init and flushes them upon INIT_ACK / READY', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const bridge = new OffscreenCanvasWorkerBridge({ canvas: canvas as any });

      // Start init (which creates worker and posts INIT)
      const initPromise = bridge.init();

      // Send messages while init handshake is pending
      bridge.setUniform('u_param', { type: 'float', value: 42 });
      bridge.resize(1024, 768, 2);
      bridge.updatePointer(0.3, 0.7);

      const ok = await initPromise;
      expect(ok).toBe(true);
      expect(bridge.isReady).toBe(true);

      const worker = bridge.getWorker() as unknown as MockWorker;
      expect(worker).toBeDefined();

      // Verify queued messages were posted to worker
      const messageTypes = worker.receivedMessages.map((item: any) => item.message?.type);
      expect(messageTypes).toContain('INIT');
      expect(messageTypes).toContain('UNIFORM_UPDATE');
      expect(messageTypes).toContain('RESIZE');
      expect(messageTypes).toContain('POINTER_MOVE');

      bridge.destroy();
      expect(bridge.isReady).toBe(false);
      expect(bridge.getWorker()).toBeNull();
    });

    it('supports pause, resume, and visibility updates with paired worker messages', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const bridge = new OffscreenCanvasWorkerBridge({ canvas: canvas as any });
      await bridge.init();

      const worker = bridge.getWorker() as unknown as MockWorker;

      bridge.pause();
      expect(worker.receivedMessages.some((item: any) => item.message?.type === 'PAUSE')).toBe(true);

      bridge.resume();
      expect(worker.receivedMessages.some((item: any) => item.message?.type === 'RESUME')).toBe(true);

      bridge.updateVisibility(false);
      expect(worker.receivedMessages.some((item: any) => item.message?.type === 'VISIBILITY' && item.message?.visible === false)).toBe(true);

      bridge.updateVisibility(true);
      expect(worker.receivedMessages.some((item: any) => item.message?.type === 'VISIBILITY' && item.message?.visible === true)).toBe(true);

      bridge.destroy();
    });
  });

  // =========================================================================
  // 5. PowerSavingController Battery Conservation & Clock Clamping Tests
  // =========================================================================
  describe('5. PowerSavingController Battery Conservation & Clock Clamping', () => {
    it('halts RAF loop when out of view and fires pause and resume transitions', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let pauseFired = false;
      let resumeFired = false;

      const controller = new PowerSavingController(
        canvas as any,
        (_time, _delta) => {},
        {
          onPause: () => {
            pauseFired = true;
          },
          onResume: () => {
            resumeFired = true;
          }
        }
      );

      controller.start();
      expect(controller.active).toBe(true);

      // Trigger out of view
      MockIntersectionObserver.triggerForElement(canvas as any, false);
      expect(pauseFired).toBe(true);
      expect(controller.active).toBe(false);

      // Trigger back in view
      MockIntersectionObserver.triggerForElement(canvas as any, true);
      expect(resumeFired).toBe(true);
      expect(controller.active).toBe(true);

      controller.stop();
    });

    it('ensures custom maxDelta bounds frame time increments even under extreme delays', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const receivedDeltas: number[] = [];

      let capturedFrameCallback: ((ts: number) => void) | null = null;
      (globalThis as any).requestAnimationFrame = (cb: (ts: number) => void) => {
        capturedFrameCallback = cb;
        return 101;
      };

      const controller = new PowerSavingController(
        canvas as any,
        (_t, delta) => {
          receivedDeltas.push(delta);
        },
        {
          maxDelta: 0.05 // 50ms cap
        }
      );

      controller.start();
      expect(capturedFrameCallback).not.toBeNull();

      // Frame 1 at t = 1000
      capturedFrameCallback!(1000);

      // Frame 2 at t = 60000 (huge jump of 59,000ms!)
      capturedFrameCallback!(60000);

      expect(receivedDeltas.length).toBe(2);
      // The second delta must be capped to maxDelta = 0.05s
      expect(receivedDeltas[1]).toBeCloseTo(0.05, 3);

      controller.stop();
    });
  });

  // =========================================================================
  // 6. PointerNormalizer Extreme Inputs & Physical State Tests
  // =========================================================================
  describe('6. PointerNormalizer Extreme Inputs & Physical State', () => {
    it('accurately computes aspect ratio UVs and Cartesian bottom-left coordinates', () => {
      const canvas = new MockHTMLCanvasElement(1000, 500);
      canvas.setBoundingRect({ x: 0, y: 0, width: 1000, height: 500 });

      const normalizer = new PointerNormalizer(canvas as any);

      // Move to top-right screen (X=1000, Y=0)
      // WebGL bottom-left: normX = 1.0, normY = 1.0 - 0/500 = 1.0
      normalizer.handlePointerMove({ clientX: 1000, clientY: 0 });
      expect(normalizer.getCoordinates()).toEqual([1.0, 1.0]);

      // Aspect ratio: width/height = 2.0 -> [1.0 * 2.0, 1.0] = [2.0, 1.0]
      const [ax, ay] = normalizer.getAspectAdjustedCoordinates();
      expect(ax).toBeCloseTo(2.0, 2);
      expect(ay).toBeCloseTo(1.0, 2);

      // Move to bottom-left screen (X=0, Y=500)
      // WebGL bottom-left: normX = 0.0, normY = 1.0 - 500/500 = 0.0
      normalizer.handlePointerMove({ clientX: 0, clientY: 500 });
      expect(normalizer.getCoordinates()).toEqual([0.0, 0.0]);

      normalizer.dispose();
    });

    it('resets coordinates and inside state on touchcancel', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.setBoundingRect({ x: 0, y: 0, width: 800, height: 600 });

      let receivedX = 0;
      let receivedY = 0;
      const normalizer = new PointerNormalizer(canvas as any, (x, y) => {
        receivedX = x;
        receivedY = y;
      });

      normalizer.handlePointerMove({ clientX: 200, clientY: 150 });
      expect(normalizer.isInside()).toBe(true);

      normalizer.handleTouchCancel();
      expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);
      expect(normalizer.isInside()).toBe(false);
      expect(receivedX).toBe(0.5);
      expect(receivedY).toBe(0.5);

      normalizer.dispose();
    });

    it('calculates velocity, displacement, and speed with smoothing damping', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.setBoundingRect({ x: 0, y: 0, width: 800, height: 600 });

      const normalizer = new PointerNormalizer(canvas as any, { damping: 0.5 });

      normalizer.handlePointerMove({ clientX: 400, clientY: 300 }); // Center [0.5, 0.5]
      normalizer.update(0.016);

      normalizer.handlePointerMove({ clientX: 800, clientY: 300 }); // Move right to [1.0, 0.5]
      normalizer.update(0.016);

      const state = normalizer.getState();
      expect(state.coords).toEqual([1.0, 0.5]);
      expect(state.displacement[0]).toBeGreaterThan(0);
      expect(state.speed).toBeGreaterThan(0);
      expect(state.velocity[0]).toBeGreaterThan(0);

      normalizer.dispose();
    });
  });

  // =========================================================================
  // 7. Unified ShaderPipeline Integration & Fallback Cascades
  // =========================================================================
  describe('7. Unified ShaderPipeline Cascades & Full Lifecycle', () => {
    it('executes WebGPU -> WebGL2 -> Canvas2D cascade seamlessly', async () => {
      // Both WebGPU and WebGL2 absent -> Canvas2D
      const originalGpu = (navigator as any).gpu;
      (navigator as any).gpu = undefined;

      const canvas = new MockHTMLCanvasElement(800, 600);
      // Suppress webgl2
      const originalGetContext = canvas.getContext.bind(canvas);
      canvas.getContext = ((type: string, ...args: any[]) => {
        if (type === 'webgl2') return null;
        return (originalGetContext as any)(type, ...args);
      }) as any;

      const pipeline = new ShaderPipeline({
        canvas: canvas as any,
        driver: 'auto'
      });

      await pipeline.init();
      expect(pipeline.getActiveDriver()).toBe('canvas2d');

      const rendered = pipeline.render(1.0, [0.5, 0.5]);
      expect(rendered).toBe(true);

      pipeline.dispose();
      (navigator as any).gpu = originalGpu;
    });

    it('recovers from context loss with event.preventDefault() and restores uniform state', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const pipeline = new ShaderPipeline({
        canvas: canvas as any,
        driver: 'webgl2',
        glsl: 'precision highp float; out vec4 fragColor; uniform float u_myVal; void main() { fragColor = vec4(u_myVal); }',
        uniforms: {
          u_myVal: { type: 'float', value: 7.5 }
        }
      });

      await pipeline.init();
      expect(pipeline.getActiveDriver()).toBe('webgl2');
      expect(pipeline.isContextLost).toBe(false);

      const gl = canvas.getContext('webgl2') as unknown as MockWebGL2RenderingContext;
      const loseExt = gl.getExtension('WEBGL_lose_context') as any;

      // Lose context
      loseExt.loseContext();
      expect(pipeline.isContextLost).toBe(true);
      expect(pipeline.getPreventDefaultCalled()).toBe(true);

      // Render while lost is blocked
      expect(pipeline.render(1.0, [0.5, 0.5])).toBe(false);

      // Restore context
      loseExt.restoreContext();
      // Allow async context restore handler to finish
      await new Promise((r) => setTimeout(r, 10));

      expect(pipeline.isContextLost).toBe(false);
      expect(pipeline.render(2.0, [0.5, 0.5])).toBe(true);

      pipeline.dispose();
    });

    it('supports manual downgradeToSoftwareFallback() on the fly', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const pipeline = new ShaderPipeline({
        canvas: canvas as any,
        driver: 'webgl2'
      });

      await pipeline.init();
      expect(pipeline.getActiveDriver()).toBe('webgl2');

      pipeline.downgradeToSoftwareFallback();
      expect(pipeline.getActiveDriver()).toBe('canvas2d');

      const ok = pipeline.render(1.0, [0.5, 0.5]);
      expect(ok).toBe(true);

      pipeline.dispose();
    });

    it('is completely safe against multiple dispose calls', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const pipeline = new ShaderPipeline({
        canvas: canvas as any,
        driver: 'webgl2'
      });

      await pipeline.init();
      pipeline.start();

      expect(() => {
        pipeline.dispose();
        pipeline.dispose();
        pipeline.dispose();
      }).not.toThrow();

      expect(pipeline.isRunning).toBe(false);
      expect(pipeline.driver).toBeNull();
    });
  });
});
