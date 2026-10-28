/**
 * Tier 1 Feature Test: Viewport Power Saving Lifecycle
 * Tests IntersectionObserver culling, Page Visibility API suspension, and clock delta time preservation.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  MockIntersectionObserver,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';

export class PowerSavingController {
  private canvas: MockCanvasElement;
  private onRender: (time: number) => void;
  private isVisible = true;
  private isIntersecting = true;
  private isRunning = false;
  private rafHandle: number | null = null;
  private observer: any = null;
  
  public frameCount = 0;
  public totalElapsedTime = 0;
  private lastTimestamp = 0;
  private pauseTimestamp = 0;

  constructor(canvas: MockCanvasElement, onRender: (time: number) => void) {
    this.canvas = canvas;
    this.onRender = onRender;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.setupObservers();
    this.scheduleFrame();
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafHandle !== null) {
      (globalThis as any).cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private setupObservers(): void {
    // Intersection Observer
    if (typeof (globalThis as any).IntersectionObserver !== 'undefined') {
      this.observer = new (globalThis as any).IntersectionObserver((entries: any[]) => {
        for (const entry of entries) {
          if (entry.target === this.canvas) {
            this.setIntersection(entry.isIntersecting);
          }
        }
      });
      this.observer.observe(this.canvas);
    }

    // Visibility API
    if (typeof (globalThis as any).document !== 'undefined') {
      (globalThis as any).document.addEventListener('visibilitychange', () => {
        this.setVisibility((globalThis as any).document.visibilityState === 'visible');
      });
    }
  }

  private setIntersection(intersecting: boolean): void {
    const wasActive = this.shouldRender();
    this.isIntersecting = intersecting;
    const nowActive = this.shouldRender();
    this.handleActiveStateTransition(wasActive, nowActive);
  }

  private setVisibility(visible: boolean): void {
    const wasActive = this.shouldRender();
    this.isVisible = visible;
    const nowActive = this.shouldRender();
    this.handleActiveStateTransition(wasActive, nowActive);
  }

  private shouldRender(): boolean {
    return this.isRunning && this.isVisible && this.isIntersecting;
  }

  private isResuming = false;

  private handleActiveStateTransition(wasActive: boolean, nowActive: boolean): void {
    if (wasActive && !nowActive) {
      // Pausing
      if (this.rafHandle !== null) {
        (globalThis as any).cancelAnimationFrame(this.rafHandle);
        this.rafHandle = null;
      }
    } else if (!wasActive && nowActive) {
      // Resuming
      this.isResuming = true;
      this.scheduleFrame();
    }
  }

  private scheduleFrame(): void {
    if (!this.shouldRender()) return;
    this.rafHandle = (globalThis as any).requestAnimationFrame((timestamp: number) => {
      this.rafHandle = null;
      if (!this.shouldRender()) return;

      if (this.lastTimestamp === 0 || this.isResuming) {
        this.lastTimestamp = timestamp;
        this.isResuming = false;
      }
      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
      this.totalElapsedTime += delta;

      this.frameCount++;
      this.onRender(this.totalElapsedTime / 1000.0);

      this.scheduleFrame();
    });
  }

  public isRenderLoopActive(): boolean {
    return this.rafHandle !== null;
  }
}

describe('Tier 1: Viewport Power Saving Lifecycle', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('runs render loop continuously when canvas is visible and intersecting', () => {
    const canvas = new MockCanvasElement();
    let renderedTime = 0;
    const controller = new PowerSavingController(canvas, (t) => { renderedTime = t; });

    controller.start();
    expect(controller.isRenderLoopActive()).toBe(true);

    mockEnv.advanceFrames(5, 16.66);
    expect(controller.frameCount).toBe(5);
    expect(renderedTime).toBeGreaterThan(0);

    controller.stop();
  });

  it('pauses render loop when canvas scrolls out of viewport via IntersectionObserver', () => {
    const canvas = new MockCanvasElement();
    const controller = new PowerSavingController(canvas, () => {});
    controller.start();

    mockEnv.advanceFrames(3);
    expect(controller.frameCount).toBe(3);

    // Scroll canvas out of viewport
    const observer = MockIntersectionObserver.instances[0];
    observer.trigger(false);

    expect(controller.isRenderLoopActive()).toBe(false);

    // Advancing frames while out of view should NOT trigger renders
    mockEnv.advanceFrames(5);
    expect(controller.frameCount).toBe(3);

    controller.stop();
  });

  it('resumes render loop immediately when canvas scrolls back into viewport', () => {
    const canvas = new MockCanvasElement();
    const controller = new PowerSavingController(canvas, () => {});
    controller.start();

    const observer = MockIntersectionObserver.instances[0];
    observer.trigger(false);
    expect(controller.isRenderLoopActive()).toBe(false);

    // Re-enters view
    observer.trigger(true);
    expect(controller.isRenderLoopActive()).toBe(true);

    mockEnv.advanceFrames(4);
    expect(controller.frameCount).toBe(4);

    controller.stop();
  });

  it('pauses render loop immediately when document visibilityState becomes hidden', () => {
    const canvas = new MockCanvasElement();
    const controller = new PowerSavingController(canvas, () => {});
    controller.start();

    mockEnv.advanceFrames(2);
    expect(controller.frameCount).toBe(2);

    // Tab hidden
    mockEnv.document.triggerVisibility('hidden');
    expect(controller.isRenderLoopActive()).toBe(false);

    mockEnv.advanceFrames(10);
    expect(controller.frameCount).toBe(2);

    // Tab visible again
    mockEnv.document.triggerVisibility('visible');
    expect(controller.isRenderLoopActive()).toBe(true);

    mockEnv.advanceFrames(3);
    expect(controller.frameCount).toBe(5);

    controller.stop();
  });

  it('preserves clock continuity and prevents sudden time jumps on resume', () => {
    const canvas = new MockCanvasElement();
    const times: number[] = [];
    const controller = new PowerSavingController(canvas, (t) => { times.push(t); });
    controller.start();

    mockEnv.advanceFrames(2, 16);
    const beforePause = times[times.length - 1];

    // Hide tab for a simulated 5000ms pause
    mockEnv.document.triggerVisibility('hidden');
    mockEnv.advanceFrames(10, 500); // 5000ms elapsed in world time
    mockEnv.document.triggerVisibility('visible');

    // Next frame render
    mockEnv.advanceFrames(1, 16);
    const afterResume = times[times.length - 1];

    // The animation time delta after resume should be standard delta (~16ms), NOT jumping by 5000ms
    const stepDelta = afterResume - beforePause;
    expect(stepDelta).toBeLessThan(0.1); // < 100ms delta

    controller.stop();
  });
});
