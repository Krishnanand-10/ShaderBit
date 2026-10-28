/**
 * Tier 1 Feature Test: OffscreenCanvas Worker Bridge
 * Tests thread offloading, canvas transfer, 7-message sync protocol, and worker lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  MockWorker,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';

export interface WorkerBridgeOptions {
  canvas: MockCanvasElement;
  workerUrl?: string;
}

export class OffscreenCanvasWorkerBridge {
  private options: WorkerBridgeOptions;
  private worker: MockWorker | null = null;
  private offscreen: any = null;
  private isInitialized = false;

  constructor(options: WorkerBridgeOptions) {
    this.options = options;
  }

  async init(shaderData: { glsl?: string; wgsl?: string; uniforms?: any }): Promise<boolean> {
    if (typeof (globalThis as any).OffscreenCanvas === 'undefined') {
      return false;
    }

    try {
      this.offscreen = this.options.canvas.transferControlToOffscreen();
    } catch {
      return false;
    }

    this.worker = new MockWorker(this.options.workerUrl || 'worker.js');

    return new Promise((resolve) => {
      this.worker!.onmessage = (event) => {
        if (event.data?.type === 'INIT_ACK') {
          this.isInitialized = true;
          resolve(true);
        }
      };

      this.worker!.postMessage(
        {
          type: 'INIT',
          canvas: this.offscreen,
          width: this.options.canvas.width,
          height: this.options.canvas.height,
          dpr: (globalThis as any).devicePixelRatio || 1,
          glsl: shaderData.glsl,
          wgsl: shaderData.wgsl,
          uniforms: shaderData.uniforms
        },
        [this.offscreen]
      );
    });
  }

  resize(width: number, height: number, dpr: number): void {
    if (!this.worker || !this.isInitialized) return;
    this.worker.postMessage({ type: 'RESIZE', width, height, dpr });
  }

  updateUniform(name: string, value: any): void {
    if (!this.worker || !this.isInitialized) return;
    this.worker.postMessage({ type: 'UNIFORM_UPDATE', name, value });
  }

  updatePointer(x: number, y: number): void {
    if (!this.worker || !this.isInitialized) return;
    this.worker.postMessage({ type: 'POINTER_MOVE', x, y });
  }

  updateVisibility(visible: boolean): void {
    if (!this.worker || !this.isInitialized) return;
    this.worker.postMessage({ type: 'VISIBILITY', visible });
  }

  destroy(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'DESTROY' });
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  getWorker(): MockWorker | null {
    return this.worker;
  }
}

describe('Tier 1: OffscreenCanvas Worker Bridge', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('transfers canvas control to OffscreenCanvas and dispatches INIT message', async () => {
    const canvas = new MockCanvasElement();
    const bridge = new OffscreenCanvasWorkerBridge({ canvas });

    const ok = await bridge.init({ glsl: 'void main(){}' });
    expect(ok).toBe(true);
    expect(canvas.transferredToOffscreen).toBe(true);

    const worker = bridge.getWorker()!;
    expect(worker.postedMessages.length).toBeGreaterThanOrEqual(1);
    expect(worker.postedMessages[0].message.type).toBe('INIT');
    expect(worker.postedMessages[0].message.width).toBe(canvas.width);
    expect(worker.postedMessages[0].message.height).toBe(canvas.height);

    bridge.destroy();
  });

  it('synchronizes RESIZE messages to worker with updated dimensions and DPR', async () => {
    const canvas = new MockCanvasElement();
    const bridge = new OffscreenCanvasWorkerBridge({ canvas });
    await bridge.init({});

    bridge.resize(1920, 1080, 2);
    const worker = bridge.getWorker()!;
    const resizeMsg = worker.postedMessages.find((m) => m.message.type === 'RESIZE');
    expect(resizeMsg).toBeDefined();
    expect(resizeMsg.message.width).toBe(1920);
    expect(resizeMsg.message.height).toBe(1080);
    expect(resizeMsg.message.dpr).toBe(2);

    bridge.destroy();
  });

  it('synchronizes dynamic UNIFORM_UPDATE messages across thread boundary', async () => {
    const canvas = new MockCanvasElement();
    const bridge = new OffscreenCanvasWorkerBridge({ canvas });
    await bridge.init({});

    bridge.updateUniform('u_speed', 3.0);
    bridge.updateUniform('u_baseColor', [0.1, 0.2, 0.3]);

    const worker = bridge.getWorker()!;
    const uniformMsgs = worker.postedMessages.filter((m) => m.message.type === 'UNIFORM_UPDATE');
    expect(uniformMsgs.length).toBe(2);
    expect(uniformMsgs[0].message.name).toBe('u_speed');
    expect(uniformMsgs[0].message.value).toBe(3.0);
    expect(uniformMsgs[1].message.name).toBe('u_baseColor');

    bridge.destroy();
  });

  it('synchronizes POINTER_MOVE coordinates across thread boundary', async () => {
    const canvas = new MockCanvasElement();
    const bridge = new OffscreenCanvasWorkerBridge({ canvas });
    await bridge.init({});

    bridge.updatePointer(0.45, 0.75);

    const worker = bridge.getWorker()!;
    const ptrMsg = worker.postedMessages.find((m) => m.message.type === 'POINTER_MOVE');
    expect(ptrMsg).toBeDefined();
    expect(ptrMsg.message.x).toBe(0.45);
    expect(ptrMsg.message.y).toBe(0.75);

    bridge.destroy();
  });

  it('sends DESTROY message and terminates worker cleanly on teardown', async () => {
    const canvas = new MockCanvasElement();
    const bridge = new OffscreenCanvasWorkerBridge({ canvas });
    await bridge.init({});

    const worker = bridge.getWorker()!;
    bridge.destroy();

    expect(worker.postedMessages.some((m) => m.message.type === 'DESTROY')).toBe(true);
    expect(worker.terminated).toBe(true);
    expect(bridge.getWorker()).toBeNull();
  });
});
