import { vi } from 'vitest';

export interface MockShaderHandle {
  id: number;
  type: number;
  source: string;
  compiled: boolean;
  infoLog: string;
  deleted: boolean;
}

export interface MockProgramHandle {
  id: number;
  shaders: MockShaderHandle[];
  linked: boolean;
  infoLog: string;
  deleted: boolean;
  uniformLocations: Map<string, MockUniformLocationHandle>;
  attribLocations?: Map<string, number>;
}

export interface MockBufferHandle {
  id: number;
  target: number | null;
  data: BufferSource | null;
  usage: number | null;
  deleted: boolean;
}

export interface MockVAOHandle {
  id: number;
  boundBuffers: Map<number, MockBufferHandle>;
  attribPointers: Map<number, any>;
  enabledAttribs: Set<number>;
  deleted: boolean;
}

export interface MockUniformLocationHandle {
  id: number;
  name: string;
  value: any;
}

export class MockWebGL2RenderingContext {
  // WebGL Constants
  readonly VERTEX_SHADER = 0x8b31;
  readonly FRAGMENT_SHADER = 0x8b30;
  readonly COMPILE_STATUS = 0x8b81;
  readonly LINK_STATUS = 0x8b82;
  readonly ARRAY_BUFFER = 0x8892;
  readonly ELEMENT_ARRAY_BUFFER = 0x8893;
  readonly STATIC_DRAW = 0x88e4;
  readonly DYNAMIC_DRAW = 0x88e8;
  readonly FLOAT = 0x1406;
  readonly INT = 0x1404;
  readonly BOOL = 0x8b56;
  readonly TRIANGLES = 0x0004;
  readonly TRIANGLE_STRIP = 0x0005;
  readonly COLOR_BUFFER_BIT = 0x00004000;
  readonly DEPTH_BUFFER_BIT = 0x00000100;
  readonly STENCIL_BUFFER_BIT = 0x00000400;

  public canvas: any;
  private _nextId = 1;
  private _isContextLost = false;
  private _attribLocations = new Map<string, number>();

  // Active State Tracking
  public currentProgram: MockProgramHandle | null = null;
  public currentVAO: MockVAOHandle | null = null;
  public currentArrayBuffer: MockBufferHandle | null = null;
  public currentViewport: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 };
  public currentClearColor: [number, number, number, number] = [0, 0, 0, 0];

  // Resource Repositories
  public shaders = new Map<number, MockShaderHandle>();
  public programs = new Map<number, MockProgramHandle>();
  public buffers = new Map<number, MockBufferHandle>();
  public vaos = new Map<number, MockVAOHandle>();

  // Metrics & Spies
  public drawCalls: Array<{ mode: number; first: number; count: number }> = [];
  public uniformHistory = new Map<string, any[]>();
  public calls: Array<{ method: string; args: any[] }> = [];

  // Fault Injection
  public failNextShaderCompile: string | null = null;
  public failNextProgramLink: string | null = null;

  constructor(canvas: any) {
    this.canvas = canvas;
  }

  // --- Shader Operations ---
  createShader = vi.fn((type: number): MockShaderHandle => {
    const handle: MockShaderHandle = {
      id: this._nextId++,
      type,
      source: '',
      compiled: false,
      infoLog: '',
      deleted: false,
    };
    this.shaders.set(handle.id, handle);
    return handle;
  });

  shaderSource = vi.fn((shader: MockShaderHandle, source: string): void => {
    shader.source = source;
  });

  compileShader = vi.fn((shader: MockShaderHandle): void => {
    if (this.failNextShaderCompile) {
      shader.compiled = false;
      shader.infoLog = this.failNextShaderCompile;
      this.failNextShaderCompile = null;
    } else if (shader.source && !shader.source.includes('main')) {
      shader.compiled = false;
      shader.infoLog = 'ERROR: 0:1: syntax error, missing main';
    } else {
      shader.compiled = true;
      shader.infoLog = '';
    }
  });

  getShaderParameter = vi.fn((shader: MockShaderHandle, pname: number): any => {
    if (pname === this.COMPILE_STATUS) return shader.compiled;
    return true;
  });

  getShaderInfoLog = vi.fn((shader: MockShaderHandle): string => shader.infoLog);

  deleteShader = vi.fn((shader: MockShaderHandle): void => {
    shader.deleted = true;
  });

  // --- Program Operations ---
  createProgram = vi.fn((): MockProgramHandle => {
    const handle: MockProgramHandle = {
      id: this._nextId++,
      shaders: [],
      linked: false,
      infoLog: '',
      deleted: false,
      uniformLocations: new Map(),
    };
    this.programs.set(handle.id, handle);
    return handle;
  });

  attachShader = vi.fn((program: MockProgramHandle, shader: MockShaderHandle): void => {
    program.shaders.push(shader);
  });

  linkProgram = vi.fn((program: MockProgramHandle): void => {
    if (this.failNextProgramLink) {
      program.linked = false;
      program.infoLog = this.failNextProgramLink;
      this.failNextProgramLink = null;
    } else {
      program.linked = true;
      program.infoLog = '';
    }
  });

  getProgramParameter = vi.fn((program: MockProgramHandle, pname: number): any => {
    if (pname === this.LINK_STATUS) return program.linked;
    return true;
  });

  getProgramInfoLog = vi.fn((program: MockProgramHandle): string => program.infoLog);

  useProgram = vi.fn((program: MockProgramHandle | null): void => {
    this.currentProgram = program;
  });

  deleteProgram = vi.fn((program: MockProgramHandle): void => {
    program.deleted = true;
    if (this.currentProgram === program) this.currentProgram = null;
  });

  // --- Vertex Array Objects (VAO) ---
  createVertexArray = vi.fn((): MockVAOHandle => {
    const vao: MockVAOHandle = {
      id: this._nextId++,
      boundBuffers: new Map(),
      attribPointers: new Map(),
      enabledAttribs: new Set(),
      deleted: false,
    };
    this.vaos.set(vao.id, vao);
    return vao;
  });

  bindVertexArray = vi.fn((vao: MockVAOHandle | null): void => {
    this.currentVAO = vao;
  });

  deleteVertexArray = vi.fn((vao: MockVAOHandle): void => {
    vao.deleted = true;
    if (this.currentVAO === vao) this.currentVAO = null;
  });

  // --- Buffers ---
  createBuffer = vi.fn((): MockBufferHandle => {
    const buf: MockBufferHandle = {
      id: this._nextId++,
      target: null,
      data: null,
      usage: null,
      deleted: false,
    };
    this.buffers.set(buf.id, buf);
    return buf;
  });

  bindBuffer = vi.fn((target: number, buffer: MockBufferHandle | null): void => {
    if (target === this.ARRAY_BUFFER) {
      this.currentArrayBuffer = buffer;
      if (buffer) buffer.target = target;
    }
  });

  bufferData = vi.fn((target: number, data: BufferSource | number, usage: number): void => {
    if (this.currentArrayBuffer) {
      this.currentArrayBuffer.data = data as BufferSource;
      this.currentArrayBuffer.usage = usage;
    }
  });

  deleteBuffer = vi.fn((buffer: MockBufferHandle): void => {
    buffer.deleted = true;
    if (this.currentArrayBuffer === buffer) this.currentArrayBuffer = null;
  });

  // --- Vertex Attributes ---
  getAttribLocation = vi.fn((program: MockProgramHandle, name: string): number => {
    if (!program) return -1;
    const key = `${program.id}:${name}`;
    if (!this._attribLocations.has(key)) {
      this._attribLocations.set(key, this._attribLocations.size);
    }
    return this._attribLocations.get(key)!;
  });

  enableVertexAttribArray = vi.fn((index: number): void => {
    if (this.currentVAO) {
      this.currentVAO.enabledAttribs.add(index);
    }
  });

  vertexAttribPointer = vi.fn((index: number, size: number, type: number, normalized: boolean, stride: number, offset: number): void => {
    if (this.currentVAO) {
      this.currentVAO.attribPointers.set(index, { size, type, normalized, stride, offset });
    }
  });

  // --- Uniforms ---
  getUniformLocation = vi.fn((program: MockProgramHandle, name: string): MockUniformLocationHandle | null => {
    if (!program.uniformLocations.has(name)) {
      const loc: MockUniformLocationHandle = {
        id: this._nextId++,
        name,
        value: null,
      };
      program.uniformLocations.set(name, loc);
    }
    return program.uniformLocations.get(name)!;
  });

  private _recordUniform(loc: MockUniformLocationHandle, val: any) {
    loc.value = val;
    if (!this.uniformHistory.has(loc.name)) {
      this.uniformHistory.set(loc.name, []);
    }
    this.uniformHistory.get(loc.name)!.push(val);
  }

  uniform1f = vi.fn((loc: MockUniformLocationHandle | null, x: number): void => {
    if (loc) this._recordUniform(loc, x);
  });

  uniform2f = vi.fn((loc: MockUniformLocationHandle | null, x: number, y: number): void => {
    if (loc) this._recordUniform(loc, [x, y]);
  });

  uniform3f = vi.fn((loc: MockUniformLocationHandle | null, x: number, y: number, z: number): void => {
    if (loc) this._recordUniform(loc, [x, y, z]);
  });

  uniform4f = vi.fn((loc: MockUniformLocationHandle | null, x: number, y: number, z: number, w: number): void => {
    if (loc) this._recordUniform(loc, [x, y, z, w]);
  });

  uniform1i = vi.fn((loc: MockUniformLocationHandle | null, x: number): void => {
    if (loc) this._recordUniform(loc, x);
  });

  uniform1iv = vi.fn((loc: MockUniformLocationHandle | null, v: Int32List | number[]): void => {
    if (loc) this._recordUniform(loc, Array.from(v as any));
  });

  uniform1fv = vi.fn((loc: MockUniformLocationHandle | null, v: Float32List | number[]): void => {
    if (loc) this._recordUniform(loc, Array.from(v as any));
  });

  uniform2fv = vi.fn((loc: MockUniformLocationHandle | null, v: Float32List | number[]): void => {
    if (loc) this._recordUniform(loc, Array.from(v as any));
  });

  uniform3fv = vi.fn((loc: MockUniformLocationHandle | null, v: Float32List | number[]): void => {
    if (loc) this._recordUniform(loc, Array.from(v as any));
  });

  uniform4fv = vi.fn((loc: MockUniformLocationHandle | null, v: Float32List | number[]): void => {
    if (loc) this._recordUniform(loc, Array.from(v as any));
  });

  // --- Viewport & Clear ---
  viewport = vi.fn((x: number, y: number, width: number, height: number): void => {
    this.currentViewport = { x, y, width, height };
  });

  clearColor = vi.fn((r: number, g: number, b: number, a: number): void => {
    this.currentClearColor = [r, g, b, a];
  });

  clear = vi.fn((mask: number): void => {
    this.calls.push({ method: 'clear', args: [mask] });
  });

  // --- Drawing ---
  drawArrays = vi.fn((mode: number, first: number, count: number): void => {
    this.drawCalls.push({ mode, first, count });
  });

  getExtension = vi.fn((name: string): any => {
    if (name === 'WEBGL_lose_context') {
      return {
        loseContext: () => this.triggerContextLost(),
        restoreContext: () => this.triggerContextRestored(),
      };
    }
    return null;
  });

  // --- Test Assertion Helpers ---
  getUniformValue(name: string): any {
    if (this.currentProgram && this.currentProgram.uniformLocations.has(name)) {
      return this.currentProgram.uniformLocations.get(name)!.value;
    }
    return undefined;
  }

  getDrawCalls() {
    return [...this.drawCalls];
  }

  isDeleted(resource: any): boolean {
    return resource && resource.deleted === true;
  }

  resetSpies() {
    this.drawCalls = [];
    this.uniformHistory.clear();
    this.calls = [];
    this._isContextLost = false;
    this._attribLocations.clear();
  }

  isContextLost = vi.fn((): boolean => this._isContextLost);

  triggerContextLost() {
    this._isContextLost = true;
    const event = new Event('webglcontextlost', { cancelable: true });
    this.canvas.dispatchEvent(event);
  }

  triggerContextLoss() {
    this.triggerContextLost();
  }

  triggerContextRestored() {
    this._isContextLost = false;
    const event = new Event('webglcontextrestored');
    this.canvas.dispatchEvent(event);
  }

  triggerContextRestoration() {
    this.triggerContextRestored();
  }
}

export function createMockWebGL2Context(canvas: any): MockWebGL2RenderingContext {
  return new MockWebGL2RenderingContext(canvas);
}
