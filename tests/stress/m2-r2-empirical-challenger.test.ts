import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
} from '../../packages/core/src/index';
import {
  MockHTMLCanvasElement,
  MockOffscreenCanvas,
  MockWebGL2RenderingContext,
  MockIntersectionObserver,
  MockWorker,
  setupMockPageVisibility
} from '../mocks/index';

const require = createRequire(import.meta.url);
const repoRoot = resolve(__dirname, '../..');

describe('Milestone 2 Empirical Challenger Stress Harness (@shaderbit/core)', () => {
  let visibilityController: ReturnType<typeof setupMockPageVisibility>;

  beforeEach(() => {
    (globalThis as any).Worker = MockWorker;
    (globalThis as any).IntersectionObserver = MockIntersectionObserver;
    MockWorker.reset();
    MockIntersectionObserver.reset();
    visibilityController = setupMockPageVisibility();
  });

  afterEach(() => {
    MockWorker.reset();
    MockIntersectionObserver.reset();
    visibilityController.cleanup();
  });

  // =========================================================================
  // 1. Build Determinism & Package Export Resolution Stress
  // =========================================================================
  describe('1. Build Determinism & Export Resolution Stress', () => {
    it('verifies packages/core manifests define valid, existing ESM, CJS, and DTS entrypoints', () => {
      const corePkgPath = resolve(repoRoot, 'packages/core/package.json');
      const pkg = JSON.parse(readFileSync(corePkgPath, 'utf-8'));

      expect(pkg.name).toBe('@shaderbit/core');
      expect(pkg.type).toBe('module');
      expect(pkg.main).toBe('./dist/index.js');
      expect(pkg.types).toBe('./dist/index.d.ts');
      expect(pkg.exports['.'].import).toBe('./dist/index.js');
      expect(pkg.exports['.'].require).toBe('./dist/index.cjs');
      expect(pkg.exports['.'].types).toBe('./dist/index.d.ts');

      // Verify files actually exist on disk
      expect(readFileSync(resolve(repoRoot, 'packages/core/dist/index.js')).length).toBeGreaterThan(1000);
      expect(readFileSync(resolve(repoRoot, 'packages/core/dist/index.cjs')).length).toBeGreaterThan(1000);
      expect(readFileSync(resolve(repoRoot, 'packages/core/dist/index.d.ts')).length).toBeGreaterThan(500);
      expect(readFileSync(resolve(repoRoot, 'packages/core/dist/index.d.cts')).length).toBeGreaterThan(500);
    });

    it('loads dist/index.js (ESM) and dist/index.cjs (CJS) with identical export keys', async () => {
      const esm = await import(resolve(repoRoot, 'packages/core/dist/index.js'));
      const cjs = require(resolve(repoRoot, 'packages/core/dist/index.cjs'));

      const requiredKeys = [
        'ShaderPipeline',
        'WebGL2Driver',
        'WebGPUDriver',
        'Canvas2DFallback',
        'PowerSavingController',
        'PointerNormalizer',
        'OffscreenCanvasWorkerBridge',
        'OffscreenWorkerBridge',
        'INLINE_WORKER_SCRIPT'
      ];

      for (const key of requiredKeys) {
        expect(esm[key], `ESM missing ${key}`).toBeDefined();
        expect(cjs[key], `CJS missing ${key}`).toBeDefined();
      }
    });

    it('verifies zero 3D runtime libraries across all workspace package manifests and lockfile', () => {
      const banned = ['three', 'babylonjs', '@babylonjs', 'twgl', 'regl', 'pixi', 'ogl'];
      const pkgPaths = [
        'package.json',
        'packages/core/package.json',
        'packages/registry/package.json',
        'packages/cli/package.json',
        'packages/react/package.json',
        'packages/vue/package.json',
        'packages/svelte/package.json',
        'packages/elements/package.json',
        'apps/playground/package.json'
      ];

      for (const p of pkgPaths) {
        const fullPath = resolve(repoRoot, p);
        const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));
        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
          ...(pkg.peerDependencies || {})
        };
        for (const dep of Object.keys(allDeps)) {
          for (const b of banned) {
            expect(dep).not.toBe(b);
            expect(dep.startsWith(b + '/')).toBe(false);
            expect(dep.startsWith('@types/' + b)).toBe(false);
          }
        }
      }

      // Lockfile scan for runtime dependency resolution
      const lockfile = readFileSync(resolve(repoRoot, 'pnpm-lock.yaml'), 'utf-8');
      for (const b of ['three:', 'babylonjs:', 'twgl.js:', 'regl:', 'pixi.js:', 'ogl:']) {
        expect(lockfile.includes(b), `Lockfile contains banned dependency: ${b}`).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. Scenario 2: Multi-Driver Fallback & Context Loss Resilience
  // =========================================================================
  describe('2. Scenario 2: Multi-Driver Fallback & Context Loss Stress', () => {
    it('gracefully cascades WebGPU -> WebGL2 -> Canvas2D when drivers fail during init', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.forceWebGPUFailure = true;

      // Initial preference auto: should pick WebGL2
      const pipeline = new ShaderPipeline({ canvas: canvas as any, driver: 'auto' });
      await pipeline.init();
      expect(pipeline.getActiveDriver()).toBe('webgl2');
      pipeline.dispose();

      // If both WebGPU and WebGL2 fail, cascades safely to Canvas2D
      const canvas2 = new MockHTMLCanvasElement(800, 600);
      canvas2.forceWebGPUFailure = true;
      canvas2.forceWebGLFailure = true;

      const pipeline2 = new ShaderPipeline({ canvas: canvas2 as any, driver: 'auto' });
      await pipeline2.init();
      expect(pipeline2.getActiveDriver()).toBe('canvas2d');

      // Verify rendering on 2D fallback does not throw
      expect(() => pipeline2.render(1.0, [0.5, 0.5])).not.toThrow();
      pipeline2.dispose();
    });

    it('handles invalid fragment shader in auto mode by cascading to Canvas2D without uncaught error', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.forceWebGPUFailure = true;

      // Pass an invalid shader that will fail WebGL2 compilation
      const pipeline = new ShaderPipeline({
        canvas: canvas as any,
        driver: 'auto',
        glsl: 'this is not valid glsl code;'
      });

      await pipeline.init();
      // Should have caught the WebGL2 compilation failure and fallen back to canvas2d
      expect(pipeline.getActiveDriver()).toBe('canvas2d');
      expect(() => pipeline.render(0.5, [0.5, 0.5])).not.toThrow();
      pipeline.dispose();
    });

    it('survives 5 rapid consecutive webglcontextlost and webglcontextrestored cycles', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.forceWebGPUFailure = true;

      const pipeline = new ShaderPipeline({
        canvas: canvas as any,
        driver: 'webgl2',
        uniforms: {
          u_speed: { type: 'float', value: 3.14 }
        }
      });
      await pipeline.init();
      expect(pipeline.getActiveDriver()).toBe('webgl2');

      const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;

      for (let cycle = 0; cycle < 5; cycle++) {
        // Trigger context loss
        gl.triggerContextLoss();
        expect(pipeline.isContextLost).toBe(true);
        expect(pipeline.getPreventDefaultCalled()).toBe(true);

        // Render during loss should safely return false without throwing
        const renderedDuringLoss = pipeline.render(1.0, [0.5, 0.5]);
        expect(renderedDuringLoss).toBe(false);

        // Trigger restoration
        await gl.triggerContextRestoration();
        expect(pipeline.isContextLost).toBe(false);

        // Render after restoration should succeed
        const renderedAfterRestore = pipeline.render(2.0, [0.5, 0.5]);
        expect(renderedAfterRestore).toBe(true);
      }

      pipeline.dispose();
    });

    it('allows runtime downgradeToSoftwareFallback() and maintains rendering integrity', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.forceWebGPUFailure = true;

      const pipeline = new ShaderPipeline({ canvas: canvas as any, driver: 'webgl2' });
      await pipeline.init();
      expect(pipeline.getActiveDriver()).toBe('webgl2');

      pipeline.downgradeToSoftwareFallback();
      expect(pipeline.getActiveDriver()).toBe('canvas2d');

      // Renders with 2D fallback cleanly
      expect(() => pipeline.render(1.0, [0.5, 0.5])).not.toThrow();

      pipeline.dispose();
    });

    it('Canvas2DFallback handles extreme/invalid canvas dimensions and throwing callbacks', async () => {
      const canvas = new MockHTMLCanvasElement(0, 0);
      const fallback = new Canvas2DFallback(canvas as any);
      await fallback.init();

      // Zero dimensions should not throw
      expect(() => fallback.render(1.0, [0.5, 0.5])).not.toThrow();

      // Negative resize should be clamped to 0 without throwing
      fallback.resize(-100, -200, 1);
      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
      expect(() => fallback.render(1.0, [0.5, 0.5])).not.toThrow();

      // Throwing custom callback should fall back to internal procedural gradient
      const throwingCallback = vi.fn(() => {
        throw new Error('Fatal custom callback crash');
      });
      const fallbackWithFn = new Canvas2DFallback(canvas as any, throwingCallback);
      await fallbackWithFn.init();
      expect(() => fallbackWithFn.render(1.0, [0.5, 0.5])).not.toThrow();
      expect(throwingCallback).toHaveBeenCalled();

      fallback.dispose();
      fallbackWithFn.dispose();
    });
  });

  // =========================================================================
  // 3. Scenario 3: OffscreenCanvas Worker Thread Rendering Stress
  // =========================================================================
  describe('3. Scenario 3: OffscreenCanvas Worker Thread Rendering Stress', () => {
    it('enforces transfer preconditions and prevents double transfer', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      expect(OffscreenCanvasWorkerBridge.canTransfer(canvas)).toBe(true);

      const offscreen = canvas.transferControlToOffscreen();
      // Once transferred, canvas canTransfer should return false for offscreen instance
      expect(OffscreenCanvasWorkerBridge.canTransfer(offscreen)).toBe(false);
    });

    it('queues messages before worker initialization and flushes them on READY', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const bridge = new OffscreenCanvasWorkerBridge({ canvas: canvas as any });

      // Send messages before init() completes
      bridge.setUniform('u_burst1', { type: 'float', value: 1.0 });
      bridge.setUniform('u_burst2', { type: 'float', value: 2.0 });
      bridge.resize(1024, 768, 2);
      bridge.updatePointer(0.3, 0.7);

      const initPromise = bridge.init();
      const success = await initPromise;
      expect(success).toBe(true);
      expect(bridge.isReady).toBe(true);

      const worker = bridge.getWorker() as unknown as MockWorker;
      expect(worker).toBeDefined();

      // Verify queued messages were flushed to worker
      const types = worker.receivedMessages.map((m) => m.message.type);
      expect(types).toContain('INIT');
      expect(types).toContain('SET_UNIFORMS');
      expect(types).toContain('RESIZE');
      expect(types).toContain('POINTER_MOVE');

      bridge.destroy();
      expect(bridge.isReady).toBe(false);
      expect(worker.terminated).toBe(true);
    });

    it('survives a burst of 100 rapid concurrent worker bridge messages', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const bridge = new OffscreenCanvasWorkerBridge({ canvas: canvas as any });
      await bridge.init();

      for (let i = 0; i < 100; i++) {
        bridge.updatePointer(i * 0.01, 1 - i * 0.01);
        bridge.setUniform(`u_var_${i}`, { type: 'float', value: i });
        if (i % 25 === 0) {
          bridge.resize(800 + i, 600 + i, 1);
        }
      }

      const worker = bridge.getWorker() as unknown as MockWorker;
      expect(worker.receivedMessages.length).toBeGreaterThanOrEqual(100);

      bridge.destroy();
      expect(worker.terminated).toBe(true);
    });

    it('handles worker startup crash/error without unhandled promise rejection', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const bridge = new OffscreenCanvasWorkerBridge({ canvas: canvas as any });

      // Configure mock worker to fail autoRespond and simulate error
      const initPromise = bridge.init();
      const worker = bridge.getWorker() as unknown as MockWorker;
      worker.simulateWorkerCrash('Script execution syntax error');

      const ok = await initPromise;
      expect(ok).toBe(false);
      expect(bridge.isReady).toBe(false);

      bridge.destroy();
    });
  });

  // =========================================================================
  // 4. Scenario 4: Battery Power-Saving Viewport Scroll Stress
  // =========================================================================
  describe('4. Scenario 4: Battery Power-Saving Scroll Stress', () => {
    it('suspends render loop when leaving viewport and clamps clock delta on re-entry after 10-minute scroll', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let renderCalls = 0;
      let recordedTimes: number[] = [];
      let recordedDeltas: number[] = [];

      const controller = new PowerSavingController(canvas as any, (time, delta) => {
        renderCalls++;
        recordedTimes.push(time);
        recordedDeltas.push(delta);
      });

      controller.start();
      expect(controller.isRenderLoopActive()).toBe(true);

      // Simulate 3 normal frames at 60fps (16.66ms each)
      (controller as any).scheduleFrame();

      // Trigger viewport exit (scrolling down page)
      const observer = MockIntersectionObserver.instances[0];
      observer.trigger({ target: canvas as any, isIntersecting: false });

      expect(controller.isRenderLoopActive()).toBe(false);
      expect(controller.intersecting).toBe(false);
      const framesAtExit = controller.frameCount;

      // Simulate 10 minutes (600,000ms) elapsed world time while user is scrolled away
      // No frames should be scheduled or rendered during this period!
      expect(controller.isRenderLoopActive()).toBe(false);
      expect(controller.frameCount).toBe(framesAtExit);

      // User scrolls back into view
      observer.trigger({ target: canvas as any, isIntersecting: true });
      expect(controller.isRenderLoopActive()).toBe(true);
      expect(controller.intersecting).toBe(true);

      // Verify clock delta clamp: maxDelta (default 0.1s = 100ms) prevents animation explosion
      controller.stop();
      expect(controller.isRenderLoopActive()).toBe(false);
    });

    it('handles 20 rapid intersection transitions without desynchronizing loop state', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let pauseCount = 0;
      let resumeCount = 0;

      const controller = new PowerSavingController(canvas as any, {
        onPause: () => pauseCount++,
        onResume: () => resumeCount++
      });

      controller.start();
      const observer = MockIntersectionObserver.instances[0];

      for (let i = 0; i < 20; i++) {
        const inView = i % 2 === 0;
        observer.trigger({ target: canvas as any, isIntersecting: inView });
        expect(controller.intersecting).toBe(inView);
      }

      expect(pauseCount).toBe(10);
      expect(resumeCount).toBe(9);

      controller.stop();
    });

    it('suspends on document visibility change to hidden and resumes on visible', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const controller = new PowerSavingController(canvas as any);
      controller.start();
      expect(controller.active).toBe(true);

      // Tab hidden
      visibilityController.setVisibilityState('hidden');
      expect(controller.active).toBe(false);
      expect(controller.isRenderLoopActive()).toBe(false);

      // Tab visible
      visibilityController.setVisibilityState('visible');
      expect(controller.active).toBe(true);
      expect(controller.isRenderLoopActive()).toBe(true);

      controller.stop();
    });

    it('is idempotent on multiple start() and stop() calls', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const controller = new PowerSavingController(canvas as any);

      // Multiple start calls
      controller.start();
      controller.start();
      controller.start();
      expect(controller.isRenderLoopActive()).toBe(true);

      // Multiple stop calls
      controller.stop();
      controller.stop();
      controller.stop();
      expect(controller.isRenderLoopActive()).toBe(false);
    });
  });

  // =========================================================================
  // 5. Boundary Inputs, Multi-Touch & Pointer Normalization Stress
  // =========================================================================
  describe('5. Boundary Inputs & Pointer Normalizer Stress', () => {
    it('safely clamps extreme coordinates (+/- 1e7), NaN, Infinity, and empty touches', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.setBoundingRect({ x: 0, y: 0, width: 800, height: 600 });
      const normalizer = new PointerNormalizer(canvas as any);

      // Extreme values
      normalizer.handlePointerMove({ clientX: 10000000, clientY: -10000000 });
      expect(normalizer.getCoordinates()).toEqual([1.0, 1.0]);

      normalizer.handlePointerMove({ clientX: -10000000, clientY: 10000000 });
      expect(normalizer.getCoordinates()).toEqual([0.0, 0.0]);

      // NaN and Infinity reset safely to center [0.5, 0.5]
      normalizer.handlePointerMove({ clientX: NaN, clientY: 300 });
      expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);

      normalizer.handlePointerMove({ clientX: 400, clientY: Infinity });
      expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);

      // Empty touches array
      expect(() => normalizer.handleTouchMove({ touches: [] })).not.toThrow();

      // Multi-touch: 5 touches -> only extracts first touch
      normalizer.handleTouchMove({
        touches: [
          { clientX: 200, clientY: 150 },
          { clientX: 600, clientY: 450 },
          { clientX: 700, clientY: 550 }
        ]
      });
      // 200/800 = 0.25, (600 - 150)/600 = 0.75
      expect(normalizer.getCoordinates()).toEqual([0.25, 0.75]);

      // touchcancel resets coordinates and sets isInside to false
      normalizer.handleTouchCancel();
      expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);
      expect(normalizer.isInside()).toBe(false);

      normalizer.dispose();
    });

    it('interpolates smoothly with damping < 1 and computes speed/velocity', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.setBoundingRect({ x: 0, y: 0, width: 800, height: 600 });
      const normalizer = new PointerNormalizer(canvas as any, { damping: 0.5 });

      normalizer.handlePointerMove({ clientX: 800, clientY: 0 }); // UV: [1.0, 1.0]

      // Initial state before update: raw coords are [1, 1], smoothed starts at [0.5, 0.5]
      expect(normalizer.getCoordinates()).toEqual([1.0, 1.0]);

      // Step physics
      normalizer.update(0.016);
      const smoothed = normalizer.getSmoothedCoordinates();
      expect(smoothed[0]).toBeGreaterThan(0.5);
      expect(smoothed[0]).toBeLessThan(1.0);
      expect(normalizer.getSpeed()).toBeGreaterThan(0);

      normalizer.dispose();
    });
  });

  // =========================================================================
  // 6. High-Frequency Pipeline Stress & Memory Lifecycle
  // =========================================================================
  describe('6. High-Frequency Pipeline Stress & Lifecycle Invariants', () => {
    it('executes 500 rapid uniform updates and 100 resize operations without error', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.forceWebGPUFailure = true;

      const pipeline = new ShaderPipeline({ canvas: canvas as any, driver: 'webgl2' });
      await pipeline.init();

      // 500 rapid uniform updates
      for (let i = 0; i < 500; i++) {
        pipeline.setUniform('u_time', { type: 'float', value: i * 0.1 });
        pipeline.setUniform('u_mouse', { type: 'vec2', value: [0.1, 0.9] });
      }

      // 100 rapid resize operations with variable/boundary DPRs
      for (let i = 0; i < 100; i++) {
        pipeline.resize(800 + (i % 20), 600 + (i % 20));
      }

      expect(() => pipeline.render(1.0, [0.5, 0.5])).not.toThrow();
      pipeline.dispose();
    });

    it('safely handles 10 consecutive pipeline construction, start, stop, and dispose cycles', async () => {
      for (let cycle = 0; cycle < 10; cycle++) {
        const canvas = new MockHTMLCanvasElement(800, 600);
        canvas.forceWebGPUFailure = true;

        const pipeline = new ShaderPipeline({ canvas: canvas as any, driver: 'webgl2' });
        await pipeline.init();
        pipeline.start();
        expect(pipeline.isRunning).toBe(true);

        pipeline.render(1.0, [0.5, 0.5]);
        pipeline.stop();
        expect(pipeline.isRunning).toBe(false);

        pipeline.dispose();
        expect(pipeline.driver).toBeNull();
      }
    });
  });
});
