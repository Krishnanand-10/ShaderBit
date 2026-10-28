export type UniformType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'int';

export type UniformPrimitiveValue =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number];

export interface ShaderUniformValue {
  type: UniformType;
  value: UniformPrimitiveValue;
}

export type DriverType = 'auto' | 'webgpu' | 'webgl2' | 'canvas2d';

export interface IShaderDriver {
  init(glsl?: string, wgsl?: string): Promise<boolean> | boolean;
  resize(width: number, height: number, dpr: number): void;
  setUniform(name: string, value: ShaderUniformValue): void;
  render(time: number, mouse: [number, number]): void;
  dispose(): void;
}
