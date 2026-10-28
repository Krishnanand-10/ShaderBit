import { vi } from 'vitest';

export class MockGPUBuffer {
  size: number;
  usage: number;
  data: ArrayBuffer | null = null;
  destroyed = false;

  constructor(descriptor: { size: number; usage: number }) {
    this.size = descriptor.size;
    this.usage = descriptor.usage;
  }

  destroy() {
    this.destroyed = true;
  }
}

export class MockGPURenderPassEncoder {
  pipeline: any = null;
  bindGroups = new Map<number, any>();
  drawCalls: Array<{ vertexCount: number; instanceCount: number }> = [];

  setPipeline = vi.fn((p: any) => { this.pipeline = p; });
  setBindGroup = vi.fn((index: number, bg: any) => { this.bindGroups.set(index, bg); });
  draw = vi.fn((vertexCount: number, instanceCount = 1) => {
    this.drawCalls.push({ vertexCount, instanceCount });
  });
  end = vi.fn();
}

export class MockGPUCommandEncoder {
  renderPass = new MockGPURenderPassEncoder();

  beginRenderPass = vi.fn((desc: any) => this.renderPass);
  finish = vi.fn(() => ({ type: 'GPUCommandBuffer' }));
}

export class MockGPUDevice {
  queue = {
    writeBuffer: vi.fn((buffer: MockGPUBuffer, bufferOffset: number, data: BufferSource) => {
      buffer.data = (data as any).buffer ? (data as any).buffer : (data as ArrayBuffer);
    }),
    submit: vi.fn(),
  };

  createShaderModule = vi.fn((desc: { code: string }) => ({
    code: desc.code,
    getCompilationInfo: vi.fn(async () => ({ messages: [] })),
  }));

  createBuffer = vi.fn((desc: { size: number; usage: number }) => new MockGPUBuffer(desc));

  createRenderPipeline = vi.fn((desc: any) => ({ layout: desc.layout, descriptor: desc }));

  createBindGroupLayout = vi.fn((desc: any) => ({ desc }));
  createPipelineLayout = vi.fn((desc: any) => ({ desc }));
  createBindGroup = vi.fn((desc: any) => ({ desc }));

  createCommandEncoder = vi.fn((desc?: any) => new MockGPUCommandEncoder());
  destroy = vi.fn();
}

export class MockGPUCanvasContext {
  canvas: any;
  device: MockGPUDevice | null = null;
  format: string | null = null;

  constructor(canvas: any) {
    this.canvas = canvas;
  }

  configure = vi.fn((desc: { device: MockGPUDevice; format: string }) => {
    this.device = desc.device;
    this.format = desc.format;
  });

  getCurrentTexture = vi.fn(() => ({
    createView: vi.fn(() => ({ type: 'GPUTextureView' })),
  }));
}

export class MockGPUAdapter {
  requestDevice = vi.fn(async (desc?: any) => new MockGPUDevice());
}

export class MockNavigatorGPU {
  public isSupported: boolean = true;
  public preferredFormat: string = 'bgra8unorm';

  requestAdapter = vi.fn(async (options?: any) => {
    if (!this.isSupported) return null;
    return new MockGPUAdapter();
  });

  getPreferredCanvasFormat = vi.fn(() => this.preferredFormat);
}

export function createMockGPUContext(canvas: any): MockGPUCanvasContext {
  return new MockGPUCanvasContext(canvas);
}
