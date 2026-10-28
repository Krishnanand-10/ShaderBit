import { beforeEach, afterEach, vi } from 'vitest';
import { MockHTMLCanvasElement, MockOffscreenCanvas } from './canvas';
import { MockNavigatorGPU } from './webgpu';
import { MockIntersectionObserver, MockResizeObserver } from './observers';
import { setupMockPageVisibility } from './visibility';
import { MockWorker } from './worker';

let pageVisibility: ReturnType<typeof setupMockPageVisibility>;

export function setupShaderBitGlobals() {
  // 1. Canvas & OffscreenCanvas
  if (typeof window !== 'undefined') {
    (window as any).HTMLCanvasElement = MockHTMLCanvasElement;
    (window as any).OffscreenCanvas = MockOffscreenCanvas;
  }
  (globalThis as any).HTMLCanvasElement ??= MockHTMLCanvasElement;
  (globalThis as any).OffscreenCanvas = MockOffscreenCanvas;

  // 2. WebGPU Navigator
  const mockGpu = new MockNavigatorGPU();
  if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      writable: true,
      value: mockGpu,
    });
  } else {
    (globalThis as any).navigator = { gpu: mockGpu };
  }

  // 3. Observers
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
  (globalThis as any).ResizeObserver = MockResizeObserver;

  // 4. Page Visibility
  pageVisibility = setupMockPageVisibility();

  // 5. Worker
  (globalThis as any).Worker = MockWorker;

  // 6. requestAnimationFrame / cancelAnimationFrame
  let rafId = 0;
  const activeCallbacks = new Map<number, FrameRequestCallback>();

  (globalThis as any).requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    const id = ++rafId;
    activeCallbacks.set(id, cb);
    setTimeout(() => {
      if (activeCallbacks.has(id)) {
        activeCallbacks.delete(id);
        cb(performance.now());
      }
    }, 16);
    return id;
  });

  (globalThis as any).cancelAnimationFrame = vi.fn((id: number) => {
    activeCallbacks.delete(id);
  });
}

// Automatic setup and cleanup between tests
beforeEach(() => {
  setupShaderBitGlobals();
  MockIntersectionObserver.reset();
  MockResizeObserver.reset();
  MockWorker.reset();
  pageVisibility?.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});
