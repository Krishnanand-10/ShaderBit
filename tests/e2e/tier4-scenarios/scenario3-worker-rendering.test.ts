/**
 * Tier 4 Scenario 3: OffscreenCanvas Worker Thread Rendering
 * Simulates complete multi-threaded background rendering workload:
 * 1. Detaches canvas to Web Worker via OffscreenCanvas
 * 2. Synchronizes resize, pointer events, and uniform buffers across threads
 * 3. Worker executes background frame renders while main UI thread remains responsive
 * 4. Clean worker termination on unmount.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { OffscreenCanvasWorkerBridge } from '../tier1-features/core-worker.test.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';

describe('Tier 4 Scenario 3: OffscreenCanvas Worker Thread Rendering', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('orchestrates complete worker-thread offloaded rendering session', async () => {
    const canvas = new MockCanvasElement();
    canvas.width = 1280;
    canvas.height = 720;

    const bridge = new OffscreenCanvasWorkerBridge({ canvas });
    const ok = await bridge.init({
      glsl: STARTER_SHADERS['mesh-gradient'].glsl,
      uniforms: { u_speed: 1.0 }
    });
    expect(ok).toBe(true);

    const worker = bridge.getWorker()!;
    expect(worker).toBeDefined();

    // 1. Resize event occurs
    bridge.resize(1920, 1080, 2);
    const lastResize = worker.postedMessages.find((m) => m.message.type === 'RESIZE');
    expect(lastResize.message.width).toBe(1920);

    // 2. Continuous pointer movement
    for (let i = 0; i < 5; i++) {
      bridge.updatePointer(0.1 * i, 0.2 * i);
    }
    const pointerMsgs = worker.postedMessages.filter((m) => m.message.type === 'POINTER_MOVE');
    expect(pointerMsgs.length).toBe(5);

    // 3. Dynamic uniform updates
    bridge.updateUniform('u_speed', 2.5);
    const uniformMsg = worker.postedMessages.find((m) => m.message.type === 'UNIFORM_UPDATE');
    expect(uniformMsg.message.value).toBe(2.5);

    // 4. Session teardown
    bridge.destroy();
    expect(worker.terminated).toBe(true);
  });
});
