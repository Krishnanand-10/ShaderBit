import { vi } from 'vitest';

export type IntersectionCallback = (entries: IntersectionObserverEntry[], observer: any) => void;
export type ResizeCallback = (entries: ResizeObserverEntry[], observer: any) => void;

export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionCallback;
  elements = new Set<Element>();

  constructor(callback: IntersectionCallback, options?: any) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = vi.fn((target: Element) => {
    this.elements.add(target);
  });

  unobserve = vi.fn((target: Element) => {
    this.elements.delete(target);
  });

  disconnect = vi.fn(() => {
    this.elements.clear();
  });

  takeRecords = vi.fn(() => []);

  // Test Control
  trigger(entry: Partial<IntersectionObserverEntry> & { target: Element; isIntersecting: boolean }) {
    const fullEntry: IntersectionObserverEntry = {
      boundingClientRect: entry.target.getBoundingClientRect(),
      intersectionRatio: entry.isIntersecting ? 1.0 : 0.0,
      intersectionRect: entry.isIntersecting ? entry.target.getBoundingClientRect() : ({} as any),
      rootBounds: null,
      time: performance.now(),
      ...entry
    };
    this.callback([fullEntry], this);
  }

  static triggerForElement(target: Element, isIntersecting: boolean) {
    for (const inst of MockIntersectionObserver.instances) {
      if (inst.elements.has(target)) {
        inst.trigger({ target, isIntersecting });
      }
    }
  }

  static reset() {
    MockIntersectionObserver.instances = [];
  }
}

export class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeCallback;
  elements = new Set<Element>();

  constructor(callback: ResizeCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn((target: Element) => {
    this.elements.add(target);
  });

  unobserve = vi.fn((target: Element) => {
    this.elements.delete(target);
  });

  disconnect = vi.fn(() => {
    this.elements.clear();
  });

  trigger(target: Element, width: number, height: number) {
    const entry: ResizeObserverEntry = {
      target,
      contentRect: { x: 0, y: 0, width, height, top: 0, left: 0, bottom: height, right: width, toJSON: () => ({}) } as any,
      borderBoxSize: [{ inlineSize: width, blockSize: height } as any],
      contentBoxSize: [{ inlineSize: width, blockSize: height } as any],
      devicePixelContentBoxSize: [],
    };
    this.callback([entry], this);
  }

  static triggerForElement(target: Element, width: number, height: number) {
    for (const inst of MockResizeObserver.instances) {
      if (inst.elements.has(target)) {
        inst.trigger(target, width, height);
      }
    }
  }

  static reset() {
    MockResizeObserver.instances = [];
  }
}
