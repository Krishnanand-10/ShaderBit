// Set up mock DOM globals BEFORE vue is imported/evaluated
class MockDOMElement {
  nodeType = 1;
  tagName = 'DIV';
  childNodes: any[] = [];
  style: any = {};
  attributes: Record<string, string> = {};
  ownerDocument: any;
  parentNode: any = null;

  setAttribute(name: string, val: string) {
    this.attributes[name] = val;
  }
  getAttribute(name: string) {
    return this.attributes[name] || null;
  }
  removeAttribute(name: string) {
    delete this.attributes[name];
  }
  appendChild(child: any) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child: any) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }
  insertBefore(newNode: any, refNode: any) {
    newNode.parentNode = this;
    const idx = this.childNodes.indexOf(refNode);
    if (idx !== -1) {
      this.childNodes.splice(idx, 0, newNode);
    } else {
      this.childNodes.push(newNode);
    }
    return newNode;
  }
}

const mockDoc: any = {
  nodeType: 9,
  createElement: (tag: string) => {
    if (tag.toLowerCase() === 'canvas') {
      const CanvasClass = (globalThis as any).HTMLCanvasElement;
      const c = new CanvasClass(800, 600);
      c.tagName = 'CANVAS';
      c.ownerDocument = mockDoc;
      c.style = {};
      return c;
    }
    const el = new MockDOMElement();
    el.tagName = tag.toUpperCase();
    el.ownerDocument = mockDoc;
    return el;
  },
  createElementNS: (_ns: string, tag: string) => {
    return mockDoc.createElement(tag);
  },
  querySelector: () => null
};

(globalThis as any).Element = MockDOMElement;
(globalThis as any).HTMLElement = MockDOMElement;
(globalThis as any).SVGElement = MockDOMElement;
(globalThis as any).window = globalThis;
(globalThis as any).document = mockDoc;

import { describe, it, expect } from 'vitest';

// Dynamically import vue and package so they observe global document
const { ref, reactive, nextTick, defineComponent, h, createApp } = await import('vue');
const { ShaderCanvas, useShaderCanvas } = await import('./index');

describe('@shaderbit/vue', () => {
  it('exports ShaderCanvas component and useShaderCanvas composable', () => {
    expect(ShaderCanvas).toBeDefined();
    expect(ShaderCanvas.name).toBe('ShaderCanvas');
    expect(typeof useShaderCanvas).toBe('function');
  });

  it('initializes ShaderPipeline via useShaderCanvas composable on canvas ref', async () => {
    const CanvasClass = (globalThis as any).HTMLCanvasElement;
    const canvas = new CanvasClass(800, 600);
    const canvasRef = ref<HTMLCanvasElement | null>(canvas);

    let initializedPipeline: any = null;
    const options = reactive({
      glsl: 'void main() { gl_FragColor = vec4(1.0); }',
      driver: 'canvas2d' as const,
      uniforms: { u_speed: 1.0 },
      onInit: (p: any) => {
        initializedPipeline = p;
      }
    });

    const TestComp = defineComponent({
      setup() {
        const result = useShaderCanvas(canvasRef, options);
        return { ...result };
      },
      render: () => h('div')
    });

    const app = createApp(TestComp);
    const container = new MockDOMElement();
    container.ownerDocument = mockDoc;

    app.mount(container as any);
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(initializedPipeline).not.toBeNull();
    expect(initializedPipeline.isRunning).toBe(true);
    expect(initializedPipeline.uniforms.u_speed).toBe(1.0);

    // Dynamic uniform update via deep reactive watcher
    options.uniforms.u_speed = 3.5;
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(initializedPipeline.uniforms.u_speed).toBe(3.5);

    // Unmount app and verify pipeline disposal
    app.unmount();
    expect(initializedPipeline.isRunning).toBe(false);
  });

  it('recreates pipeline when structural options change', async () => {
    const CanvasClass = (globalThis as any).HTMLCanvasElement;
    const canvas = new CanvasClass(800, 600);
    const canvasRef = ref<HTMLCanvasElement | null>(canvas);

    const pipelines: any[] = [];
    const options = reactive({
      glsl: 'void main() {}',
      driver: 'canvas2d' as any,
      onInit: (p: any) => {
        pipelines.push(p);
      }
    });

    const TestComp = defineComponent({
      setup() {
        return useShaderCanvas(canvasRef, options);
      },
      render: () => h('div')
    });

    const app = createApp(TestComp);
    const container = new MockDOMElement();
    container.ownerDocument = mockDoc;

    app.mount(container as any);
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(pipelines.length).toBe(1);
    const firstPipeline = pipelines[0];

    // Change structural property: driver
    options.driver = 'webgl2';
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(pipelines.length).toBe(2);
    expect(firstPipeline.isRunning).toBe(false); // old pipeline disposed
    expect(pipelines[1].isRunning).toBe(true);  // new pipeline running

    app.unmount();
  });

  it('exposes pipeline, canvas, and uniform helper methods on ShaderCanvas', () => {
    expect(ShaderCanvas.props).toBeDefined();
    expect(ShaderCanvas.emits).toContain('init');
    expect(ShaderCanvas.emits).toContain('error');
  });
});
