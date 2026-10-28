/**
 * Tier 3 Pairwise Test: WebGL2 + OffscreenCanvas Worker + Viewport Power Saving
 * Tests concurrent worker-thread rendering synchronized with IntersectionObserver and Page Visibility power-saving controls.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  MockIntersectionObserver,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { OffscreenCanvasWorkerBridge } from '../tier1-features/core-worker.test.ts';

export class IntegratedWorkerPowerPipeline {
  private bridge: OffscreenCanvasWorkerBridge;
  private canvas: MockCanvasElement;
  private observer: any = null;
  public isVisible = true;
  public isIntersecting = true;

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
    this.bridge = new OffscreenCanvasWorkerBridge({ canvas });
  }

  async init(glsl?: string): Promise<boolean> {
    const ok = await this.bridge.init({ glsl });
    if (!ok) return false;

    // Attach IntersectionObserver
    this.observer = new (globalThis as any).IntersectionObserver((entries: any[]) => {
      for (const entry of entries) {
        if (entry.target === this.canvas) {
          this.isIntersecting = entry.isIntersecting;
          this.updateWorkerRenderingState();
        }
      }
    });
    this.observer.observe(this.canvas);

    // Attach Page Visibility API
    (globalThis as any).document.addEventListener('visibilitychange', () => {
      this.isVisible = (globalThis as any).document.visibilityState === 'visible';
      this.updateWorkerRenderingState();
    });

    return true;
  }

  private updateWorkerRenderingState(): void {
    const active = this.isVisible && this.isIntersecting;
    this.bridge.updateVisibility(active);
  }

  getBridge(): OffscreenCanvasWorkerBridge {
    return this.bridge;
  }

  dispose(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.bridge.destroy();
  }
}

describe('Tier 3: Pairwise - WebGL2 + Worker + Power Saving', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('coordinates OffscreenCanvas worker initialization and sends VISIBILITY:false when scrolled out', async () => {
    const canvas = new MockCanvasElement();
    const pipeline = new IntegratedWorkerPowerPipeline(canvas);
    const ok = await pipeline.init('void main(){}');
    expect(ok).toBe(true);

    const worker = pipeline.getBridge().getWorker()!;

    // Trigger scroll out of viewport
    const observer = MockIntersectionObserver.instances[0];
    observer.trigger(false);

    expect(pipeline.isIntersecting).toBe(false);
    const visMsgs = worker.postedMessages.filter((m) => m.message.type === 'VISIBILITY');
    expect(visMsgs.length).toBeGreaterThan(0);
    expect(visMsgs[visMsgs.length - 1].message.visible).toBe(false);

    // Trigger scroll back into viewport
    observer.trigger(true);
    expect(pipeline.isIntersecting).toBe(true);
    const latestVis = worker.postedMessages.filter((m) => m.message.type === 'VISIBILITY');
    expect(latestVis[latestVis.length - 1].message.visible).toBe(true);

    pipeline.dispose();
  });

  it('suspends worker rendering when tab is hidden and resumes when visible', async () => {
    const canvas = new MockCanvasElement();
    const pipeline = new IntegratedWorkerPowerPipeline(canvas);
    await pipeline.init();

    const worker = pipeline.getBridge().getWorker()!;

    mockEnv.document.triggerVisibility('hidden');
    expect(pipeline.isVisible).toBe(false);

    let visMsgs = worker.postedMessages.filter((m) => m.message.type === 'VISIBILITY');
    expect(visMsgs[visMsgs.length - 1].message.visible).toBe(false);

    mockEnv.document.triggerVisibility('visible');
    expect(pipeline.isVisible).toBe(true);

    visMsgs = worker.postedMessages.filter((m) => m.message.type === 'VISIBILITY');
    expect(visMsgs[visMsgs.length - 1].message.visible).toBe(true);

    pipeline.dispose();
  });

  it('safely handles worker teardown and observer disconnection without errors', async () => {
    const canvas = new MockCanvasElement();
    const pipeline = new IntegratedWorkerPowerPipeline(canvas);
    await pipeline.init();

    expect(() => pipeline.dispose()).not.toThrow();
    expect(pipeline.getBridge().getWorker()).toBeNull();
  });
});
