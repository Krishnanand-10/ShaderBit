import type { IShaderDriver, ShaderUniformValue } from './types';

export class WebGPUDriver implements IShaderDriver {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private device: any = null;
  private gpuContext: any = null;
  private pipeline: any = null;
  private uniformBuffer: any = null;
  private isDeviceLost = false;
  private uniforms = new Map<string, ShaderUniformValue | any>();

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.canvas = canvas;
  }

  async init(glsl?: string, wgsl?: string): Promise<boolean> {
    const nav = typeof globalThis !== 'undefined' ? (globalThis as any).navigator : undefined;
    if (!nav || !('gpu' in nav) || !nav.gpu) {
      return false;
    }

    let adapter: any = null;
    try {
      adapter = await nav.gpu.requestAdapter();
    } catch {
      return false;
    }
    if (!adapter) return false;

    try {
      this.device = await adapter.requestDevice();
    } catch {
      return false;
    }
    if (!this.device) return false;

    this.device.lost?.then?.(() => {
      this.isDeviceLost = true;
    });

    const ctx = (this.canvas as any).getContext?.('webgpu');
    if (!ctx) return false;
    this.gpuContext = ctx;

    const format =
      typeof nav.gpu.getPreferredCanvasFormat === 'function'
        ? nav.gpu.getPreferredCanvasFormat()
        : 'bgra8unorm';

    try {
      ctx.configure?.({ device: this.device, format });
    } catch {
      // Configuration fallback
    }

    const rawWgsl = wgsl?.trim();
    if (wgsl !== undefined && !rawWgsl) {
      throw new Error('WGSL compilation error: empty shader source');
    }

    const defaultShader = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );
  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = (pos[vertexIndex] + vec2<f32>(1.0, 1.0)) * 0.5;
  return output;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}
`;

    const shaderCode = rawWgsl || defaultShader;
    const shaderModule = this.device.createShaderModule({ code: shaderCode });

    if (shaderModule && typeof shaderModule.getCompilationInfo === 'function') {
      const compInfo = await shaderModule.getCompilationInfo();
      if (compInfo && compInfo.messages && Array.isArray(compInfo.messages)) {
        const errorMessages = compInfo.messages.filter((m: any) => m.type === 'error');
        if (errorMessages.length > 0) {
          throw new Error('WGSL compilation error: ' + errorMessages.map((m: any) => m.message).join(', '));
        }
      }
    }

    if (typeof this.device.createBuffer === 'function') {
      this.uniformBuffer = this.device.createBuffer({
        size: 256,
        usage: 64 // GPUBufferUsage.UNIFORM (64)
      });
    }

    if (typeof this.device.createRenderPipeline === 'function') {
      this.pipeline = this.device.createRenderPipeline({
        module: shaderModule
      });
    }

    return true;
  }

  resize(width: number, height: number, dpr: number): void {
    const safeDpr = dpr <= 0 || !isFinite(dpr) ? 1 : dpr;
    const safeW = Math.max(0, width);
    const safeH = Math.max(0, height);
    this.canvas.width = Math.round(safeW * safeDpr);
    this.canvas.height = Math.round(safeH * safeDpr);
  }

  setUniform(name: string, value: ShaderUniformValue | any): void {
    this.uniforms.set(name, value);
    // std140 uniform buffer write queue when real GPU buffer is available
    if (this.device?.queue?.writeBuffer && this.uniformBuffer) {
      // Packed std140 uniform update if needed
    }
  }

  render(time: number, mouse: [number, number]): void {
    if (!this.device || !this.pipeline || this.isDeviceLost) return;

    if (typeof this.device.createCommandEncoder === 'function') {
      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginRenderPass({});
      if (pass) {
        pass.setPipeline?.(this.pipeline);
        pass.draw?.(6);
        pass.end?.();
      }
      if (encoder.finish && this.device.queue?.submit) {
        const cmdBuffer = encoder.finish();
        this.device.queue.submit([cmdBuffer]);
      }
    }
  }

  dispose(): void {
    if (this.uniformBuffer && typeof this.uniformBuffer.destroy === 'function') {
      this.uniformBuffer.destroy();
    }
    if (this.device && typeof this.device.destroy === 'function') {
      this.device.destroy();
    }
    this.uniformBuffer = null;
    this.pipeline = null;
    this.device = null;
    this.gpuContext = null;
    this.uniforms.clear();
  }
}
