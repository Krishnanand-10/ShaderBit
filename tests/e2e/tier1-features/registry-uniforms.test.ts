/**
 * Tier 1 Feature Test: Dynamic Uniform Parameter Updates
 * Tests standard uniforms (resolution, time, mouse, dpr), custom uniforms, hex-to-vec conversion, and caching.
 */

import { describe, it, expect } from '../harness/test-kit.ts';

export function hexToVec3(hex: string): [number, number, number] {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return [parseFloat(r.toFixed(4)), parseFloat(g.toFixed(4)), parseFloat(b.toFixed(4))];
  }
  return [0, 0, 0];
}

export function hexToVec4(hex: string): [number, number, number, number] {
  let clean = hex.replace('#', '');
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
    return [
      parseFloat(r.toFixed(4)),
      parseFloat(g.toFixed(4)),
      parseFloat(b.toFixed(4)),
      parseFloat(a.toFixed(4))
    ];
  }
  return [0, 0, 0, 1];
}

export class UniformManager {
  private values: Map<string, any> = new Map();
  private dirtyKeys: Set<string> = new Set();

  setUniform(name: string, value: any): boolean {
    const prev = this.values.get(name);
    if (JSON.stringify(prev) === JSON.stringify(value)) {
      return false; // No change, skip upload (caching)
    }
    this.values.set(name, value);
    this.dirtyKeys.add(name);
    return true;
  }

  getUniform(name: string): any {
    return this.values.get(name);
  }

  flushDirty(): string[] {
    const list = Array.from(this.dirtyKeys);
    this.dirtyKeys.clear();
    return list;
  }

  bindSystemUniforms(width: number, height: number, time: number, mouse: [number, number], dpr: number): void {
    this.setUniform('u_resolution', [width, height]);
    this.setUniform('u_time', time);
    this.setUniform('u_mouse', mouse);
    this.setUniform('u_dpr', dpr);
  }
}

describe('Tier 1: Dynamic Uniform Parameter Updates', () => {
  it('automatically binds standard system uniforms (u_resolution, u_time, u_mouse, u_dpr)', () => {
    const mgr = new UniformManager();
    mgr.bindSystemUniforms(1920, 1080, 12.34, [0.3, 0.7], 2.0);

    expect(mgr.getUniform('u_resolution')).toEqual([1920, 1080]);
    expect(mgr.getUniform('u_time')).toBe(12.34);
    expect(mgr.getUniform('u_mouse')).toEqual([0.3, 0.7]);
    expect(mgr.getUniform('u_dpr')).toBe(2.0);
  });

  it('handles custom float and integer uniform updates', () => {
    const mgr = new UniformManager();
    mgr.setUniform('u_speed', 1.5);
    mgr.setUniform('u_iterations', 8);

    expect(mgr.getUniform('u_speed')).toBe(1.5);
    expect(mgr.getUniform('u_iterations')).toBe(8);
  });

  it('handles vec2, vec3, and vec4 vector uniform updates', () => {
    const mgr = new UniformManager();
    mgr.setUniform('u_dir', [1.0, -1.0]);
    mgr.setUniform('u_baseColor', [0.8, 0.2, 0.5]);
    mgr.setUniform('u_tint', [1.0, 1.0, 1.0, 0.5]);

    expect(mgr.getUniform('u_dir')).toEqual([1.0, -1.0]);
    expect(mgr.getUniform('u_baseColor')).toEqual([0.8, 0.2, 0.5]);
    expect(mgr.getUniform('u_tint')).toEqual([1.0, 1.0, 1.0, 0.5]);
  });

  it('converts CSS hex color strings into normalized float vec3 and vec4 arrays', () => {
    const whiteVec3 = hexToVec3('#ffffff');
    expect(whiteVec3).toEqual([1, 1, 1]);

    const shortHex = hexToVec3('#f00'); // red
    expect(shortHex).toEqual([1, 0, 0]);

    const rgbaVec4 = hexToVec4('#00ff0080'); // semi-transparent green
    expect(rgbaVec4[0]).toBe(0);
    expect(rgbaVec4[1]).toBe(1);
    expect(rgbaVec4[2]).toBe(0);
    expect(rgbaVec4[3]).toBeCloseTo(0.5, 1);
  });

  it('utilizes uniform caching to prevent redundant GPU state updates', () => {
    const mgr = new UniformManager();
    const changed1 = mgr.setUniform('u_speed', 2.0);
    expect(changed1).toBe(true);

    const dirty1 = mgr.flushDirty();
    expect(dirty1).toContain('u_speed');

    // Setting exact same value again
    const changed2 = mgr.setUniform('u_speed', 2.0);
    expect(changed2).toBe(false);

    const dirty2 = mgr.flushDirty();
    expect(dirty2).not.toContain('u_speed');
  });
});
