import { describe, it, expect } from 'vitest';
import {
  MockHTMLCanvasElement,
  MockOffscreenCanvas,
  MockWebGL2RenderingContext,
  MockIntersectionObserver,
  MockResizeObserver,
  setupMockPageVisibility,
  MockWorker
} from './index';

describe('ShaderBit Headless Mock Harness', () => {
  describe('MockHTMLCanvasElement & MockOffscreenCanvas', () => {
    it('creates canvas and acquires WebGL2, WebGPU, and Canvas2D contexts', () => {
      const canvas = new MockHTMLCanvasElement(1024, 768);
      expect(canvas.width).toBe(1024);
      expect(canvas.height).toBe(768);

      const gl = canvas.getContext('webgl2');
      expect(gl).toBeInstanceOf(MockWebGL2RenderingContext);
      expect(gl?.canvas).toBe(canvas);

      const canvas2 = new MockHTMLCanvasElement(800, 600);
      const gpu = canvas2.getContext('webgpu');
      expect(gpu).toBeDefined();

      const canvas3 = new MockHTMLCanvasElement(800, 600);
      const ctx2d = canvas3.getContext('2d');
      expect(ctx2d).toBeDefined();
    });

    it('handles getBoundingClientRect and setBoundingRect', () => {
      const canvas = new MockHTMLCanvasElement(500, 400);
      const rect1 = canvas.getBoundingClientRect();
      expect(rect1.width).toBe(500);
      expect(rect1.height).toBe(400);

      canvas.setBoundingRect({ x: 10, y: 20, width: 600, height: 450 });
      const rect2 = canvas.getBoundingClientRect();
      expect(rect2.left).toBe(10);
      expect(rect2.top).toBe(20);
      expect(rect2.width).toBe(600);
      expect(rect2.height).toBe(450);
      expect(rect2.right).toBe(610);
      expect(rect2.bottom).toBe(470);
    });

    it('transfers control to OffscreenCanvas and enforces single transfer semantics', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const offscreen = canvas.transferControlToOffscreen();
      expect(offscreen).toBeInstanceOf(MockOffscreenCanvas);
      expect(offscreen.width).toBe(800);
      expect(offscreen.height).toBe(600);

      // Second transfer should throw InvalidStateError
      expect(() => canvas.transferControlToOffscreen()).toThrowError(/transfer/i);

      // Context acquisition on transferred canvas should throw
      expect(() => canvas.getContext('webgl2')).toThrowError(/transferred/i);
    });

    it('cannot transfer control after context is already acquired', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.getContext('webgl2');
      expect(() => canvas.transferControlToOffscreen()).toThrowError(/already has a rendering context/i);
    });

    it('simulates WebGL2 and WebGPU unavailability via flags', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      canvas.forceWebGLFailure = true;
      expect(canvas.getContext('webgl2')).toBeNull();

      const canvas2 = new MockHTMLCanvasElement(800, 600);
      canvas2.forceWebGPUFailure = true;
      expect(canvas2.getContext('webgpu')).toBeNull();
    });
  });

  describe('MockWebGL2RenderingContext', () => {
    it('manages shader compilation, linking, and fault injection', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;

      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, 'void main() { gl_Position = vec4(0.0); }');
      gl.compileShader(vs);
      expect(gl.getShaderParameter(vs, gl.COMPILE_STATUS)).toBe(true);

      // Fault injection
      gl.failNextShaderCompile = 'ERROR: 0:1: syntax error';
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.compileShader(fs);
      expect(gl.getShaderParameter(fs, gl.COMPILE_STATUS)).toBe(false);
      expect(gl.getShaderInfoLog(fs)).toContain('syntax error');

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.linkProgram(program);
      expect(gl.getProgramParameter(program, gl.LINK_STATUS)).toBe(true);

      gl.useProgram(program);
      expect(gl.currentProgram).toBe(program);

      gl.deleteShader(vs);
      expect(gl.isDeleted(vs)).toBe(true);
      gl.deleteProgram(program);
      expect(gl.isDeleted(program)).toBe(true);
    });

    it('records VAOs, buffers, and draw calls', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      expect(gl.currentVAO).toBe(vao);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const drawCalls = gl.getDrawCalls();
      expect(drawCalls).toHaveLength(1);
      expect(drawCalls[0].mode).toBe(gl.TRIANGLES);
      expect(drawCalls[0].count).toBe(3);

      gl.deleteVertexArray(vao);
      expect(gl.isDeleted(vao)).toBe(true);
      gl.deleteBuffer(buffer);
      expect(gl.isDeleted(buffer)).toBe(true);
    });

    it('tracks uniform values and history', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;
      const program = gl.createProgram();
      gl.useProgram(program);

      const locTime = gl.getUniformLocation(program, 'u_time');
      gl.uniform1f(locTime, 1.25);
      expect(gl.getUniformValue('u_time')).toBe(1.25);

      const locRes = gl.getUniformLocation(program, 'u_resolution');
      gl.uniform2f(locRes, 800, 600);
      expect(gl.getUniformValue('u_resolution')).toEqual([800, 600]);

      gl.uniform1f(locTime, 2.5);
      expect(gl.uniformHistory.get('u_time')).toEqual([1.25, 2.5]);
    });

    it('dispatches context loss and restoration events', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;
      let lost = false;
      let restored = false;

      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        lost = true;
      });
      canvas.addEventListener('webglcontextrestored', () => {
        restored = true;
      });

      gl.triggerContextLost();
      expect(lost).toBe(true);

      gl.triggerContextRestored();
      expect(restored).toBe(true);
    });
  });

  describe('MockWebGPU', () => {
    it('supports navigator.gpu adapter and device initialization', async () => {
      const canvas = new MockHTMLCanvasElement();
      const gpuCtx = canvas.getContext('webgpu')!;
      const gpu = (navigator as any).gpu;

      const adapter = await gpu.requestAdapter();
      expect(adapter).toBeDefined();

      const device = await adapter.requestDevice();
      expect(device).toBeDefined();

      gpuCtx.configure({ device, format: gpu.getPreferredCanvasFormat() });
      expect(gpuCtx.device).toBe(device);
      expect(gpuCtx.format).toBe('bgra8unorm');

      const buffer = device.createBuffer({ size: 64, usage: 1 });
      device.queue.writeBuffer(buffer, 0, new Float32Array([1, 2, 3]));
      expect(buffer.data).toBeDefined();

      const cmd = device.createCommandEncoder();
      const pass = cmd.beginRenderPass({});
      pass.draw(6);
      pass.end();
      expect(pass.drawCalls).toHaveLength(1);
      expect(pass.drawCalls[0].vertexCount).toBe(6);
    });
  });

  describe('MockCanvasRenderingContext2D', () => {
    it('records 2D procedural fallback rendering commands', () => {
      const canvas = new MockHTMLCanvasElement(400, 300);
      const ctx = canvas.getContext('2d')!;

      const grad = ctx.createLinearGradient(0, 0, 400, 300);
      grad.addColorStop(0, '#ff0000');
      grad.addColorStop(1, '#0000ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 400, 300);

      expect(ctx.fillRectCalls).toHaveLength(1);
      expect(ctx.fillRectCalls[0]).toEqual({ x: 0, y: 0, width: 400, height: 300 });
      expect(grad.colorStops).toHaveLength(2);
    });
  });

  describe('MockIntersectionObserver & MockResizeObserver', () => {
    it('observes elements and triggers intersection updates', () => {
      const canvas = new MockHTMLCanvasElement();
      let isVisible = false;

      const observer = new MockIntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
      });

      observer.observe(canvas as any);
      MockIntersectionObserver.triggerForElement(canvas as any, true);
      expect(isVisible).toBe(true);

      MockIntersectionObserver.triggerForElement(canvas as any, false);
      expect(isVisible).toBe(false);

      observer.disconnect();
    });

    it('observes elements and triggers resize updates', () => {
      const canvas = new MockHTMLCanvasElement();
      let currentWidth = 0;

      const observer = new MockResizeObserver((entries) => {
        currentWidth = entries[0].contentRect.width;
      });

      observer.observe(canvas as any);
      MockResizeObserver.triggerForElement(canvas as any, 1920, 1080);
      expect(currentWidth).toBe(1920);

      observer.disconnect();
    });
  });

  describe('Page Visibility API Mock', () => {
    it('toggles visibilityState and hidden property', () => {
      const visibility = setupMockPageVisibility();
      let state = document.visibilityState;

      document.addEventListener('visibilitychange', () => {
        state = document.visibilityState;
      });

      visibility.setVisibility('hidden');
      expect(document.hidden).toBe(true);
      expect(state).toBe('hidden');

      visibility.setVisibility('visible');
      expect(document.hidden).toBe(false);
      expect(state).toBe('visible');
    });
  });

  describe('MockWorker', () => {
    it('handles protocol messages and bidirectional communication', async () => {
      const worker = new MockWorker('worker.js');
      let readyReceived = false;

      worker.onmessage = (e) => {
        if (e.data.type === 'READY') {
          readyReceived = true;
        }
      };

      worker.postMessage({ type: 'INIT', driver: 'webgl2' });
      await new Promise((r) => setTimeout(r, 10));
      expect(readyReceived).toBe(true);

      worker.postMessage({ type: 'DESTROY' });
      await new Promise((r) => setTimeout(r, 10));
      expect(worker.terminated).toBe(true);
    });

    it('handles worker crash simulation', () => {
      const worker = new MockWorker('worker.js');
      let errorFired = false;

      worker.onerror = (e) => {
        errorFired = true;
        expect(e.message).toBe('Worker exploded');
      };

      worker.simulateWorkerCrash('Worker exploded');
      expect(errorFired).toBe(true);
    });
  });
});
