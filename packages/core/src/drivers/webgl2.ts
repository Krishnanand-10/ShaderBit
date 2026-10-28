import type { IShaderDriver, ShaderUniformValue } from './types';

export class WebGL2Driver implements IShaderDriver {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  private uniformLocations = new Map<string, WebGLUniformLocation | null>();
  private uniforms = new Map<string, ShaderUniformValue>();

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.canvas = canvas;
  }

  async init(glsl?: string): Promise<boolean> {
    const ctx = this.canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!ctx) return false;
    this.gl = ctx;

    if (this.gl.isContextLost()) {
      return false;
    }

    const vsSource = `#version 300 es
layout(location = 0) in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

    const rawFs = glsl?.trim();
    if (glsl !== undefined && !rawFs) {
      throw new Error('Fragment shader compilation failed: empty shader source');
    }

    const fsSource =
      rawFs ||
      `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0);
}`;

    const vs = this.gl.createShader(this.gl.VERTEX_SHADER);
    if (!vs) return false;
    this.gl.shaderSource(vs, vsSource);
    this.gl.compileShader(vs);
    if (!this.gl.getShaderParameter(vs, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(vs);
      this.gl.deleteShader(vs);
      throw new Error(`Vertex shader compilation failed: ${info}`);
    }
    this.vertexShader = vs;

    const fs = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    if (!fs) {
      this.gl.deleteShader(vs);
      return false;
    }
    this.gl.shaderSource(fs, fsSource);
    this.gl.compileShader(fs);
    if (!this.gl.getShaderParameter(fs, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(fs);
      this.gl.deleteShader(vs);
      this.gl.deleteShader(fs);
      throw new Error(`Fragment shader compilation failed: ${info}`);
    }
    this.fragmentShader = fs;

    const prog = this.gl.createProgram();
    if (!prog) return false;
    this.gl.attachShader(prog, vs);
    this.gl.attachShader(prog, fs);
    this.gl.linkProgram(prog);
    if (!this.gl.getProgramParameter(prog, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(prog);
      this.gl.deleteProgram(prog);
      throw new Error(`Program link failed: ${info}`);
    }
    this.program = prog;

    // Full-screen quad [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);

    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    this.buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, quadVertices, this.gl.STATIC_DRAW);

    const posLoc = this.gl.getAttribLocation(prog, 'position');
    const safePosLoc = posLoc >= 0 ? posLoc : 0;
    this.gl.enableVertexAttribArray(safePosLoc);
    this.gl.vertexAttribPointer(safePosLoc, 2, this.gl.FLOAT, false, 0, 0);

    // Apply any cached uniforms
    this.gl.useProgram(this.program);
    for (const [name, val] of this.uniforms.entries()) {
      this.applyUniform(name, val);
    }

    return true;
  }

  resize(width: number, height: number, dpr: number): void {
    const safeDpr = dpr <= 0 || !isFinite(dpr) ? 1 : dpr;
    const safeW = Math.max(0, width);
    const safeH = Math.max(0, height);
    const bufferW = Math.round(safeW * safeDpr);
    const bufferH = Math.round(safeH * safeDpr);

    this.canvas.width = bufferW;
    this.canvas.height = bufferH;

    if (this.gl && !this.gl.isContextLost()) {
      this.gl.viewport(0, 0, bufferW, bufferH);
    }
  }

  private getUniformLocation(name: string): WebGLUniformLocation | null {
    if (!this.program || !this.gl) return null;
    let loc = this.uniformLocations.get(name);
    if (loc === undefined) {
      loc = this.gl.getUniformLocation(this.program, name);
      this.uniformLocations.set(name, loc);
    }
    return loc;
  }

  private applyUniform(name: string, value: ShaderUniformValue | any): void {
    if (!this.gl || !this.program || this.gl.isContextLost()) return;
    this.gl.useProgram(this.program);
    const loc = this.getUniformLocation(name);
    if (!loc) return;

    const val = value && typeof value === 'object' && 'value' in value ? value.value : value;
    const type = value && typeof value === 'object' && 'type' in value ? value.type : undefined;

    if (type === 'float' || (typeof val === 'number' && !Number.isInteger(val))) {
      this.gl.uniform1f(loc, val as number);
    } else if (type === 'int' || (typeof val === 'number' && Number.isInteger(val))) {
      this.gl.uniform1i(loc, val as number);
    } else if (type === 'vec2' || (Array.isArray(val) && val.length === 2)) {
      const v = val as [number, number];
      this.gl.uniform2f(loc, v[0], v[1]);
    } else if (type === 'vec3' || (Array.isArray(val) && val.length === 3)) {
      const v = val as [number, number, number];
      this.gl.uniform3f(loc, v[0], v[1], v[2]);
    } else if (type === 'vec4' || (Array.isArray(val) && val.length === 4)) {
      const v = val as [number, number, number, number];
      this.gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
    } else if (typeof val === 'number') {
      this.gl.uniform1f(loc, val);
    }
  }

  setUniform(name: string, value: ShaderUniformValue | any): void {
    this.uniforms.set(name, value);
    this.applyUniform(name, value);
  }

  render(time: number, mouse: [number, number]): void {
    if (!this.gl || !this.program || !this.vao || this.gl.isContextLost()) return;

    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);

    const w = this.canvas.width || 800;
    const h = this.canvas.height || 600;

    this.setUniform('u_time', { type: 'float', value: time });
    this.setUniform('u_mouse', { type: 'vec2', value: mouse });
    this.setUniform('u_resolution', { type: 'vec2', value: [w, h] });

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  dispose(): void {
    if (this.gl) {
      if (this.buffer) {
        this.gl.deleteBuffer(this.buffer);
        this.buffer = null;
      }
      if (this.vao) {
        this.gl.deleteVertexArray(this.vao);
        this.vao = null;
      }
      if (this.vertexShader) {
        this.gl.deleteShader(this.vertexShader);
        this.vertexShader = null;
      }
      if (this.fragmentShader) {
        this.gl.deleteShader(this.fragmentShader);
        this.fragmentShader = null;
      }
      if (this.program) {
        this.gl.deleteProgram(this.program);
        this.program = null;
      }
      this.uniformLocations.clear();
      this.gl = null;
    }
    if (this.canvas && '_activeContextType' in this.canvas) {
      (this.canvas as any)._activeContextType = null;
    }
    this.buffer = null;
    this.vao = null;
    this.vertexShader = null;
    this.fragmentShader = null;
    this.program = null;
  }

  get isContextLost(): boolean {
    return this.gl ? this.gl.isContextLost() : true;
  }
}
