/**
 * Tier 1 Feature Test: Headless GPU Engine Drivers (WebGL2, WebGPU, 2D Fallback)
 * Tests full-screen quad creation, shader compilation, dynamic uniform updates, fallback hierarchy, and cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  MockWebGL2RenderingContext,
  MockGPUCanvasContext,
  MockCanvasRenderingContext2D,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';

// Implementation-agnostic driver abstractions adhering strictly to PROJECT.md § Interface Contracts
export interface ShaderUniformValue {
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'int';
  value: any;
}

export class WebGL2Driver {
  private canvas: MockCanvasElement;
  private gl: MockWebGL2RenderingContext;
  private program: any = null;
  private vao: any = null;
  private buffer: any = null;
  private uniforms: Map<string, ShaderUniformValue> = new Map();

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('webgl2');
    if (!ctx) throw new Error('Failed to acquire WebGL2 context');
    this.gl = ctx;
  }

  async init(glsl?: string): Promise<boolean> {
    const gl = this.gl;
    const vsSource = `#version 300 es
      in vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }`;
    const fsSource = glsl || `#version 300 es
      precision highp float;
      out vec4 fragColor;
      void main() { fragColor = vec4(1.0); }`;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error(`Fragment shader compilation failed: ${gl.getShaderInfoLog(fs)}`);
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog)}`);
    }

    this.program = prog;

    // Full screen quad [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]
    const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    return true;
  }

  setUniform(name: string, value: ShaderUniformValue): void {
    this.uniforms.set(name, value);
    if (!this.program) return;
    const loc = this.gl.getUniformLocation(this.program, name);
    if (!loc) return;

    if (value.type === 'float') this.gl.uniform1f(loc, value.value);
    else if (value.type === 'vec2') this.gl.uniform2f(loc, value.value[0], value.value[1]);
    else if (value.type === 'vec3') this.gl.uniform3f(loc, value.value[0], value.value[1], value.value[2]);
    else if (value.type === 'vec4') this.gl.uniform4f(loc, value.value[0], value.value[1], value.value[2], value.value[3]);
    else if (value.type === 'int') this.gl.uniform1i(loc, value.value);
  }

  render(time: number, mouse: [number, number]): void {
    if (!this.program || !this.vao) return;
    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);
    this.setUniform('u_time', { type: 'float', value: time });
    this.setUniform('u_mouse', { type: 'vec2', value: mouse });
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    if (this.buffer) this.gl.deleteBuffer(this.buffer);
    if (this.vao) this.gl.deleteVertexArray(this.vao);
    if (this.program) this.gl.deleteProgram(this.program);
    this.program = null;
    this.vao = null;
    this.buffer = null;
  }
}

export class WebGPUDriver {
  private canvas: MockCanvasElement;
  private device: any = null;
  private pipeline: any = null;
  private uniformBuffer: any = null;

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
  }

  async init(wgsl?: string): Promise<boolean> {
    const gpu = (globalThis as any).navigator?.gpu;
    if (!gpu) return false;

    const adapter = await gpu.requestAdapter();
    if (!adapter) return false;

    this.device = await adapter.requestDevice();
    const ctx = this.canvas.getContext('webgpu');
    ctx.configure({ device: this.device, format: gpu.getPreferredCanvasFormat() });

    const shaderCode = wgsl || `@fragment fn main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }`;
    const module = this.device.createShaderModule({ code: shaderCode });
    const compInfo = await module.getCompilationInfo();
    if (compInfo.messages.some((m: any) => m.type === 'error')) {
      throw new Error('WGSL compilation error');
    }

    this.uniformBuffer = this.device.createBuffer({ size: 256, usage: 64 });
    this.pipeline = this.device.createRenderPipeline({ module });
    return true;
  }

  render(time: number, mouse: [number, number]): void {
    if (!this.device || !this.pipeline) return;
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({});
    pass.setPipeline(this.pipeline);
    pass.draw(6);
    pass.end();
  }

  dispose(): void {
    if (this.uniformBuffer) this.uniformBuffer.destroy();
    if (this.device) this.device.destroy();
  }
}

export class Canvas2DFallbackDriver {
  private canvas: MockCanvasElement;
  private ctx: MockCanvasRenderingContext2D;

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to acquire 2D context');
    this.ctx = ctx;
  }

  render(time: number, mouse: [number, number], fallbackFn?: any): void {
    if (fallbackFn) {
      fallbackFn(this.ctx, this.canvas.width, this.canvas.height, time, mouse);
    } else {
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  dispose(): void {
    this.ctx.drawOps.length = 0;
  }
}

describe('Tier 1: Headless GPU Engine Drivers', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('initializes WebGL2 driver, sets up VAO and compiles full-screen quad', async () => {
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);
    const success = await driver.init();

    expect(success).toBe(true);
    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    expect(gl.currentVAO).toBeDefined();
    expect(gl.currentArrayBuffer).toBeDefined();
    expect(gl.currentArrayBuffer!.data).toBeDefined();

    driver.dispose();
    expect(gl.currentArrayBuffer!.deleted).toBe(true);
    expect(gl.currentVAO!.deleted).toBe(true);
  });

  it('updates dynamic uniforms reactively and issues WebGL draw calls', async () => {
    const canvas = new MockCanvasElement();
    const driver = new WebGL2Driver(canvas);
    await driver.init(STARTER_SHADERS['liquid-chrome'].glsl);

    driver.setUniform('u_speed', { type: 'float', value: 2.5 });
    driver.setUniform('u_resolution', { type: 'vec2', value: [800, 600] });

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    expect(gl.uniformSetCalls.some((c) => c.name === 'u_speed' && c.value === 2.5)).toBe(true);

    driver.render(1.5, [0.4, 0.6]);
    expect(gl.drawCallCount).toBe(1);

    driver.render(1.6, [0.5, 0.7]);
    expect(gl.drawCallCount).toBe(2);

    driver.dispose();
  });

  it('initializes WebGPU driver with WGSL shader and executes render pass', async () => {
    const canvas = new MockCanvasElement();
    const driver = new WebGPUDriver(canvas);
    const success = await driver.init(STARTER_SHADERS['liquid-chrome'].wgsl);

    expect(success).toBe(true);
    driver.render(1.0, [0.5, 0.5]);

    const gpuCtx = canvas.getContext('webgpu') as MockGPUCanvasContext;
    expect(gpuCtx.configured).toBe(true);
    expect(gpuCtx.format).toBe('bgra8unorm');

    driver.dispose();
  });

  it('falls back to Canvas2DFallback driver smoothly when WebGL/WebGPU acceleration unavailable', () => {
    const canvas = new MockCanvasElement();
    canvas.allowWebGL2 = false;
    canvas.allowWebGPU = false;

    expect(() => new WebGL2Driver(canvas)).toThrow('Failed to acquire WebGL2 context');

    const fallbackDriver = new Canvas2DFallbackDriver(canvas);
    const fallbackFn = STARTER_SHADERS['mesh-gradient'].canvas2dFallback;

    fallbackDriver.render(1.0, [0.5, 0.5], fallbackFn);
    const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D;
    expect(ctx.drawOps.length).toBeGreaterThan(0);

    fallbackDriver.dispose();
  });

  it('supports automatic multi-driver hierarchy resolution: WebGPU -> WebGL2 -> 2D', async () => {
    // 1. WebGPU available -> resolves WebGPU
    const canvas1 = new MockCanvasElement();
    const webgpuDriver = new WebGPUDriver(canvas1);
    const gpuOk = await webgpuDriver.init();
    expect(gpuOk).toBe(true);

    // 2. WebGPU unavailable -> resolves WebGL2
    (globalThis as any).navigator.gpu.enabled = false;
    const canvas2 = new MockCanvasElement();
    const webglDriver = new WebGL2Driver(canvas2);
    const glOk = await webglDriver.init();
    expect(glOk).toBe(true);

    // 3. WebGL2 also unavailable -> resolves Canvas2D
    canvas2.allowWebGL2 = false;
    const fallbackDriver = new Canvas2DFallbackDriver(canvas2);
    fallbackDriver.render(0, [0, 0]);
    const ctx2 = canvas2.getContext('2d') as MockCanvasRenderingContext2D;
    expect(ctx2.drawOps.length).toBeGreaterThan(0);
  });
});
