import type { UniformType, ShaderUniformValue, UniformPrimitiveValue } from '@shaderbit/core';

export type { UniformType, ShaderUniformValue, UniformPrimitiveValue };

export type Canvas2DFallbackFn = (
  ctx: CanvasRenderingContext2D | any,
  width: number,
  height: number,
  time: number,
  mouse: [number, number]
) => void;

export interface UniformDescriptor {
  name: string;
  type: UniformType;
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface ShaderComponent {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags: string[];
  glsl: string;
  wgsl: string;
  canvas2dFallback?: Canvas2DFallbackFn;
  uniforms: UniformDescriptor[];
  dependencies?: Record<string, string>;
}

export const STANDARD_UNIFORMS = ['u_resolution', 'u_time', 'u_mouse', 'u_dpr'] as const;
export type StandardUniformName = (typeof STANDARD_UNIFORMS)[number];

export function isStandardUniform(name: string): boolean {
  return (STANDARD_UNIFORMS as readonly string[]).includes(name);
}

/**
 * Converts a hex color string (#RGB, #RRGGBB) to a normalized vec3 [r, g, b] in [0, 1].
 */
export function hexToVec3(hex: string): [number, number, number] {
  if (typeof hex !== 'string') return [0, 0, 0];
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return [0, 0, 0];
    }
    return [parseFloat(r.toFixed(4)), parseFloat(g.toFixed(4)), parseFloat(b.toFixed(4))];
  }
  return [0, 0, 0];
}

/**
 * Converts a hex color string (#RGB, #RRGGBB, #RRGGBBAA) to a normalized vec4 [r, g, b, a] in [0, 1].
 */
export function hexToVec4(hex: string): [number, number, number, number] {
  if (typeof hex !== 'string') return [0, 0, 0, 1];
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('') + 'ff';
  } else if (clean.length === 6) {
    clean += 'ff';
  }
  if (clean.length === 8) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const a = parseInt(clean.substring(6, 8), 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) {
      return [0, 0, 0, 1];
    }
    return [
      parseFloat(r.toFixed(4)),
      parseFloat(g.toFixed(4)),
      parseFloat(b.toFixed(4)),
      parseFloat(a.toFixed(4))
    ];
  }
  return [0, 0, 0, 1];
}

/**
 * Normalizes a uniform value or hex color string into a ShaderUniformValue.
 */
export function toShaderUniformValue(desc: UniformDescriptor, rawValue?: any): ShaderUniformValue {
  const val = rawValue !== undefined ? rawValue : desc.defaultValue;

  if (typeof val === 'string' && val.startsWith('#')) {
    if (desc.type === 'vec3') {
      return { type: 'vec3', value: hexToVec3(val) };
    }
    if (desc.type === 'vec4') {
      return { type: 'vec4', value: hexToVec4(val) };
    }
  }

  return {
    type: desc.type,
    value: val
  };
}

/**
 * Creates a map of ShaderUniformValue records from component uniform descriptors and optional overrides.
 */
export function createUniformMap(
  descriptors: UniformDescriptor[],
  overrides?: Record<string, any>
): Record<string, ShaderUniformValue> {
  const result: Record<string, ShaderUniformValue> = {};
  for (const desc of descriptors) {
    const raw = overrides && overrides[desc.name] !== undefined ? overrides[desc.name] : desc.defaultValue;
    result[desc.name] = toShaderUniformValue(desc, raw);
  }
  return result;
}

/**
 * Extracts a dictionary of default uniform values from a ShaderComponent.
 */
export function getUniformDefaults(component: ShaderComponent): Record<string, any> {
  const defaults: Record<string, any> = {};
  if (component && Array.isArray(component.uniforms)) {
    for (const u of component.uniforms) {
      defaults[u.name] = u.defaultValue;
    }
  }
  return defaults;
}

/**
 * Lightweight uniform tracking manager with dirty-checking cache.
 */
export class UniformManager {
  private values: Map<string, any> = new Map();
  private dirtyKeys: Set<string> = new Set();

  setUniform(name: string, value: any): boolean {
    const prev = this.values.get(name);
    if (JSON.stringify(prev) === JSON.stringify(value)) {
      return false; // Skip redundant updates
    }
    this.values.set(name, value);
    this.dirtyKeys.add(name);
    return true;
  }

  getUniform(name: string): any {
    return this.values.get(name);
  }

  hasUniform(name: string): boolean {
    return this.values.has(name);
  }

  flushDirty(): string[] {
    const list = Array.from(this.dirtyKeys);
    this.dirtyKeys.clear();
    return list;
  }

  clear(): void {
    this.values.clear();
    this.dirtyKeys.clear();
  }

  bindSystemUniforms(width: number, height: number, time: number, mouse: [number, number], dpr: number): void {
    this.setUniform('u_resolution', [width, height]);
    this.setUniform('u_time', time);
    this.setUniform('u_mouse', mouse);
    this.setUniform('u_dpr', dpr);
  }
}
