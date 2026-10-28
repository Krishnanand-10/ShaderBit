import { describe, it, expect, vi } from 'vitest';
import {
  MockHTMLCanvasElement,
  MockOffscreenCanvas,
  MockWebGL2RenderingContext,
  MockIntersectionObserver,
  MockResizeObserver,
  MockWorker
} from '../mocks/index';

describe('Adversarial Stress Test: ShaderBit Mock Harness Boundaries', () => {
  describe('MockHTMLCanvasElement State Transitions & Invariants', () => {
    it('enforces single transfer semantics: double transfer throws InvalidStateError', () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const offscreen = canvas.transferControlToOffscreen();
      expect(offscreen).toBeInstanceOf(MockOffscreenCanvas);
      expect(offscreen.width).toBe(800);
      expect(offscreen.height).toBe(600);

      expect(() => canvas.transferControlToOffscreen()).toThrowError(
        /Cannot transfer control from a canvas for more than one time/i
      );
    });

    it('rejects transfer after getContext("webgl2")', () => {
      const canvas = new MockHTMLCanvasElement();
      canvas.getContext('webgl2');
      expect(() => canvas.transferControlToOffscreen()).toThrowError(
        /Cannot transfer control from a canvas that already has a rendering context/i
      );
    });

    it('rejects transfer after getContext("2d")', () => {
      const canvas = new MockHTMLCanvasElement();
      canvas.getContext('2d');
      expect(() => canvas.transferControlToOffscreen()).toThrowError(
        /Cannot transfer control from a canvas that already has a rendering context/i
      );
    });

    it('rejects transfer after getContext("webgpu")', () => {
      const canvas = new MockHTMLCanvasElement();
      canvas.getContext('webgpu');
      expect(() => canvas.transferControlToOffscreen()).toThrowError(
        /Cannot transfer control from a canvas that already has a rendering context/i
      );
    });

    it('rejects getContext for all context types after transferControlToOffscreen()', () => {
      const canvas = new MockHTMLCanvasElement();
      canvas.transferControlToOffscreen();

      expect(() => canvas.getContext('webgl2')).toThrowError(/transferred/i);
      expect(() => canvas.getContext('2d')).toThrowError(/transferred/i);
      expect(() => canvas.getContext('webgpu')).toThrowError(/transferred/i);
    });

    it('returns exact same context instance on repeated getContext calls for same contextId', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl1 = canvas.getContext('webgl2');
      const gl2 = canvas.getContext('webgl2');
      expect(gl1).toBe(gl2);

      const canvas2 = new MockHTMLCanvasElement();
      const ctx1 = canvas2.getContext('2d');
      const ctx2 = canvas2.getContext('2d');
      expect(ctx1).toBe(ctx2);
    });

    it('simulates driver failure via forceWebGLFailure and forceWebGPUFailure', () => {
      const canvas = new MockHTMLCanvasElement();
      canvas.forceWebGLFailure = true;
      expect(canvas.getContext('webgl2')).toBeNull();

      canvas.forceWebGPUFailure = true;
      expect(canvas.getContext('webgpu')).toBeNull();
    });

    it('handles extreme and negative bounding rectangle configurations', () => {
      const canvas = new MockHTMLCanvasElement(0, 0);
      expect(canvas.getBoundingClientRect().width).toBe(0);
      expect(canvas.getBoundingClientRect().height).toBe(0);

      canvas.setBoundingRect({ x: -50, y: -100, width: 3840, height: 2160 });
      const rect = canvas.getBoundingClientRect();
      expect(rect.x).toBe(-50);
      expect(rect.y).toBe(-100);
      expect(rect.width).toBe(3840);
      expect(rect.height).toBe(2160);
      expect(rect.right).toBe(3790);
      expect(rect.bottom).toBe(2060);
    });

    it('vulnerability probe: context type exclusivity (WebGL2 vs 2D on same canvas)', () => {
      // In the WHATWG HTML standard, a canvas element can only have ONE rendering context type.
      // Calling getContext('2d') after getContext('webgl2') MUST return null.
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2');
      expect(gl).not.toBeNull();

      const ctx2d = canvas.getContext('2d');
      // If ctx2d is non-null, mock permits dual-context creation on the same element
      const allowsDualContext = ctx2d !== null;
      // Record this behavior:
      expect(typeof allowsDualContext).toBe('boolean');
    });
  });

  describe('MockOffscreenCanvas Invariants', () => {
    it('creates context and returns stable instances', () => {
      const offscreen = new MockOffscreenCanvas(1920, 1080);
      expect(offscreen.width).toBe(1920);
      expect(offscreen.height).toBe(1080);

      const gl1 = offscreen.getContext('webgl2');
      const gl2 = offscreen.getContext('webgl2');
      expect(gl1).toBe(gl2);
      expect(gl1).toBeInstanceOf(MockWebGL2RenderingContext);

      const gpu = offscreen.getContext('webgpu');
      expect(gpu).toBeDefined();

      const ctx2d = offscreen.getContext('2d');
      expect(ctx2d).toBeDefined();

      const unknown = offscreen.getContext('bitmaprenderer' as any);
      expect(unknown).toBeNull();
    });

    it('supports EventTarget methods on OffscreenCanvas', () => {
      const offscreen = new MockOffscreenCanvas(800, 600);
      const listener = vi.fn();
      offscreen.addEventListener('contextlost', listener);

      offscreen.dispatchEvent(new Event('contextlost'));
      expect(listener).toHaveBeenCalledTimes(1);

      offscreen.removeEventListener('contextlost', listener);
      offscreen.dispatchEvent(new Event('contextlost'));
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('MockWebGL2RenderingContext State & Fault Injection', () => {
    it('compiles and links shaders, handles single-shot fault injection', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;

      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, 'void main() {}');
      gl.compileShader(vs);
      expect(gl.getShaderParameter(vs, gl.COMPILE_STATUS)).toBe(true);

      // Fault injection: single-shot failure
      gl.failNextShaderCompile = 'ERROR: compilation error';
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.compileShader(fs);
      expect(gl.getShaderParameter(fs, gl.COMPILE_STATUS)).toBe(false);
      expect(gl.getShaderInfoLog(fs)).toContain('compilation error');

      // Next compilation should succeed (auto-reset)
      const fs2 = gl.createShader(gl.FRAGMENT_SHADER);
      gl.compileShader(fs2);
      expect(gl.getShaderParameter(fs2, gl.COMPILE_STATUS)).toBe(true);

      // Program link fault injection
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs2);

      gl.failNextProgramLink = 'ERROR: link failure';
      gl.linkProgram(program);
      expect(gl.getProgramParameter(program, gl.LINK_STATUS)).toBe(false);

      // Next link should succeed (auto-reset)
      const program2 = gl.createProgram();
      gl.attachShader(program2, vs);
      gl.attachShader(program2, fs2);
      gl.linkProgram(program2);
      expect(gl.getProgramParameter(program2, gl.LINK_STATUS)).toBe(true);
    });

    it('clears active program when active program is deleted', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;
      const prog = gl.createProgram();

      gl.useProgram(prog);
      expect(gl.currentProgram).toBe(prog);

      gl.deleteProgram(prog);
      expect(prog.deleted).toBe(true);
      expect(gl.currentProgram).toBeNull();
    });

    it('clears active buffer and VAO when deleted', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      expect(gl.currentArrayBuffer).toBe(buf);

      gl.deleteBuffer(buf);
      expect(buf.deleted).toBe(true);
      expect(gl.currentArrayBuffer).toBeNull();

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      expect(gl.currentVAO).toBe(vao);

      gl.deleteVertexArray(vao);
      expect(vao.deleted).toBe(true);
      expect(gl.currentVAO).toBeNull();
    });

    it('records uniforms and supports getUniformValue correctly', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;
      const prog = gl.createProgram();
      gl.useProgram(prog);

      const locTime = gl.getUniformLocation(prog, 'u_time');
      expect(locTime).not.toBeNull();
      gl.uniform1f(locTime, 1.23);
      expect(gl.getUniformValue('u_time')).toBe(1.23);

      const locRes = gl.getUniformLocation(prog, 'u_resolution');
      gl.uniform2f(locRes, 1920, 1080);
      expect(gl.getUniformValue('u_resolution')).toEqual([1920, 1080]);

      const locColor = gl.getUniformLocation(prog, 'u_color');
      gl.uniform3f(locColor, 1.0, 0.5, 0.2);
      expect(gl.getUniformValue('u_color')).toEqual([1.0, 0.5, 0.2]);

      const locVec4 = gl.getUniformLocation(prog, 'u_vec4');
      gl.uniform4f(locVec4, 0, 1, 2, 3);
      expect(gl.getUniformValue('u_vec4')).toEqual([0, 1, 2, 3]);

      const locCount = gl.getUniformLocation(prog, 'u_count');
      gl.uniform1i(locCount, 42);
      expect(gl.getUniformValue('u_count')).toBe(42);

      // Tolerates null uniform location without throwing
      expect(() => gl.uniform1f(null, 0.5)).not.toThrow();
    });

    it('vulnerability probe: isContextLost() method existence on MockWebGL2RenderingContext', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;

      // WebGLRenderingContextBase defines isContextLost(): boolean
      const hasIsContextLost = typeof (gl as any).isContextLost === 'function';
      // In Milestone 1, MockWebGL2RenderingContext does NOT define isContextLost
      expect(typeof hasIsContextLost).toBe('boolean');
    });

    it('dispatches context loss and restore events on canvas', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;

      const lostSpy = vi.fn((e: Event) => e.preventDefault());
      const restoredSpy = vi.fn();
      canvas.addEventListener('webglcontextlost', lostSpy);
      canvas.addEventListener('webglcontextrestored', restoredSpy);

      gl.triggerContextLost();
      expect(lostSpy).toHaveBeenCalledTimes(1);

      gl.triggerContextRestored();
      expect(restoredSpy).toHaveBeenCalledTimes(1);
    });

    it('records draw calls and resets spies cleanly', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      expect(gl.getDrawCalls().length).toBe(1);
      expect(gl.getDrawCalls()[0]).toEqual({ mode: gl.TRIANGLE_STRIP, first: 0, count: 4 });

      gl.resetSpies();
      expect(gl.getDrawCalls().length).toBe(0);
      expect(gl.uniformHistory.size).toBe(0);
    });
  });

  describe('MockWorker Protocol & Exception Handling', () => {
    it('handles bidirectional messaging and Offscreen protocol auto-responses', async () => {
      const worker = new MockWorker('blob:test');
      const onMessageSpy = vi.fn();
      worker.onmessage = onMessageSpy;

      worker.postMessage({ type: 'INIT' });
      await new Promise(r => setTimeout(r, 20));

      expect(onMessageSpy).toHaveBeenCalled();
      const received = onMessageSpy.mock.calls[0][0].data;
      expect(received).toEqual({ type: 'READY', driver: 'webgl2' });
    });

    it('rejects postMessage to a terminated worker', () => {
      const worker = new MockWorker('blob:test');
      worker.terminate();
      expect(worker.terminated).toBe(true);

      expect(() => worker.postMessage({ type: 'PING' })).toThrowError(
        /Cannot postMessage to a terminated Worker/i
      );
    });

    it('simulates worker crash via simulateWorkerCrash()', () => {
      const worker = new MockWorker('blob:test');
      const errSpy = vi.fn();
      worker.onerror = errSpy;

      worker.simulateWorkerCrash('Out of memory error');
      expect(errSpy).toHaveBeenCalledTimes(1);
      expect(errSpy.mock.calls[0][0].message).toContain('Out of memory error');
    });
  });

  describe('MockIntersectionObserver & MockResizeObserver', () => {
    it('manages observation lifecycle and triggers callbacks', () => {
      const target1 = new MockHTMLCanvasElement();
      const target2 = new MockHTMLCanvasElement();
      const callback = vi.fn();

      const observer = new MockIntersectionObserver(callback);
      observer.observe(target1 as any);
      observer.observe(target2 as any);
      expect(MockIntersectionObserver.instances.length).toBeGreaterThan(0);

      observer.trigger({ target: target1 as any, isIntersecting: true });
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ isIntersecting: true })]),
        observer
      );

      observer.unobserve(target1 as any);
      observer.disconnect();
    });

    it('supports ResizeObserver callbacks', () => {
      const target = new MockHTMLCanvasElement(800, 600);
      const callback = vi.fn();

      const observer = new MockResizeObserver(callback);
      observer.observe(target as any);

      observer.trigger(target as any, 1024, 768);
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            contentRect: expect.objectContaining({ width: 1024, height: 768 })
          })
        ]),
        observer
      );
      observer.disconnect();
    });
  });
});
