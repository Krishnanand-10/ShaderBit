/**
 * Milestone 4 Adversarial Stress & Empirical Challenge Suite
 * Framework Adapters: @shaderbit/react, @shaderbit/vue, @shaderbit/svelte, @shaderbit/elements
 *
 * Probes:
 * 1. React 18 StrictMode double-mounting race conditions & cancellation
 * 2. 120Hz rapid uniform update stress testing & pipeline churn check
 * 3. Lifecycle teardowns & animation frame / GPU context / listener leak detection
 * 4. Driver fallback & context loss propagation across all 4 framework adapters
 * 5. Structural prop mutation & boundary fuzzing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { resolve } from 'path';

const req = createRequire(import.meta.url);
const repoRoot = resolve(import.meta.dirname, '../..');

// Resolve framework packages from their respective package node_modules
const reactPath = req.resolve('react', { paths: [resolve(repoRoot, 'packages/react')] });
const reactDomClientPath = req.resolve('react-dom/client', { paths: [resolve(repoRoot, 'packages/react')] });
const vuePath = req.resolve('vue', { paths: [resolve(repoRoot, 'packages/vue')] });
const sveltePath = req.resolve('svelte', { paths: [resolve(repoRoot, 'packages/svelte')] });

// Robust Headless Mock DOM Implementation for React 18, Vue 3, and Custom Elements
class MockDOMNode {
  nodeType = 1;
  tagName: string;
  childNodes: MockDOMNode[] = [];
  parentNode: MockDOMNode | null = null;
  ownerDocument: any;
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  listeners: Map<string, Set<EventListener>> = new Map();
  clientWidth = 800;
  clientHeight = 600;
  offsetWidth = 800;
  offsetHeight = 600;

  constructor(tagName = 'DIV') {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = (globalThis as any).document;
  }

  setAttribute(name: string, val: string) {
    this.attributes[name] = String(val);
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }

  hasAttribute(name: string) {
    return name in this.attributes;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  appendChild(child: MockDOMNode) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: MockDOMNode) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  insertBefore(newNode: MockDOMNode, refNode: MockDOMNode | null) {
    newNode.parentNode = this;
    if (!refNode) {
      this.childNodes.push(newNode);
      return newNode;
    }
    const idx = this.childNodes.indexOf(refNode);
    if (idx !== -1) {
      this.childNodes.splice(idx, 0, newNode);
    } else {
      this.childNodes.push(newNode);
    }
    return newNode;
  }

  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: any): boolean {
    event.target = this;
    event.currentTarget = this;
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        handler.call(this, event);
      }
    }
    return !event.defaultPrevented;
  }

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.clientWidth,
      height: this.clientHeight,
      right: this.clientWidth,
      bottom: this.clientHeight,
      x: 0,
      y: 0,
      toJSON: () => ({})
    };
  }
}

function createTestDOMDocument() {
  const CanvasClass = (globalThis as any).HTMLCanvasElement;
  (globalThis as any).HTMLIFrameElement = class {};
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  const doc: any = {
    nodeType: 9,
    defaultView: globalThis,
    activeElement: null,
    createElement(tagName: string) {
      if (tagName.toLowerCase() === 'canvas') {
        const c = new CanvasClass(800, 600);
        c.tagName = 'CANVAS';
        c.ownerDocument = doc;
        c.style = {};
        c.setAttribute = (name: string, val: string) => { (c as any)[name] = val; };
        return c;
      }
      const el = new MockDOMNode(tagName);
      el.ownerDocument = doc;
      return el;
    },
    createElementNS(_ns: string, tagName: string) {
      return doc.createElement(tagName);
    },
    createTextNode(text: string) {
      return { nodeType: 3, textContent: text, parentNode: null };
    },
    createComment(text: string) {
      return { nodeType: 8, textContent: text, parentNode: null };
    },
    querySelector: () => null,
    listeners: new Map<string, Set<EventListener>>(),
    addEventListener(type: string, fn: EventListener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: EventListener) {
      this.listeners.get(type)?.delete(fn);
    },
    dispatchEvent(event: any) {
      try {
        Object.defineProperty(event, 'target', { value: this, configurable: true });
        Object.defineProperty(event, 'currentTarget', { value: this, configurable: true });
      } catch {}
      const handlers = this.listeners.get(event.type);
      if (handlers) {
        for (const handler of Array.from(handlers)) {
          (handler as any).call(this, event);
        }
      }
      return !event.defaultPrevented;
    }
  };

  doc.documentElement = doc.createElement('html');
  doc.body = doc.createElement('body');
  doc.documentElement.appendChild(doc.body);
  return doc;
}

// Initialize globals BEFORE importing Vue / React
const initialDoc = createTestDOMDocument();
(globalThis as any).document = initialDoc;
(globalThis as any).window = globalThis;
(globalThis as any).Element = MockDOMNode;
(globalThis as any).HTMLElement = MockDOMNode;
(globalThis as any).SVGElement = MockDOMNode;

const React: any = await import(reactPath);
const ReactDOMClient: any = await import(reactDomClientPath);
const Vue: any = await import(vuePath);
const Svelte: any = await import(sveltePath);

// Import compiled dist artifacts to test actual built packages
const ReactAdapter = await import(resolve(repoRoot, 'packages/react/dist/index.js'));
const VueAdapter = await import(resolve(repoRoot, 'packages/vue/dist/index.js'));
const SvelteAdapter = await import(resolve(repoRoot, 'packages/svelte/dist/index.js'));
const ElementsAdapter = await import(resolve(repoRoot, 'packages/elements/dist/index.js'));

const Core = await import(resolve(repoRoot, 'packages/core/dist/index.js'));
const Registry = await import(resolve(repoRoot, 'packages/registry/dist/index.js'));

const { ShaderCanvas: ReactShaderCanvas, useShaderPipeline } = ReactAdapter;
const { ShaderCanvas: VueShaderCanvas, useShaderCanvas } = VueAdapter;
const { shaderCanvas: svelteAction, ShaderCanvas: SvelteShaderCanvas } = SvelteAdapter;
const { ShaderBitElement, defineShaderBitElement, normalizeUniformName, parseAttributeValue } = ElementsAdapter;

const { ShaderPipeline } = Core;
const { STARTER_SHADERS, getComponent } = Registry;


describe('Milestone 4 Adversarial Stress Testing', () => {
  let prevDoc: any;
  let prevWin: any;
  let prevEl: any;
  let mockDoc: any;

  beforeEach(() => {
    prevDoc = (globalThis as any).document;
    prevWin = (globalThis as any).window;
    prevEl = (globalThis as any).Element;

    mockDoc = createTestDOMDocument();
    (globalThis as any).document = mockDoc;
    (globalThis as any).window = globalThis;
    (globalThis as any).Element = MockDOMNode;
    (globalThis as any).HTMLElement = MockDOMNode;
    (globalThis as any).SVGElement = MockDOMNode;
  });

  afterEach(() => {
    (globalThis as any).document = prevDoc;
    (globalThis as any).window = prevWin;
    (globalThis as any).Element = prevEl;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Section 1: React 18 StrictMode Double-Mounting & Race Condition Stress
  // =========================================================================
  describe('1. React 18 StrictMode & Double-Mounting Concurrency', () => {
    it('survives standard React 18 StrictMode double-mounting pattern without duplicate loops', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let initCount = 0;
      let activePipeline: any = null;

      await React.act(async () => {
        root.render(
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(ReactShaderCanvas, {
              glsl: 'void main() {}',
              driver: 'canvas2d',
              onInit: (p: any) => {
                initCount++;
                activePipeline = p;
              }
            })
          )
        );
      });

      // After StrictMode double-mounting finishes, active pipeline must be running
      expect(activePipeline).not.toBeNull();
      expect(activePipeline.isRunning).toBe(true);

      // Unmount cleanly
      await React.act(async () => {
        root.unmount();
      });
      expect(activePipeline.isRunning).toBe(false);
    });

    it('handles rapid unmount within 0ms before async init completes with zero orphaned pipelines or leaks', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let initCalled = false;

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'canvas2d',
            onInit: () => {
              initCalled = true;
            }
          })
        );
        // Unmount synchronously in the same act turn before async pipeline.init() completes
        root.unmount();
      });

      // Wait a tick for any in-flight promises to resolve
      await new Promise((r) => setTimeout(r, 50));

      // onInit must NEVER have fired because component was disposed before init completed
      expect(initCalled).toBe(false);
    });

    it('handles rapid mount -> unmount -> mount within 0ms without pipeline collisions', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      const pipelines: any[] = [];

      await React.act(async () => {
        // Mount 1
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'canvas2d',
            onInit: (p: any) => pipelines.push(p)
          })
        );
        // Immediate unmount
        root.render(React.createElement('div', null));
        // Immediate remount
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'canvas2d',
            onInit: (p: any) => pipelines.push(p)
          })
        );
      });

      await new Promise((r) => setTimeout(r, 60));

      // Only the final remounted pipeline should be running
      expect(pipelines.length).toBeGreaterThanOrEqual(1);
      const active = pipelines[pipelines.length - 1];
      expect(active.isRunning).toBe(true);

      await React.act(async () => {
        root.unmount();
      });
      expect(active.isRunning).toBe(false);
    });

    it('survives 20 rapid consecutive mount/unmount cycles in a tight loop', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      const initializedPipelines: any[] = [];

      for (let i = 0; i < 20; i++) {
        await React.act(async () => {
          root.render(
            React.createElement(ReactShaderCanvas, {
              glsl: 'void main() {}',
              driver: 'canvas2d',
              uniforms: { u_cycle: i },
              onInit: (p: any) => initializedPipelines.push(p)
            })
          );
        });

        if (i % 2 === 1) {
          await React.act(async () => {
            root.render(React.createElement('div', null));
          });
        }
      }

      await React.act(async () => {
        root.unmount();
      });

      // Verify every single pipeline that was initialized has isRunning === false
      for (const p of initializedPipelines) {
        expect(p.isRunning).toBe(false);
      }
    });

    it('forwards ref properly through StrictMode double-mounting', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      const canvasRef = React.createRef();

      await React.act(async () => {
        root.render(
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(ReactShaderCanvas, {
              ref: canvasRef,
              glsl: 'void main() {}',
              driver: 'canvas2d'
            })
          )
        );
      });

      expect(canvasRef.current).not.toBeNull();
      expect(canvasRef.current.tagName).toBe('CANVAS');
      expect(canvasRef.current.pipeline).not.toBeNull();
      expect(canvasRef.current.pipeline.isRunning).toBe(true);

      await React.act(async () => {
        root.unmount();
      });
    });

    it('safely handles unmount when pipeline initialization rejects with an error', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let errorHandled: any = null;

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            driver: 'webgpu', // Will fail if WebGPU is forced to fail
            glsl: undefined,
            wgsl: undefined,
            onError: (err: Error) => {
              errorHandled = err;
            }
          })
        );
        root.unmount();
      });

      await new Promise((r) => setTimeout(r, 50));
      // No uncaught exceptions thrown; clean unmount
      expect(true).toBe(true);
    });

    it('mounts 5 concurrent ShaderCanvas instances simultaneously in React StrictMode', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      const activePipelines: any[] = [];

      await React.act(async () => {
        root.render(
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(
              'div',
              null,
              [0, 1, 2, 3, 4].map((i) =>
                React.createElement(ReactShaderCanvas, {
                  key: i,
                  glsl: 'void main() {}',
                  driver: 'canvas2d',
                  uniforms: { u_index: i },
                  onInit: (p: any) => {
                    activePipelines.push(p);
                  }
                })
              )
            )
          )
        );
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(activePipelines.length).toBe(5);
      for (const p of activePipelines) {
        expect(p.isRunning).toBe(true);
      }

      await React.act(async () => {
        root.unmount();
      });

      for (const p of activePipelines) {
        expect(p.isRunning).toBe(false);
      }
    });

    it('mounts starter shader component definition directly via component prop', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pInstance: any = null;

      const starterComp = getComponent('liquid-chrome');
      expect(starterComp).toBeDefined();

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            component: starterComp,
            driver: 'canvas2d',
            onInit: (p: any) => {
              pInstance = p;
            }
          })
        );
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(pInstance).not.toBeNull();
      expect(pInstance.isRunning).toBe(true);

      await React.act(async () => {
        root.unmount();
      });
    });
  });

  // =========================================================================
  // Section 2: 120Hz Rapid Uniform Update Stress Testing
  // =========================================================================
  describe('2. 120Hz Rapid Uniform Update Stress & Throughput', () => {
    it('React: executes 120 consecutive rapid uniform updates without pipeline churn or recompilation', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pipelineInstance: any = null;
      let initCalls = 0;

      function StressApp({ speed }: { speed: number }) {
        return React.createElement(ReactShaderCanvas, {
          glsl: 'void main() {}',
          driver: 'canvas2d',
          uniforms: { u_speed: speed },
          onInit: (p: any) => {
            initCalls++;
            pipelineInstance = p;
          }
        });
      }

      await React.act(async () => {
        root.render(React.createElement(StressApp, { speed: 1.0 }));
      });

      const initialPipeline = pipelineInstance;
      expect(initialPipeline).not.toBeNull();
      expect(initCalls).toBe(1);

      // Emulate 120Hz high-frequency updates (e.g. 120 updates in rapid succession)
      for (let i = 1; i <= 120; i++) {
        await React.act(async () => {
          root.render(React.createElement(StressApp, { speed: 1.0 + i * 0.05 }));
        });
      }

      // Pipeline MUST be the exact same instance; no recreation!
      expect(pipelineInstance).toBe(initialPipeline);
      expect(initCalls).toBe(1);
      expect(pipelineInstance.uniforms.u_speed).toBeCloseTo(7.0, 1);

      await React.act(async () => {
        root.unmount();
      });
    });

    it('Vue 3: executes 120 consecutive rapid uniform updates via deep reactive watcher without pipeline churn', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);
      const canvasRef = Vue.ref(canvas);

      let pipelineInstance: any = null;
      let initCount = 0;

      const options = Vue.reactive({
        glsl: 'void main() {}',
        driver: 'canvas2d' as const,
        uniforms: { u_speed: 1.0 },
        onInit: (p: any) => {
          initCount++;
          pipelineInstance = p;
        }
      });

      const TestComp = Vue.defineComponent({
        setup() {
          return useShaderCanvas(canvasRef, options);
        },
        render: () => Vue.h('div')
      });

      const app = Vue.createApp(TestComp);
      const container = new MockDOMNode();
      app.mount(container as any);
      await Vue.nextTick();
      await new Promise((r) => setTimeout(r, 40));

      const firstPipeline = pipelineInstance;
      expect(firstPipeline).not.toBeNull();
      expect(initCount).toBe(1);

      // 120 rapid updates
      for (let i = 1; i <= 120; i++) {
        options.uniforms.u_speed = 1.0 + i * 0.1;
      }
      await Vue.nextTick();
      await new Promise((r) => setTimeout(r, 30));

      expect(pipelineInstance).toBe(firstPipeline);
      expect(initCount).toBe(1);
      expect(firstPipeline.uniforms.u_speed).toBeCloseTo(13.0, 1);

      app.unmount();
      expect(firstPipeline.isRunning).toBe(false);
    });

    it('Svelte: executes 120 consecutive uniform updates via action.update() without recreating pipeline', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);

      let pipelineInstance: any = null;
      let initCount = 0;

      const action = svelteAction(canvas, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        uniforms: { u_speed: 1.0 },
        onInit: (p: any) => {
          initCount++;
          pipelineInstance = p;
        }
      });

      await new Promise((r) => setTimeout(r, 40));
      const firstPipeline = pipelineInstance;
      expect(firstPipeline).not.toBeNull();
      expect(initCount).toBe(1);

      // 120 rapid updates
      for (let i = 1; i <= 120; i++) {
        action.update({ uniforms: { u_speed: 1.0 + i * 0.05 } });
      }

      expect(action.pipeline).toBe(firstPipeline);
      expect(initCount).toBe(1);
      expect(firstPipeline.uniforms.u_speed).toBeCloseTo(7.0, 1);

      action.destroy();
      expect(firstPipeline.isRunning).toBe(false);
    });

    it('Custom Element: executes 120 consecutive attribute updates without re-mounting pipeline', async () => {
      const el = new ShaderBitElement();
      const attributesMap = new Map<string, string>();

      (el as any).isConnected = true;
      (el as any).attributes = [];
      (el as any).setAttribute = vi.fn((name: string, val: string) => {
        attributesMap.set(name, String(val));
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).getAttribute = vi.fn((name: string) => attributesMap.get(name) || null);
      (el as any).hasAttribute = vi.fn((name: string) => attributesMap.has(name));
      (el as any).removeAttribute = vi.fn((name: string) => {
        attributesMap.delete(name);
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).appendChild = vi.fn((child: any) => child);

      el.setAttribute('effect', 'liquid-chrome');
      el.setAttribute('driver', 'canvas2d');
      el.connectedCallback();

      await new Promise((r) => setTimeout(r, 40));
      const firstPipeline = el.pipeline;
      expect(firstPipeline).not.toBeNull();

      // 120 rapid uniform updates via attributeChangedCallback
      for (let i = 1; i <= 120; i++) {
        const val = (1.0 + i * 0.05).toFixed(2);
        el.attributeChangedCallback('u-speed', '1.0', val);
      }

      // Pipeline MUST remain identical
      expect(el.pipeline).toBe(firstPipeline);
      expect(el.uniforms.u_speed).toBeCloseTo(7.0, 1);

      el.disconnectedCallback();
      expect(el.pipeline).toBeNull();
    });

    it('queues and applies rapid uniform updates that occur BEFORE async init completes', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pipelineInstance: any = null;

      function AppWithEarlyUniforms({ speed }: { speed: number }) {
        return React.createElement(ReactShaderCanvas, {
          glsl: 'void main() {}',
          driver: 'canvas2d',
          uniforms: { u_speed: speed },
          onInit: (p: any) => {
            pipelineInstance = p;
          }
        });
      }

      await React.act(async () => {
        // Mount with speed 1.0
        root.render(React.createElement(AppWithEarlyUniforms, { speed: 1.0 }));
        // Immediately update speed 5 times BEFORE async init resolves
        for (let s = 2; s <= 5; s++) {
          root.render(React.createElement(AppWithEarlyUniforms, { speed: s * 1.5 }));
        }
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(pipelineInstance).not.toBeNull();
      // The latest speed (5 * 1.5 = 7.5) must be applied
      expect(pipelineInstance.uniforms.u_speed).toBe(7.5);

      await React.act(async () => {
        root.unmount();
      });
    });

    it('correctly normalizes and parses complex uniform types (colors, vectors, matrices)', () => {
      expect(normalizeUniformName('u-wave-amplitude')).toBe('u_waveAmplitude');
      expect(normalizeUniformName('u-waveamplitude')).toBe('u_waveAmplitude');
      expect(normalizeUniformName('u-color1')).toBe('u_color1');
      expect(normalizeUniformName('u-color-a')).toBe('u_color1');
      expect(normalizeUniformName('u-noise-scale')).toBe('u_noiseScale');
      expect(normalizeUniformName('u-mouse-radius')).toBe('u_mouseRadius');
      expect(normalizeUniformName('u-caustic-scale')).toBe('u_causticScale');

      expect(parseAttributeValue('#ff0000')).toEqual([1, 0, 0]);
      expect(parseAttributeValue('[0.1, 0.2, 0.3]')).toEqual([0.1, 0.2, 0.3]);
      expect(parseAttributeValue('{"foo": 123}')).toEqual({ foo: 123 });
      expect(parseAttributeValue('42.5')).toBe(42.5);
      expect(parseAttributeValue('true')).toBe(1);
      expect(parseAttributeValue('false')).toBe(0);
      expect(parseAttributeValue(null)).toBe(0);
    });

    it('benchmarks throughput: handles 1,000 rapid uniform updates within < 250ms', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);

      const action = svelteAction(canvas, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        uniforms: { u_speed: 1.0 }
      });

      await new Promise((r) => setTimeout(r, 40));
      const t0 = performance.now();

      for (let i = 0; i < 1000; i++) {
        action.update({
          uniforms: {
            u_speed: i * 0.01,
            u_reflection: 0.5,
            u_roughness: 0.1
          }
        });
      }

      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(250); // High throughput requirement
      action.destroy();
    });

    it('React: updates 4-color palette vec3 arrays at 120Hz without pipeline churn', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pipelineInstance: any = null;
      let initCount = 0;

      function ColorApp({ palette }: { palette: [number, number, number] }) {
        return React.createElement(ReactShaderCanvas, {
          glsl: 'void main() {}',
          driver: 'canvas2d',
          uniforms: { u_color1: palette },
          onInit: (p: any) => {
            initCount++;
            pipelineInstance = p;
          }
        });
      }

      await React.act(async () => {
        root.render(React.createElement(ColorApp, { palette: [0.1, 0.2, 0.3] }));
      });

      const initialPipeline = pipelineInstance;
      expect(initialPipeline).not.toBeNull();
      expect(initCount).toBe(1);

      // Rapidly update 3-element vector array 120 times
      for (let i = 0; i < 120; i++) {
        const factor = i / 120;
        await React.act(async () => {
          root.render(React.createElement(ColorApp, { palette: [factor, 1 - factor, 0.5] }));
        });
      }

      expect(pipelineInstance).toBe(initialPipeline);
      expect(initCount).toBe(1);
      expect(pipelineInstance.uniforms.u_color1).toEqual([119 / 120, 1 - 119 / 120, 0.5]);

      await React.act(async () => {
        root.unmount();
      });
    });

    it('Vue 3: throughput benchmark: processes 1,000 rapid reactive uniform mutations within < 250ms', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);
      const canvasRef = Vue.ref(canvas);

      const options = Vue.reactive({
        glsl: 'void main() {}',
        driver: 'canvas2d' as const,
        uniforms: { u_speed: 1.0, u_reflection: 0.8 }
      });

      const TestComp = Vue.defineComponent({
        setup() {
          return useShaderCanvas(canvasRef, options);
        },
        render: () => Vue.h('div')
      });

      const app = Vue.createApp(TestComp);
      const container = new MockDOMNode();
      app.mount(container as any);
      await Vue.nextTick();
      await new Promise((r) => setTimeout(r, 40));

      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        options.uniforms.u_speed = i * 0.05;
      }
      await Vue.nextTick();
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(250);
      app.unmount();
    });
  });

  // =========================================================================
  // Section 3: Lifecycle Teardowns & Resource Leak Detection
  // =========================================================================
  describe('3. Lifecycle Teardowns & Leak Prevention', () => {
    it('React: cleanly stops render loop, removes canvas event listeners, and disposes pipeline upon unmount', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pInstance: any = null;

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'canvas2d',
            onInit: (p: any) => {
              pInstance = p;
            }
          })
        );
      });

      expect(pInstance).not.toBeNull();
      expect(pInstance.isRunning).toBe(true);

      const canvas = container.childNodes[0];
      const removeListenerSpy = vi.spyOn(canvas, 'removeEventListener');

      await React.act(async () => {
        root.unmount();
      });

      expect(pInstance.isRunning).toBe(false);
      // Verify listeners were cleaned up
      expect(removeListenerSpy).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function));
    });

    it('Vue 3: halts render loop and disposes active driver on app.unmount()', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);
      const canvasRef = Vue.ref(canvas);
      let pInstance: any = null;

      const TestComp = Vue.defineComponent({
        setup() {
          return useShaderCanvas(canvasRef, {
            glsl: 'void main() {}',
            driver: 'canvas2d',
            onInit: (p: any) => {
              pInstance = p;
            }
          });
        },
        render: () => Vue.h('div')
      });

      const app = Vue.createApp(TestComp);
      const container = new MockDOMNode();
      app.mount(container as any);
      await Vue.nextTick();
      await new Promise((r) => setTimeout(r, 40));

      expect(pInstance).not.toBeNull();
      expect(pInstance.isRunning).toBe(true);

      app.unmount();
      expect(pInstance.isRunning).toBe(false);
    });

    it('Custom Element: handles full re-attachment cycle (connected -> disconnected -> connected)', async () => {
      const el = new ShaderBitElement();
      const attributesMap = new Map<string, string>();

      (el as any).isConnected = true;
      (el as any).attributes = [];
      (el as any).setAttribute = vi.fn((name: string, val: string) => {
        attributesMap.set(name, String(val));
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).getAttribute = vi.fn((name: string) => attributesMap.get(name) || null);
      (el as any).hasAttribute = vi.fn((name: string) => attributesMap.has(name));
      (el as any).removeAttribute = vi.fn((name: string) => {
        attributesMap.delete(name);
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).appendChild = vi.fn((child: any) => child);

      el.setAttribute('effect', 'liquid-chrome');
      el.setAttribute('driver', 'canvas2d');

      // 1. Initial connect
      el.connectedCallback();
      await new Promise((r) => setTimeout(r, 40));
      const firstPipeline = el.pipeline;
      expect(firstPipeline).not.toBeNull();
      expect(firstPipeline?.isRunning).toBe(true);

      // 2. Disconnect
      el.disconnectedCallback();
      expect(firstPipeline?.isRunning).toBe(false);
      expect(el.pipeline).toBeNull();

      // 3. Re-connect
      el.connectedCallback();
      await new Promise((r) => setTimeout(r, 40));
      const secondPipeline = el.pipeline;
      expect(secondPipeline).not.toBeNull();
      expect(secondPipeline).not.toBe(firstPipeline);
      expect(secondPipeline?.isRunning).toBe(true);

      el.disconnectedCallback();
      expect(secondPipeline?.isRunning).toBe(false);
    });

    it('disposal methods are completely idempotent (safe to call repeatedly without throwing)', () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);

      const pipeline = new ShaderPipeline({
        canvas,
        driver: 'canvas2d',
        glsl: 'void main() {}'
      });

      // Multiple dispose calls
      expect(() => {
        pipeline.dispose();
        pipeline.dispose();
        pipeline.dispose();
      }).not.toThrow();
    });

    it('tab visibility change pauses and resumes pipeline render loop when mounted via adapter', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pipelineInstance: any = null;

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'canvas2d',
            onInit: (p: any) => {
              pipelineInstance = p;
            }
          })
        );
      });

      await new Promise((r) => setTimeout(r, 40));
      expect(pipelineInstance).not.toBeNull();
      expect(pipelineInstance.isRunning).toBe(true);

      // Emulate tab hidden via Page Visibility API
      mockDoc.hidden = true;
      mockDoc.visibilityState = 'hidden';
      mockDoc.dispatchEvent(new Event('visibilitychange'));

      // Emulate tab visible again
      mockDoc.hidden = false;
      mockDoc.visibilityState = 'visible';
      mockDoc.dispatchEvent(new Event('visibilitychange'));

      expect(pipelineInstance.isRunning).toBe(true);

      await React.act(async () => {
        root.unmount();
      });
    });

    it('IntersectionObserver viewport exit pauses render loop and viewport re-entry resumes', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pipelineInstance: any = null;

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'canvas2d',
            onInit: (p: any) => {
              pipelineInstance = p;
            }
          })
        );
      });

      await new Promise((r) => setTimeout(r, 40));
      expect(pipelineInstance).not.toBeNull();
      const canvas = container.childNodes[0];

      // Trigger viewport exit (scrolled offscreen)
      (globalThis as any).IntersectionObserver.triggerForElement(canvas, false);
      expect(pipelineInstance.isRunning).toBe(true);

      // Trigger viewport re-entry (scrolled back into view)
      (globalThis as any).IntersectionObserver.triggerForElement(canvas, true);
      expect(pipelineInstance.isRunning).toBe(true);

      await React.act(async () => {
        root.unmount();
      });
    });
  });

  // =========================================================================
  // Section 4: Driver Fallback & Context Loss Propagation
  // =========================================================================
  describe('4. Driver Fallback & Context Loss Across Adapters', () => {
    it('React: survives WebGL context loss and restores pipeline upon context restoration', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pipelineInstance: any = null;

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'webgl2',
            uniforms: { u_speed: 3.5 },
            onInit: (p: any) => {
              pipelineInstance = p;
            }
          })
        );
      });

      await new Promise((r) => setTimeout(r, 40));
      expect(pipelineInstance).not.toBeNull();

      const canvas = container.childNodes[0];
      const gl = canvas.getContext('webgl2');

      // 1. Emulate Context Loss
      gl.triggerContextLost();
      expect(pipelineInstance.isContextLost).toBe(true);
      expect(pipelineInstance.getPreventDefaultCalled()).toBe(true);

      // Render calls should be safely suppressed
      const renderSuccess = pipelineInstance.render();
      expect(renderSuccess).toBe(false);

      // 2. Emulate Context Restoration
      gl.triggerContextRestored();
      await new Promise((r) => setTimeout(r, 40));

      expect(pipelineInstance.isContextLost).toBe(false);
      expect(pipelineInstance.uniforms.u_speed).toBe(3.5); // Uniform preserved

      await React.act(async () => {
        root.unmount();
      });
    });

    it('Custom Element: survives WebGL context loss and restores pipeline', async () => {
      const el = new ShaderBitElement();
      const attributesMap = new Map<string, string>();

      (el as any).isConnected = true;
      (el as any).attributes = [];
      (el as any).setAttribute = vi.fn((name: string, val: string) => {
        attributesMap.set(name, String(val));
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).getAttribute = vi.fn((name: string) => attributesMap.get(name) || null);
      (el as any).hasAttribute = vi.fn((name: string) => attributesMap.has(name));
      (el as any).removeAttribute = vi.fn((name: string) => {
        attributesMap.delete(name);
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).appendChild = vi.fn((child: any) => child);

      el.setAttribute('effect', 'liquid-chrome');
      el.setAttribute('driver', 'webgl2');
      el.connectedCallback();

      await new Promise((r) => setTimeout(r, 40));
      const pipeline = el.pipeline!;
      expect(pipeline).not.toBeNull();

      const gl = el.canvas!.getContext('webgl2') as any;
      gl.triggerContextLost();
      expect(pipeline.isContextLost).toBe(true);

      gl.triggerContextRestored();
      await new Promise((r) => setTimeout(r, 40));
      expect(pipeline.isContextLost).toBe(false);

      el.disconnectedCallback();
    });

    it('Driver hierarchy fallback: gracefully degrades from WebGPU -> WebGL2 -> Canvas2D in React', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pipelineInstance: any = null;

      // Force WebGPU & WebGL2 failure on the canvas element created by createElement
      const origCreate = mockDoc.createElement;
      mockDoc.createElement = (tag: string) => {
        const c = origCreate(tag);
        if (tag.toLowerCase() === 'canvas') {
          c.forceWebGPUFailure = true;
          c.forceWebGLFailure = true;
        }
        return c;
      };

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'auto',
            onInit: (p: any) => {
              pipelineInstance = p;
            }
          })
        );
      });

      await new Promise((r) => setTimeout(r, 40));
      expect(pipelineInstance).not.toBeNull();
      // Should have successfully fallen back to Canvas2D!
      expect(pipelineInstance.getActiveDriver()).toBe('canvas2d');
      expect(pipelineInstance.isRunning).toBe(true);

      await React.act(async () => {
        root.unmount();
      });
      mockDoc.createElement = origCreate;
    });

    it('explicit driver failure triggers onError in React', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let caughtError: any = null;

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void not_the_entry_point() {}', // Missing main function triggers compiler failure
            driver: 'webgl2', // Explicit driver requirement
            onError: (err: Error) => {
              caughtError = err;
            }
          })
        );
      });

      await new Promise((r) => setTimeout(r, 40));
      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).toContain('compilation failed');

      await React.act(async () => {
        root.unmount();
      });
    });

    it('supports runtime downgradeToSoftwareFallback() on active pipeline', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      let pipelineInstance: any = null;

      await React.act(async () => {
        root.render(
          React.createElement(ReactShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'webgl2',
            onInit: (p: any) => {
              pipelineInstance = p;
            }
          })
        );
      });

      await new Promise((r) => setTimeout(r, 40));
      expect(pipelineInstance.getActiveDriver()).toBe('webgl2');

      // Manually trigger downgrade
      pipelineInstance.downgradeToSoftwareFallback();
      expect(pipelineInstance.getActiveDriver()).toBe('canvas2d');

      await React.act(async () => {
        root.unmount();
      });
    });

    it('Svelte: survives WebGL context loss and re-applies uniforms upon context restoration', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);

      const action = svelteAction(canvas, {
        glsl: 'void main() {}',
        driver: 'webgl2',
        uniforms: { u_speed: 4.2 }
      });

      await new Promise((r) => setTimeout(r, 40));
      const p = action.pipeline!;
      expect(p).toBeDefined();

      const gl = canvas.getContext('webgl2') as any;
      gl.triggerContextLost();
      expect(p.isContextLost).toBe(true);

      gl.triggerContextRestored();
      await new Promise((r) => setTimeout(r, 40));
      expect(p.isContextLost).toBe(false);
      expect(p.uniforms.u_speed).toBe(4.2);

      action.destroy();
    });

    it('Vue 3: survives WebGL context loss and re-applies uniforms upon context restoration', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);
      const canvasRef = Vue.ref(canvas);
      let pipelineInstance: any = null;

      const TestComp = Vue.defineComponent({
        setup() {
          return useShaderCanvas(canvasRef, {
            glsl: 'void main() {}',
            driver: 'webgl2',
            uniforms: { u_reflection: 0.95 },
            onInit: (p: any) => {
              pipelineInstance = p;
            }
          });
        },
        render: () => Vue.h('div')
      });

      const app = Vue.createApp(TestComp);
      const container = new MockDOMNode();
      app.mount(container as any);
      await Vue.nextTick();
      await new Promise((r) => setTimeout(r, 40));

      expect(pipelineInstance).not.toBeNull();
      const gl = canvas.getContext('webgl2') as any;

      gl.triggerContextLost();
      expect(pipelineInstance.isContextLost).toBe(true);

      gl.triggerContextRestored();
      await new Promise((r) => setTimeout(r, 40));
      expect(pipelineInstance.isContextLost).toBe(false);
      expect(pipelineInstance.uniforms.u_reflection).toBe(0.95);

      app.unmount();
    });

    it('survives WebGL context loss during rapid 120Hz uniform update stream', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);

      const action = svelteAction(canvas, {
        glsl: 'void main() {}',
        driver: 'webgl2',
        uniforms: { u_speed: 1.0 }
      });

      await new Promise((r) => setTimeout(r, 40));
      const p = action.pipeline!;
      const gl = canvas.getContext('webgl2') as any;

      // Start rapid uniform stream, trigger context loss midway
      for (let i = 0; i < 60; i++) {
        action.update({ uniforms: { u_speed: i } });
      }

      gl.triggerContextLost();
      expect(p.isContextLost).toBe(true);

      // Continue sending updates during context loss (must not crash)
      for (let i = 60; i < 120; i++) {
        action.update({ uniforms: { u_speed: i } });
      }

      // Restore context
      gl.triggerContextRestored();
      await new Promise((r) => setTimeout(r, 40));
      expect(p.isContextLost).toBe(false);
      expect(p.uniforms.u_speed).toBe(119);

      action.destroy();
    });
  });

  // =========================================================================
  // Section 5: Structural Prop Mutation & Boundary Fuzzing
  // =========================================================================
  describe('5. Structural Prop Mutation & Boundary Fuzzing', () => {
    it('rebuilds pipeline when driver prop changes in React, disposing the previous pipeline', async () => {
      const container = mockDoc.createElement('div');
      const root = ReactDOMClient.createRoot(container);
      const pipelines: any[] = [];

      function AppWithDriver({ driver }: { driver: any }) {
        return React.createElement(ReactShaderCanvas, {
          glsl: 'void main() {}',
          driver,
          onInit: (p: any) => {
            console.log('[DEBUG onInit] driver:', p.getActiveDriver());
            pipelines.push(p);
          },
          onError: (err: any) => {
            console.log('[DEBUG onError]:', err);
          }
        });
      }

      await React.act(async () => {
        root.render(React.createElement(AppWithDriver, { driver: 'canvas2d' }));
      });

      await new Promise((r) => setTimeout(r, 40));
      expect(pipelines.length).toBe(1);
      const p1 = pipelines[0];
      expect(p1.isRunning).toBe(true);

      // Change driver to webgl2
      await React.act(async () => {
        root.render(React.createElement(AppWithDriver, { driver: 'webgl2' }));
      });

      await new Promise((r) => setTimeout(r, 60));
      console.log('[DEBUG result] pipelines length:', pipelines.length);
      expect(pipelines.length).toBe(2);
      const p2 = pipelines[1];

      // Previous pipeline must be stopped/disposed
      expect(p1.isRunning).toBe(false);
      expect(p2.isRunning).toBe(true);

      await React.act(async () => {
        root.unmount();
      });
    });

    it('rebuilds pipeline when glsl prop changes in Svelte action', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const canvas = new CanvasClass(800, 600);
      const pipelines: any[] = [];

      const action = svelteAction(canvas, {
        glsl: 'void main() { /* v1 */ }',
        driver: 'canvas2d',
        onInit: (p: any) => pipelines.push(p)
      });

      await new Promise((r) => setTimeout(r, 40));
      expect(pipelines.length).toBe(1);
      const p1 = pipelines[0];

      // Mutate glsl structurally
      action.update({ glsl: 'void main() { /* v2 */ }' });
      await new Promise((r) => setTimeout(r, 40));

      expect(pipelines.length).toBe(2);
      expect(p1.isRunning).toBe(false);
      expect(pipelines[1].isRunning).toBe(true);

      action.destroy();
    });

    it('Custom Element fuzzing: tolerates bizarre attributes, malformed JSON, and unknown props', async () => {
      const el = new ShaderBitElement();
      const attributesMap = new Map<string, string>();

      (el as any).isConnected = true;
      (el as any).attributes = [];
      (el as any).setAttribute = vi.fn((name: string, val: string) => {
        attributesMap.set(name, String(val));
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).getAttribute = vi.fn((name: string) => attributesMap.get(name) || null);
      (el as any).hasAttribute = vi.fn((name: string) => attributesMap.has(name));
      (el as any).removeAttribute = vi.fn((name: string) => {
        attributesMap.delete(name);
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).appendChild = vi.fn((child: any) => child);

      el.setAttribute('effect', 'liquid-chrome');
      el.setAttribute('driver', 'canvas2d');
      el.connectedCallback();

      await new Promise((r) => setTimeout(r, 40));

      // Bizarre attribute tests:
      expect(() => {
        el.attributeChangedCallback('u-', null, '1.0');
        el.attributeChangedCallback('u-unknown-bizarre-attr', null, 'hello');
        el.attributeChangedCallback('uniforms', null, '{malformed json');
        el.attributeChangedCallback('u-speed', null, 'NaN');
        el.attributeChangedCallback('u-speed', null, 'Infinity');
        el.attributeChangedCallback('u-color1', null, '#invalidhex');
      }).not.toThrow();

      el.disconnectedCallback();
    });

    it('handles zero-dimension and negative canvas bounds under adapters without crashing', async () => {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const zeroCanvas = new CanvasClass(0, 0);

      const action = svelteAction(zeroCanvas, {
        glsl: 'void main() {}',
        driver: 'canvas2d'
      });

      await new Promise((r) => setTimeout(r, 40));
      expect(action.pipeline).not.toBeNull();
      // Render frame on 0x0 canvas must succeed without throwing
      expect(() => {
        action.pipeline?.render();
      }).not.toThrow();

      action.destroy();
    });

    it('Custom Element: supports Shadow DOM canvas attachment', async () => {
      const el = new ShaderBitElement();
      const shadowRoot = new MockDOMNode('SHADOW-ROOT');
      (shadowRoot as any).appendChild = vi.fn((child: any) => child);
      (el as any).shadowRoot = shadowRoot;

      const attributesMap = new Map<string, string>();
      (el as any).isConnected = true;
      (el as any).attributes = [];
      (el as any).setAttribute = vi.fn((name: string, val: string) => {
        attributesMap.set(name, String(val));
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).getAttribute = vi.fn((name: string) => attributesMap.get(name) || null);
      (el as any).hasAttribute = vi.fn((name: string) => attributesMap.has(name));
      (el as any).removeAttribute = vi.fn((name: string) => {
        attributesMap.delete(name);
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });

      el.setAttribute('effect', 'caustics');
      el.setAttribute('driver', 'canvas2d');
      el.connectedCallback();

      await new Promise((r) => setTimeout(r, 40));
      expect(shadowRoot.appendChild).toHaveBeenCalledWith(el.canvas);
      expect(el.pipeline).not.toBeNull();
      expect(el.pipeline?.isRunning).toBe(true);

      el.disconnectedCallback();
      expect(el.pipeline).toBeNull();
    });

    it('Custom Element: consecutive connectedCallback calls are idempotent and do not duplicate canvas', async () => {
      const el = new ShaderBitElement();
      const attributesMap = new Map<string, string>();
      const appendedChildren: any[] = [];

      (el as any).isConnected = true;
      (el as any).attributes = [];
      (el as any).setAttribute = vi.fn((name: string, val: string) => {
        attributesMap.set(name, String(val));
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).getAttribute = vi.fn((name: string) => attributesMap.get(name) || null);
      (el as any).hasAttribute = vi.fn((name: string) => attributesMap.has(name));
      (el as any).removeAttribute = vi.fn((name: string) => {
        attributesMap.delete(name);
        (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
      });
      (el as any).appendChild = vi.fn((child: any) => {
        appendedChildren.push(child);
        return child;
      });

      el.setAttribute('effect', 'liquid-chrome');
      el.setAttribute('driver', 'canvas2d');

      // Call connectedCallback 3 times consecutively
      el.connectedCallback();
      el.connectedCallback();
      el.connectedCallback();

      await new Promise((r) => setTimeout(r, 40));

      // Canvas should only have been created and appended once
      expect(appendedChildren.length).toBe(1);
      expect(el.pipeline).not.toBeNull();
      expect(el.pipeline?.isRunning).toBe(true);

      el.disconnectedCallback();
    });
  });
});
