/**
 * High-fidelity Headless DOM, Canvas, Observer, and Worker Mocks.
 * Provides complete browser environment simulation for Node.js E2E tests.
 */

import { MockWebGL2RenderingContext } from './mock-webgl2.ts';
import { MockGPUCanvasContext, MockGPUProvider } from './mock-webgpu.ts';
import { MockCanvasRenderingContext2D } from './mock-canvas2d.ts';

export class MockOffscreenCanvas {
  width: number;
  height: number;
  private glContext: MockWebGL2RenderingContext | null = null;
  private gpuContext: MockGPUCanvasContext | null = null;
  private c2dContext: MockCanvasRenderingContext2D | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string, options?: any): any {
    if (type === 'webgl2') {
      if (!this.glContext) this.glContext = new MockWebGL2RenderingContext(this);
      return this.glContext;
    }
    if (type === 'webgpu') {
      if (!this.gpuContext) this.gpuContext = new MockGPUCanvasContext(this);
      return this.gpuContext;
    }
    if (type === '2d') {
      if (!this.c2dContext) this.c2dContext = new MockCanvasRenderingContext2D(this);
      return this.c2dContext;
    }
    return null;
  }
}

export class MockCanvasElement {
  width = 800;
  height = 600;
  clientWidth = 800;
  clientHeight = 600;
  offsetWidth = 800;
  offsetHeight = 600;
  style: Record<string, string> = {};

  transferredToOffscreen = false;
  offscreenInstance: MockOffscreenCanvas | null = null;

  private listeners: Map<string, Set<(e: any) => void>> = new Map();
  private glContext: MockWebGL2RenderingContext | null = null;
  private gpuContext: MockGPUCanvasContext | null = null;
  private c2dContext: MockCanvasRenderingContext2D | null = null;

  allowWebGL2 = true;
  allowWebGPU = true;

  transferControlToOffscreen(): MockOffscreenCanvas {
    if (this.transferredToOffscreen) {
      throw new Error('InvalidStateError: Cannot transfer control from a canvas that already has a rendering context');
    }
    this.transferredToOffscreen = true;
    this.offscreenInstance = new MockOffscreenCanvas(this.width, this.height);
    return this.offscreenInstance;
  }

  getContext(type: string, options?: any): any {
    if (this.transferredToOffscreen) {
      throw new Error('InvalidStateError: Canvas has already transferred its control to an OffscreenCanvas');
    }
    if (type === 'webgl2') {
      if (!this.allowWebGL2) return null;
      if (!this.glContext) this.glContext = new MockWebGL2RenderingContext(this);
      return this.glContext;
    }
    if (type === 'webgpu') {
      if (!this.allowWebGPU) return null;
      if (!this.gpuContext) this.gpuContext = new MockGPUCanvasContext(this);
      return this.gpuContext;
    }
    if (type === '2d') {
      if (!this.c2dContext) this.c2dContext = new MockCanvasRenderingContext2D(this);
      return this.c2dContext;
    }
    return null;
  }

  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number; x: number; y: number } {
    return {
      left: 0,
      top: 0,
      right: this.clientWidth,
      bottom: this.clientHeight,
      width: this.clientWidth,
      height: this.clientHeight,
      x: 0,
      y: 0
    };
  }

  addEventListener(type: string, listener: (e: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string; [key: string]: any }): boolean {
    const list = this.listeners.get(event.type);
    if (list) {
      for (const listener of list) {
        listener(event);
      }
    }
    return true;
  }
}

export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: (entries: any[], observer: any) => void;
  options: any;
  observedElements: Set<any> = new Set();

  constructor(callback: (entries: any[], observer: any) => void, options?: any) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: any): void {
    this.observedElements.add(target);
  }

  unobserve(target: any): void {
    this.observedElements.delete(target);
  }

  disconnect(): void {
    this.observedElements.clear();
  }

  trigger(isIntersecting: boolean, intersectionRatio = isIntersecting ? 1.0 : 0.0): void {
    const entries = Array.from(this.observedElements).map((el) => ({
      target: el,
      isIntersecting,
      intersectionRatio,
      boundingClientRect: el.getBoundingClientRect ? el.getBoundingClientRect() : {}
    }));
    this.callback(entries, this);
  }
}

export class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: (entries: any[], observer: any) => void;
  observedElements: Set<any> = new Set();

  constructor(callback: (entries: any[], observer: any) => void) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(target: any): void {
    this.observedElements.add(target);
  }

  unobserve(target: any): void {
    this.observedElements.delete(target);
  }

  disconnect(): void {
    this.observedElements.clear();
  }

  trigger(width: number, height: number): void {
    const entries = Array.from(this.observedElements).map((el) => {
      if (el) {
        el.clientWidth = width;
        el.clientHeight = height;
      }
      return {
        target: el,
        contentRect: { width, height }
      };
    });
    this.callback(entries, this);
  }
}

export class MockWorker {
  static instances: MockWorker[] = [];
  scriptUrl: string | URL;
  onmessage: ((e: { data: any }) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  postedMessages: any[] = [];
  terminated = false;

  constructor(scriptUrl: string | URL) {
    this.scriptUrl = scriptUrl;
    MockWorker.instances.push(this);
  }

  postMessage(message: any, transfer?: any[]): void {
    this.postedMessages.push({ message, transfer });
    // Simulate worker responding to protocol messages
    if (message && message.type === 'INIT') {
      setTimeout(() => {
        if (!this.terminated && this.onmessage) {
          this.onmessage({ data: { type: 'INIT_ACK', success: true } });
        }
      }, 0);
    } else if (message && message.type === 'FRAME_RENDERED') {
      setTimeout(() => {
        if (!this.terminated && this.onmessage) {
          this.onmessage({ data: { type: 'FRAME_ACK', frameId: message.frameId } });
        }
      }, 0);
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

export class MockDocument {
  visibilityState: 'visible' | 'hidden' = 'visible';
  hidden = false;
  body: any = { appendChild: () => {}, removeChild: () => {} };
  private listeners: Map<string, Set<(e: any) => void>> = new Map();

  addEventListener(type: string, listener: (e: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string; [key: string]: any }): boolean {
    const list = this.listeners.get(event.type);
    if (list) {
      for (const listener of list) {
        listener(event);
      }
    }
    return true;
  }

  createElement(tagName: string): any {
    if (tagName.toLowerCase() === 'canvas') {
      return new MockCanvasElement();
    }
    return {
      tagName: tagName.toUpperCase(),
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {}
    };
  }

  triggerVisibility(state: 'visible' | 'hidden'): void {
    this.visibilityState = state;
    this.hidden = state === 'hidden';
    this.dispatchEvent({ type: 'visibilitychange' });
  }
}

export interface MockEnvironment {
  document: MockDocument;
  gpuProvider: MockGPUProvider;
  canvas: MockCanvasElement;
  rafQueue: Map<number, (timestamp: number) => void>;
  rafId: number;
  time: number;
  requestAnimationFrame: (cb: (timestamp: number) => void) => number;
  cancelAnimationFrame: (id: number) => void;
  advanceFrames: (count: number, deltaMs?: number) => void;
  cleanup: () => void;
}

export function setupMockEnvironment(): MockEnvironment {
  const document = new MockDocument();
  const gpuProvider = new MockGPUProvider();
  const canvas = new MockCanvasElement();
  const rafQueue = new Map<number, (timestamp: number) => void>();
  let rafId = 0;
  let time = 1000;

  const requestAnimationFrame = (cb: (timestamp: number) => void): number => {
    rafId++;
    rafQueue.set(rafId, cb);
    return rafId;
  };

  const cancelAnimationFrame = (id: number): void => {
    rafQueue.delete(id);
  };

  const advanceFrames = (count: number, deltaMs = 16.666): void => {
    for (let i = 0; i < count; i++) {
      time += deltaMs;
      const callbacks = Array.from(rafQueue.entries());
      rafQueue.clear();
      for (const [_, cb] of callbacks) {
        cb(time);
      }
    }
  };

  // Patch globalThis
  const originalDocument = (globalThis as any).document;
  const originalWindow = (globalThis as any).window;
  const originalNavigator = (globalThis as any).navigator;
  const originalOffscreenCanvas = (globalThis as any).OffscreenCanvas;
  const originalIntersectionObserver = (globalThis as any).IntersectionObserver;
  const originalResizeObserver = (globalThis as any).ResizeObserver;
  const originalWorker = (globalThis as any).Worker;
  const originalRAF = (globalThis as any).requestAnimationFrame;
  const originalCAF = (globalThis as any).cancelAnimationFrame;

  (globalThis as any).document = document;
  (globalThis as any).window = globalThis;
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: gpuProvider,
        userAgent: 'ShaderBit-E2E-Mock'
      },
      configurable: true,
      writable: true
    });
  } catch {
    (globalThis as any).navigator = {
      gpu: gpuProvider,
      userAgent: 'ShaderBit-E2E-Mock'
    };
  }
  (globalThis as any).OffscreenCanvas = MockOffscreenCanvas;
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
  (globalThis as any).ResizeObserver = MockResizeObserver;
  (globalThis as any).Worker = MockWorker;
  (globalThis as any).requestAnimationFrame = requestAnimationFrame;
  (globalThis as any).cancelAnimationFrame = cancelAnimationFrame;
  (globalThis as any).devicePixelRatio = 2;

  const cleanup = () => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
    try {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', {
          value: originalNavigator,
          configurable: true,
          writable: true
        });
      }
    } catch {}
    (globalThis as any).OffscreenCanvas = originalOffscreenCanvas;
    (globalThis as any).IntersectionObserver = originalIntersectionObserver;
    (globalThis as any).ResizeObserver = originalResizeObserver;
    (globalThis as any).Worker = originalWorker;
    (globalThis as any).requestAnimationFrame = originalRAF;
    (globalThis as any).cancelAnimationFrame = originalCAF;
    MockIntersectionObserver.instances.length = 0;
    MockResizeObserver.instances.length = 0;
    MockWorker.instances.length = 0;
  };

  return {
    document,
    gpuProvider,
    canvas,
    rafQueue,
    get rafId() { return rafId; },
    get time() { return time; },
    requestAnimationFrame,
    cancelAnimationFrame,
    advanceFrames,
    cleanup
  };
}
