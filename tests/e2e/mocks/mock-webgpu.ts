/**
 * High-fidelity Mock WebGPU Environment for headless testing.
 * Supports configurable availability and failure simulation for testing fallback hierarchy.
 */

export class MockGPUShaderModule {
  code: string;
  hasError = false;

  constructor(code: string) {
    this.code = code;
    if (code.includes('SYNTAX_ERROR') || code.includes('INVALID_WGSL')) {
      this.hasError = true;
    }
  }

  async getCompilationInfo(): Promise<{ messages: Array<{ type: string; message: string; lineNum: number }> }> {
    if (this.hasError) {
      return {
        messages: [{ type: 'error', message: 'WGSL syntax error at line 1', lineNum: 1 }]
      };
    }
    return { messages: [] };
  }
}

export class MockGPUBuffer {
  size: number;
  usage: number;
  data: Uint8Array;
  destroyed = false;

  constructor(size: number, usage: number) {
    this.size = size;
    this.usage = usage;
    this.data = new Uint8Array(size);
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export class MockGPUBindGroup {
  layout: any;
  entries: any[];

  constructor(desc: any) {
    this.layout = desc.layout;
    this.entries = desc.entries || [];
  }
}

export class MockGPURenderPipeline {
  desc: any;
  constructor(desc: any) {
    this.desc = desc;
  }
}

export class MockGPUQueue {
  writeBufferCalls: Array<{ buffer: MockGPUBuffer; bufferOffset: number; data: any }> = [];

  writeBuffer(buffer: MockGPUBuffer, bufferOffset: number, data: ArrayBufferView | ArrayBuffer): void {
    this.writeBufferCalls.push({ buffer, bufferOffset, data });
  }
}

export class MockGPUCommandEncoder {
  commands: string[] = [];

  beginRenderPass(desc: any): any {
    this.commands.push('beginRenderPass');
    return {
      setPipeline: (pipeline: any) => this.commands.push('setPipeline'),
      setBindGroup: (index: number, bindGroup: any) => this.commands.push(`setBindGroup(${index})`),
      draw: (vertexCount: number) => this.commands.push(`draw(${vertexCount})`),
      end: () => this.commands.push('end')
    };
  }

  finish(): any {
    this.commands.push('finish');
    return {};
  }
}

export class MockGPUDevice {
  queue: MockGPUQueue = new MockGPUQueue();
  destroyed = false;

  createShaderModule(desc: { code: string }): MockGPUShaderModule {
    return new MockGPUShaderModule(desc.code);
  }

  createBuffer(desc: { size: number; usage: number }): MockGPUBuffer {
    return new MockGPUBuffer(desc.size, desc.usage);
  }

  createBindGroup(desc: any): MockGPUBindGroup {
    return new MockGPUBindGroup(desc);
  }

  createRenderPipeline(desc: any): MockGPURenderPipeline {
    return new MockGPURenderPipeline(desc);
  }

  createCommandEncoder(): MockGPUCommandEncoder {
    return new MockGPUCommandEncoder();
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export class MockGPUAdapter {
  device: MockGPUDevice;

  constructor() {
    this.device = new MockGPUDevice();
  }

  async requestDevice(): Promise<MockGPUDevice> {
    return this.device;
  }
}

export class MockGPUCanvasContext {
  canvas: any;
  configured = false;
  format = '';

  constructor(canvas: any) {
    this.canvas = canvas;
  }

  configure(config: { device: any; format: string }): void {
    this.configured = true;
    this.format = config.format;
  }

  getCurrentTexture(): { createView: () => any } {
    return {
      createView: () => ({})
    };
  }
}

export class MockGPUProvider {
  enabled = true;
  adapter: MockGPUAdapter | null = new MockGPUAdapter();

  async requestAdapter(options?: any): Promise<MockGPUAdapter | null> {
    if (!this.enabled) return null;
    return this.adapter;
  }

  getPreferredCanvasFormat(): string {
    return 'bgra8unorm';
  }
}
