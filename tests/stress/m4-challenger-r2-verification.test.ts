import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shaderCanvas } from '../../packages/svelte/src/index';
import { ShaderPipeline } from '../../packages/core/src/index';
import { MockHTMLCanvasElement } from '../mocks/canvas';

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('Empirical Challenger R2: Svelte Adapter Remediation Verification', () => {
  beforeEach(() => {
    // Canvas setup handled by vitest setupFiles
  });

  describe('1. Post-Destroy Action Resilience & Resurrection Prevention', () => {
    it('guarantees action.update() is a strict no-op after destroy() across all option types', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let initCount = 0;
      let errorCount = 0;

      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        onInit: () => {
          initCount++;
        },
        onError: () => {
          errorCount++;
        }
      });

      await waitFor(() => initCount === 1);
      expect(action.pipeline).not.toBeNull();
      const firstPipeline = action.pipeline;

      // Destroy the action
      action.destroy();
      expect(action.pipeline).toBeNull();
      expect(firstPipeline?.isRunning).toBe(false);

      // Hammer update() with diverse payloads post-destroy
      action.update({ uniforms: { u_speed: 99.0 } });
      action.update({ glsl: 'void main() { gl_FragColor = vec4(1.0); }' });
      action.update({ wgsl: '@fragment fn main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }' });
      action.update({ driver: 'canvas2d' });
      action.update({ component: { id: 'new-effect', glsl: 'void main() {}' } });
      action.update({});

      // Allow any async microtasks/promises to settle
      await new Promise((r) => setTimeout(r, 100));

      expect(action.pipeline).toBeNull();
      expect(initCount).toBe(1); // No new pipeline initialized
      expect(errorCount).toBe(0); // No unhandled errors routed
      expect(firstPipeline?.isRunning).toBe(false);
    });

    it('prevents resurrection when destroy() is called while async pipeline initialization is in-flight', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let initCount = 0;

      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        onInit: () => {
          initCount++;
        }
      });

      // Synchronously destroy immediately before init completes
      action.destroy();
      expect(action.pipeline).toBeNull();

      // Immediately queue updates while in-flight init is resolving
      action.update({ glsl: 'void main() { gl_FragColor = vec4(0.5); }' });
      action.update({ uniforms: { u_speed: 5.0 } });

      await new Promise((r) => setTimeout(r, 120));

      expect(action.pipeline).toBeNull();
      expect(initCount).toBe(0); // onInit should never have been invoked
    });

    it('maintains null pipeline even if in-flight init resolves after rapid update and destroy', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const initializedPipelines: any[] = [];

      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        onInit: (p) => {
          initializedPipelines.push(p);
        }
      });

      // Trigger structural update to create second in-flight pipeline
      action.update({ glsl: 'void main() { gl_FragColor = vec4(0.2); }' });

      // Destroy immediately
      action.destroy();
      expect(action.pipeline).toBeNull();

      // Attempt another update
      action.update({ glsl: 'void main() { gl_FragColor = vec4(0.8); }' });

      await new Promise((r) => setTimeout(r, 150));

      expect(action.pipeline).toBeNull();
      // Any pipelines that finished init must be disposed
      for (const p of initializedPipelines) {
        expect(p.isRunning).toBe(false);
      }
    });
  });

  describe('2. Pipeline Re-creation on Structural Changes', () => {
    it('re-creates pipeline when GLSL changes and cleanly disposes prior pipeline', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const pipelines: any[] = [];

      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() { gl_FragColor = vec4(0.1); }',
        driver: 'canvas2d',
        onInit: (p) => {
          pipelines.push(p);
        }
      });

      await waitFor(() => pipelines.length === 1);
      expect(pipelines[0].isRunning).toBe(true);

      // Update GLSL
      action.update({ glsl: 'void main() { gl_FragColor = vec4(0.9); }' });
      await waitFor(() => pipelines.length === 2);

      expect(pipelines[0].isRunning).toBe(false); // Disposed
      expect(pipelines[1].isRunning).toBe(true);  // Running
      expect(action.pipeline).toBe(pipelines[1]);

      action.destroy();
      expect(pipelines[1].isRunning).toBe(false);
    });

    it('re-creates pipeline when WGSL changes', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const pipelines: any[] = [];

      const action = shaderCanvas(canvas as any, {
        wgsl: '@fragment fn main() -> @location(0) vec4<f32> { return vec4<f32>(0.0); }',
        driver: 'canvas2d',
        onInit: (p) => {
          pipelines.push(p);
        }
      });

      await waitFor(() => pipelines.length === 1);

      action.update({
        wgsl: '@fragment fn main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }'
      });
      await waitFor(() => pipelines.length === 2);

      expect(pipelines[0].isRunning).toBe(false);
      expect(pipelines[1].isRunning).toBe(true);

      action.destroy();
    });

    it('re-creates pipeline when component ID or component GLSL changes', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const pipelines: any[] = [];

      const action = shaderCanvas(canvas as any, {
        driver: 'canvas2d',
        component: {
          id: 'liquid-chrome',
          glsl: 'void main() { gl_FragColor = vec4(1.0); }'
        },
        onInit: (p) => {
          pipelines.push(p);
        }
      });

      await waitFor(() => pipelines.length === 1);

      // Change component to mesh-gradient
      action.update({
        component: {
          id: 'mesh-gradient',
          glsl: 'void main() { gl_FragColor = vec4(0.5); }'
        }
      });
      await waitFor(() => pipelines.length === 2);

      expect(pipelines[0].isRunning).toBe(false);
      expect(pipelines[1].isRunning).toBe(true);

      action.destroy();
    });

    it('survives rapid structural thrashing (100 sequential GLSL updates) without pipeline leaks', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const initializedPipelines: any[] = [];

      const action = shaderCanvas(canvas as any, {
        driver: 'canvas2d',
        glsl: 'void main() { gl_FragColor = vec4(0.0); }',
        onInit: (p) => {
          initializedPipelines.push(p);
        }
      });

      // Rapidly thrash glsl 100 times synchronously without awaiting
      for (let i = 1; i <= 100; i++) {
        action.update({
          glsl: `void main() { gl_FragColor = vec4(${i / 100.0}); }`
        });
      }

      // Wait for async processing to settle
      await new Promise((r) => setTimeout(r, 300));

      // The final active pipeline must be running
      const activePipeline = action.pipeline;
      expect(activePipeline).not.toBeNull();
      expect(activePipeline?.isRunning).toBe(true);

      // All older initialized pipelines except the current active one MUST be disposed
      for (const p of initializedPipelines) {
        if (p !== activePipeline) {
          expect(p.isRunning).toBe(false);
        }
      }

      action.destroy();
      expect(activePipeline?.isRunning).toBe(false);
      expect(action.pipeline).toBeNull();
    });

    it('preserves pipeline during non-structural uniform updates', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let initCount = 0;

      const action = shaderCanvas(canvas as any, {
        driver: 'canvas2d',
        glsl: 'void main() {}',
        uniforms: { u_speed: 1.0 },
        onInit: () => {
          initCount++;
        }
      });

      await waitFor(() => initCount === 1);
      const initialPipeline = action.pipeline;

      // Update uniforms only
      for (let i = 0; i < 50; i++) {
        action.update({
          uniforms: { u_speed: 1.0 + i * 0.1 }
        });
      }

      await new Promise((r) => setTimeout(r, 50));
      expect(initCount).toBe(1); // Pipeline was NEVER recreated
      expect(action.pipeline).toBe(initialPipeline);
      expect((action.pipeline as any).uniforms.u_speed).toBeCloseTo(5.9, 1);

      action.destroy();
    });
  });

  describe('3. Context Exclusivity & Safe Error Delegation', () => {
    it('delegates error to onError without crashing when context exclusivity prevents WebGL2', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let errorReceived: any = null;
      let initCount = 0;

      const action = shaderCanvas(canvas as any, {
        driver: 'canvas2d',
        glsl: 'void main() {}',
        onInit: () => {
          initCount++;
        },
        onError: (err) => {
          errorReceived = err;
        }
      });

      await waitFor(() => initCount === 1);
      expect(action.pipeline).not.toBeNull();

      // Request invalid transition: canvas already has 2D context, switching to webgl2 fails
      action.update({ driver: 'webgl2' });

      await waitFor(() => errorReceived !== null);
      expect(errorReceived).toBeInstanceOf(Error);
      expect(errorReceived?.message).toMatch(/context unavailable|compilation failed/i);

      // Calling destroy() after error should remain safe and clean
      expect(() => action.destroy()).not.toThrow();
      expect(action.pipeline).toBeNull();
    });
  });
});
