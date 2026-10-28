/**
 * High-fidelity Mock WebGL2RenderingContext for headless Node.js testing.
 * Zero external dependencies.
 */

export interface MockUniformLocation {
  __name: string;
  __program: any;
}

export class MockWebGLShader {
  type: number;
  source = '';
  compiled = false;
  infoLog = '';
  deleted = false;

  constructor(type: number) {
    this.type = type;
  }
}

export class MockWebGLProgram {
  shaders: MockWebGLShader[] = [];
  linked = false;
  infoLog = '';
  deleted = false;
  uniforms: Map<string, any> = new Map();
}

export class MockWebGLBuffer {
  target = 0;
  data: ArrayBufferView | ArrayBuffer | null = null;
  usage = 0;
  deleted = false;
}

export class MockWebGLVertexArrayObject {
  bindings: Map<number, any> = new Map();
  deleted = false;
}

export class MockWebGL2RenderingContext {
  // WebGL Constants
  static readonly VERTEX_SHADER = 35633;
  static readonly FRAGMENT_SHADER = 35632;
  static readonly COMPILE_STATUS = 35713;
  static readonly LINK_STATUS = 35714;
  static readonly COLOR_BUFFER_BIT = 16384;
  static readonly DEPTH_BUFFER_BIT = 256;
  static readonly ARRAY_BUFFER = 34962;
  static readonly STATIC_DRAW = 35044;
  static readonly DYNAMIC_DRAW = 35048;
  static readonly FLOAT = 5126;
  static readonly INT = 5124;
  static readonly TRIANGLES = 4;
  static readonly TRIANGLE_STRIP = 5;

  readonly VERTEX_SHADER = MockWebGL2RenderingContext.VERTEX_SHADER;
  readonly FRAGMENT_SHADER = MockWebGL2RenderingContext.FRAGMENT_SHADER;
  readonly COMPILE_STATUS = MockWebGL2RenderingContext.COMPILE_STATUS;
  readonly LINK_STATUS = MockWebGL2RenderingContext.LINK_STATUS;
  readonly COLOR_BUFFER_BIT = MockWebGL2RenderingContext.COLOR_BUFFER_BIT;
  readonly DEPTH_BUFFER_BIT = MockWebGL2RenderingContext.DEPTH_BUFFER_BIT;
  readonly ARRAY_BUFFER = MockWebGL2RenderingContext.ARRAY_BUFFER;
  readonly STATIC_DRAW = MockWebGL2RenderingContext.STATIC_DRAW;
  readonly DYNAMIC_DRAW = MockWebGL2RenderingContext.DYNAMIC_DRAW;
  readonly FLOAT = MockWebGL2RenderingContext.FLOAT;
  readonly INT = MockWebGL2RenderingContext.INT;
  readonly TRIANGLES = MockWebGL2RenderingContext.TRIANGLES;
  readonly TRIANGLE_STRIP = MockWebGL2RenderingContext.TRIANGLE_STRIP;

  canvas: any;
  currentProgram: MockWebGLProgram | null = null;
  currentVAO: MockWebGLVertexArrayObject | null = null;
  currentArrayBuffer: MockWebGLBuffer | null = null;
  
  viewportState = { x: 0, y: 0, width: 0, height: 0 };
  clearColorState = [0, 0, 0, 0];
  
  drawCallCount = 0;
  uniformSetCalls: Array<{ name: string; value: any }> = [];
  contextLost = false;

  private loseContextExtension = {
    loseContext: () => {
      this.contextLost = true;
      if (this.canvas && typeof this.canvas.dispatchEvent === 'function') {
        const event = { type: 'webglcontextlost', preventDefault: () => {} };
        this.canvas.dispatchEvent(event);
      }
    },
    restoreContext: () => {
      this.contextLost = false;
      if (this.canvas && typeof this.canvas.dispatchEvent === 'function') {
        const event = { type: 'webglcontextrestored', preventDefault: () => {} };
        this.canvas.dispatchEvent(event);
      }
    }
  };

  constructor(canvas: any) {
    this.canvas = canvas;
  }

  isContextLost(): boolean {
    return this.contextLost;
  }

  getExtension(name: string): any {
    if (name === 'WEBGL_lose_context') {
      return this.loseContextExtension;
    }
    return null;
  }

  createShader(type: number): MockWebGLShader {
    return new MockWebGLShader(type);
  }

  shaderSource(shader: MockWebGLShader, source: string): void {
    shader.source = source;
  }

  compileShader(shader: MockWebGLShader): void {
    // If shader source contains explicit syntax errors or unsupported constructs
    if (
      shader.source.includes('SYNTAX_ERROR') ||
      shader.source.includes('INVALID_TOKEN') ||
      shader.source.includes('undefined_variable')
    ) {
      shader.compiled = false;
      shader.infoLog = 'ERROR: 0:1: syntax error: unexpected token';
    } else {
      shader.compiled = true;
      shader.infoLog = '';
    }
  }

  getShaderParameter(shader: MockWebGLShader, pname: number): any {
    if (pname === this.COMPILE_STATUS) {
      return shader.compiled;
    }
    return null;
  }

  getShaderInfoLog(shader: MockWebGLShader): string {
    return shader.infoLog;
  }

  createProgram(): MockWebGLProgram {
    return new MockWebGLProgram();
  }

  attachShader(program: MockWebGLProgram, shader: MockWebGLShader): void {
    program.shaders.push(shader);
  }

  linkProgram(program: MockWebGLProgram): void {
    const hasFailedShader = program.shaders.some((s) => !s.compiled);
    if (hasFailedShader) {
      program.linked = false;
      program.infoLog = 'Program link failed: one or more shaders failed to compile';
    } else {
      program.linked = true;
      program.infoLog = '';
    }
  }

  getProgramParameter(program: MockWebGLProgram, pname: number): any {
    if (pname === this.LINK_STATUS) {
      return program.linked;
    }
    return null;
  }

  getProgramInfoLog(program: MockWebGLProgram): string {
    return program.infoLog;
  }

  useProgram(program: MockWebGLProgram | null): void {
    this.currentProgram = program;
  }

  createVertexArray(): MockWebGLVertexArrayObject {
    return new MockWebGLVertexArrayObject();
  }

  bindVertexArray(vao: MockWebGLVertexArrayObject | null): void {
    this.currentVAO = vao;
  }

  createBuffer(): MockWebGLBuffer {
    return new MockWebGLBuffer();
  }

  bindBuffer(target: number, buffer: MockWebGLBuffer | null): void {
    if (target === this.ARRAY_BUFFER) {
      this.currentArrayBuffer = buffer;
      if (buffer) {
        buffer.target = target;
      }
    }
  }

  bufferData(target: number, data: ArrayBufferView | ArrayBuffer, usage: number): void {
    if (this.currentArrayBuffer) {
      this.currentArrayBuffer.data = data;
      this.currentArrayBuffer.usage = usage;
    }
  }

  enableVertexAttribArray(index: number): void {
    if (this.currentVAO) {
      this.currentVAO.bindings.set(index, { enabled: true });
    }
  }

  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number
  ): void {
    if (this.currentVAO) {
      this.currentVAO.bindings.set(index, { size, type, normalized, stride, offset, buffer: this.currentArrayBuffer });
    }
  }

  getUniformLocation(program: MockWebGLProgram, name: string): MockUniformLocation | null {
    if (!program) return null;
    return { __name: name, __program: program };
  }

  uniform1f(location: MockUniformLocation | null, v: number): void {
    if (!location) return;
    this.uniformSetCalls.push({ name: location.__name, value: v });
    location.__program.uniforms.set(location.__name, v);
  }

  uniform2f(location: MockUniformLocation | null, v0: number, v1: number): void {
    if (!location) return;
    this.uniformSetCalls.push({ name: location.__name, value: [v0, v1] });
    location.__program.uniforms.set(location.__name, [v0, v1]);
  }

  uniform3f(location: MockUniformLocation | null, v0: number, v1: number, v2: number): void {
    if (!location) return;
    this.uniformSetCalls.push({ name: location.__name, value: [v0, v1, v2] });
    location.__program.uniforms.set(location.__name, [v0, v1, v2]);
  }

  uniform4f(location: MockUniformLocation | null, v0: number, v1: number, v2: number, v3: number): void {
    if (!location) return;
    this.uniformSetCalls.push({ name: location.__name, value: [v0, v1, v2, v3] });
    location.__program.uniforms.set(location.__name, [v0, v1, v2, v3]);
  }

  uniform1i(location: MockUniformLocation | null, v: number): void {
    if (!location) return;
    this.uniformSetCalls.push({ name: location.__name, value: v });
    location.__program.uniforms.set(location.__name, v);
  }

  viewport(x: number, y: number, width: number, height: number): void {
    this.viewportState = { x, y, width, height };
  }

  clearColor(r: number, g: number, b: number, a: number): void {
    this.clearColorState = [r, g, b, a];
  }

  clear(mask: number): void {
    // clear canvas operation
  }

  drawArrays(mode: number, first: number, count: number): void {
    if (this.contextLost) {
      throw new Error('Cannot draw: WebGL context is lost');
    }
    this.drawCallCount++;
  }

  deleteShader(shader: MockWebGLShader): void {
    shader.deleted = true;
  }

  deleteProgram(program: MockWebGLProgram): void {
    program.deleted = true;
  }

  deleteBuffer(buffer: MockWebGLBuffer): void {
    buffer.deleted = true;
  }

  deleteVertexArray(vao: MockWebGLVertexArrayObject): void {
    vao.deleted = true;
  }
}
