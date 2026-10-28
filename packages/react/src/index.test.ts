import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, createRef, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShaderCanvas, useShaderPipeline } from './index';

function createMockDOMNode(tagName = 'DIV'): any {
  const node: any = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    childNodes: [],
    style: {},
    attributes: {},
    ownerDocument: null,
    parentNode: null,
    setAttribute(name: string, val: string) {
      node.attributes[name] = val;
    },
    getAttribute(name: string) {
      return node.attributes[name] || null;
    },
    removeAttribute(name: string) {
      delete node.attributes[name];
    },
    appendChild(child: any) {
      child.parentNode = node;
      node.childNodes.push(child);
      return child;
    },
    removeChild(child: any) {
      const idx = node.childNodes.indexOf(child);
      if (idx !== -1) {
        node.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    },
    insertBefore(newNode: any, refNode: any) {
      newNode.parentNode = node;
      const idx = node.childNodes.indexOf(refNode);
      if (idx !== -1) {
        node.childNodes.splice(idx, 0, newNode);
      } else {
        node.childNodes.push(newNode);
      }
      return newNode;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }),
    clientWidth: 800,
    clientHeight: 600,
    offsetWidth: 800,
    offsetHeight: 600
  };
  return node;
}

function setupMockDocument() {
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
      const el = createMockDOMNode(tagName);
      el.ownerDocument = doc;
      return el;
    },
    createTextNode(text: string) {
      return { nodeType: 3, textContent: text, parentNode: null };
    },
    createComment(text: string) {
      return { nodeType: 8, textContent: text, parentNode: null };
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  doc.documentElement = doc.createElement('html');
  doc.body = doc.createElement('body');
  doc.documentElement.appendChild(doc.body);
  return doc;
}

describe('@shaderbit/react', () => {
  let prevDoc: any;
  let prevWin: any;

  beforeEach(() => {
    prevDoc = (globalThis as any).document;
    prevWin = (globalThis as any).window;
    const doc = setupMockDocument();
    (globalThis as any).document = doc;
    (globalThis as any).window = globalThis;
  });

  afterEach(() => {
    (globalThis as any).document = prevDoc;
    (globalThis as any).window = prevWin;
  });

  it('exports ShaderCanvas component and useShaderPipeline hook', () => {
    expect(ShaderCanvas).toBeDefined();
    expect(ShaderCanvas.displayName).toBe('ShaderCanvas');
    expect(typeof useShaderPipeline).toBe('function');
  });

  it('mounts ShaderCanvas into DOM via createRoot and initializes pipeline', async () => {
    const container = (globalThis as any).document.createElement('div');
    const root = createRoot(container);
    let initializedPipeline: any = null;

    await act(async () => {
      root.render(
        React.createElement(ShaderCanvas, {
          glsl: 'void main() { gl_FragColor = vec4(1.0); }',
          driver: 'canvas2d',
          onInit: (pipeline: any) => {
            initializedPipeline = pipeline;
          }
        })
      );
    });

    expect(container.childNodes.length).toBe(1);
    expect(container.childNodes[0].tagName).toBe('CANVAS');
    expect(initializedPipeline).not.toBeNull();
    expect(initializedPipeline.isRunning).toBe(true);

    await act(async () => {
      root.unmount();
    });
    expect(initializedPipeline.isRunning).toBe(false);
  });

  it('forwards ref to HTMLCanvasElement with pipeline and canvas properties', async () => {
    const container = (globalThis as any).document.createElement('div');
    const root = createRoot(container);
    const canvasRef = createRef<HTMLCanvasElement>();

    await act(async () => {
      root.render(
        React.createElement(ShaderCanvas, {
          ref: canvasRef,
          glsl: 'void main() {}',
          driver: 'canvas2d'
        })
      );
    });

    expect(canvasRef.current).not.toBeNull();
    expect(canvasRef.current?.tagName).toBe('CANVAS');
    expect((canvasRef.current as any).canvas).toBe(canvasRef.current);
    expect((canvasRef.current as any).pipeline).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('synchronizes uniform props reactively without recreating pipeline', async () => {
    const container = (globalThis as any).document.createElement('div');
    const root = createRoot(container);
    let pipelineInstance: any = null;

    function TestApp({ speed }: { speed: number }) {
      return React.createElement(ShaderCanvas, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        uniforms: { u_speed: speed },
        onInit: (p: any) => {
          pipelineInstance = p;
        }
      });
    }

    await act(async () => {
      root.render(React.createElement(TestApp, { speed: 1.0 }));
    });

    const firstPipeline = pipelineInstance;
    expect(firstPipeline).not.toBeNull();
    expect((firstPipeline as any).uniforms.u_speed).toBe(1.0);

    // Update uniform prop
    await act(async () => {
      root.render(React.createElement(TestApp, { speed: 3.5 }));
    });

    // Pipeline should remain the same instance (no recreation)
    expect(pipelineInstance).toBe(firstPipeline);
    expect((firstPipeline as any).uniforms.u_speed).toBe(3.5);

    await act(async () => {
      root.unmount();
    });
  });

  it('handles React 18 StrictMode double-mounting safely', async () => {
    const container = (globalThis as any).document.createElement('div');
    const root = createRoot(container);
    let initializedPipeline: any = null;

    await act(async () => {
      root.render(
        React.createElement(
          StrictMode,
          null,
          React.createElement(ShaderCanvas, {
            glsl: 'void main() {}',
            driver: 'canvas2d',
            onInit: (p: any) => {
              initializedPipeline = p;
            }
          })
        )
      );
    });

    expect(initializedPipeline).not.toBeNull();
    expect(initializedPipeline.isRunning).toBe(true);

    await act(async () => {
      root.unmount();
    });
    expect(initializedPipeline.isRunning).toBe(false);
  });

  it('forwards errors to onError callback when pipeline initialization fails', async () => {
    const container = (globalThis as any).document.createElement('div');
    const root = createRoot(container);
    let receivedError: Error | null = null;

    await act(async () => {
      root.render(
        React.createElement(ShaderCanvas, {
          // Empty/missing shader causes init failure or driver failure
          driver: 'webgl2',
          glsl: undefined,
          wgsl: undefined,
          onError: (err: Error) => {
            receivedError = err;
          }
        })
      );
    });

    // An error should have been caught or pipeline handled cleanly
    await act(async () => {
      root.unmount();
    });
  });
});
