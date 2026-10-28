import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shaderCanvas, ShaderCanvas } from './index';

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('@shaderbit/svelte', () => {
  beforeEach(() => {
    // Vitest setupFiles populates global HTMLCanvasElement
  });

  it('exports shaderCanvas action function and ShaderCanvas component', () => {
    expect(typeof shaderCanvas).toBe('function');
    expect(ShaderCanvas).toBeDefined();
  });

  it('initializes ShaderPipeline via shaderCanvas action on canvas element', async () => {
    const CanvasClass = (globalThis as any).HTMLCanvasElement;
    const canvas = new CanvasClass(800, 600);

    let initializedPipeline: any = null;
    const action = shaderCanvas(canvas, {
      glsl: 'void main() { gl_FragColor = vec4(1.0); }',
      driver: 'canvas2d',
      uniforms: { u_speed: 1.0 },
      onInit: (p: any) => {
        initializedPipeline = p;
      }
    });

    expect(action).toBeDefined();
    expect(typeof action.update).toBe('function');
    expect(typeof action.destroy).toBe('function');

    await waitFor(() => initializedPipeline !== null);
    expect(initializedPipeline).not.toBeNull();
    expect(initializedPipeline.isRunning).toBe(true);
    expect(initializedPipeline.uniforms.u_speed).toBe(1.0);

    // Clean up
    action.destroy();
    expect(initializedPipeline.isRunning).toBe(false);
  });

  it('updates uniforms reactively via update() without recreating pipeline', async () => {
    const CanvasClass = (globalThis as any).HTMLCanvasElement;
    const canvas = new CanvasClass(800, 600);

    let initializedPipeline: any = null;
    const action = shaderCanvas(canvas, {
      glsl: 'void main() {}',
      driver: 'canvas2d',
      uniforms: { u_speed: 1.0 },
      onInit: (p: any) => {
        initializedPipeline = p;
      }
    });

    await waitFor(() => initializedPipeline !== null);
    const firstPipeline = initializedPipeline;
    expect(firstPipeline).not.toBeNull();

    // Reactive uniform update
    action.update({ uniforms: { u_speed: 4.5 } });
    expect(action.pipeline).toBe(firstPipeline); // Pipeline instance preserved
    expect((firstPipeline as any).uniforms.u_speed).toBe(4.5);

    action.destroy();
  });

  it('recreates pipeline when structural options change (driver, glsl)', async () => {
    const CanvasClass = (globalThis as any).HTMLCanvasElement;
    const canvas = new CanvasClass(800, 600);

    const pipelines: any[] = [];
    const action = shaderCanvas(canvas, {
      glsl: 'void main() {}',
      driver: 'canvas2d',
      onInit: (p: any) => {
        pipelines.push(p);
      }
    });

    await waitFor(() => pipelines.length === 1);
    expect(pipelines.length).toBe(1);
    const firstPipeline = pipelines[0];

    // Change glsl structurally
    action.update({ glsl: 'void main() { gl_FragColor = vec4(1.0); }' });
    await waitFor(() => pipelines.length === 2);

    expect(pipelines.length).toBe(2);
    expect(firstPipeline.isRunning).toBe(false); // First pipeline disposed
    expect(pipelines[1].isRunning).toBe(true);   // New pipeline running

    action.destroy();
    expect(pipelines[1].isRunning).toBe(false);
  });

  it('safely handles destroy() called while initialization is in-flight', async () => {
    const CanvasClass = (globalThis as any).HTMLCanvasElement;
    const canvas = new CanvasClass(800, 600);

    const action = shaderCanvas(canvas, {
      glsl: 'void main() {}',
      driver: 'canvas2d'
    });

    // Destroy immediately before async init resolves
    action.destroy();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(action.pipeline).toBeNull();
  });

  it('forwards error to onError when initialization fails', async () => {
    const CanvasClass = (globalThis as any).HTMLCanvasElement;
    const canvas = new CanvasClass(800, 600);

    let errorReceived: Error | null = null;
    const action = shaderCanvas(canvas, {
      driver: 'webgl2',
      glsl: '',
      onError: (err: Error) => {
        errorReceived = err;
      }
    });

    await waitFor(() => errorReceived !== null);
    expect(errorReceived).not.toBeNull();
    action.destroy();
  });
});
