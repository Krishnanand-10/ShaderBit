/**
 * Tier 1 Feature Test: Registry Starter Effects (4 Shaders)
 * Tests Liquid Chrome, Mesh Gradient, Interactive Noise, and Caustics implementations in GLSL and WGSL.
 */

import { describe, it, expect } from '../harness/test-kit.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';
import type { ShaderComponent } from '../mocks/mock-registry-data.ts';

export class ShaderRegistryCatalog {
  private catalog: Map<string, ShaderComponent> = new Map();

  constructor() {
    for (const [id, comp] of Object.entries(STARTER_SHADERS)) {
      this.catalog.set(id, comp);
    }
  }

  getEffect(id: string): ShaderComponent | undefined {
    return this.catalog.get(id);
  }

  hasEffect(id: string): boolean {
    return this.catalog.has(id);
  }

  listEffects(): ShaderComponent[] {
    return Array.from(this.catalog.values());
  }
}

describe('Tier 1: Registry Starter Effects (4 Shaders)', () => {
  const registry = new ShaderRegistryCatalog();

  it('provides Liquid Chrome effect with metallic flow uniforms and 2D fallback', () => {
    const effect = registry.getEffect('liquid-chrome');
    expect(effect).toBeDefined();
    expect(effect!.name).toBe('Liquid Chrome');
    expect(effect!.glsl).toContain('u_speed');
    expect(effect!.glsl).toContain('u_reflection');
    expect(effect!.glsl).toContain('u_roughness');
    expect(effect!.wgsl).toContain('u_reflection: f32');
    expect(typeof effect!.canvas2dFallback).toBe('function');
  });

  it('provides Mesh Gradient effect with 4-point color vector blending and wave distortion', () => {
    const effect = registry.getEffect('mesh-gradient');
    expect(effect).toBeDefined();
    expect(effect!.name).toBe('Mesh Gradient');
    expect(effect!.uniforms.some((u) => u.name === 'u_color1')).toBe(true);
    expect(effect!.uniforms.some((u) => u.name === 'u_color2')).toBe(true);
    expect(effect!.uniforms.some((u) => u.name === 'u_color3')).toBe(true);
    expect(effect!.uniforms.some((u) => u.name === 'u_color4')).toBe(true);
    expect(effect!.glsl).toContain('u_waveAmplitude');
    expect(effect!.wgsl).toContain('u_waveAmplitude: f32');
  });

  it('provides Interactive Noise effect with mouse displacement radius and turbulence', () => {
    const effect = registry.getEffect('interactive-noise');
    expect(effect).toBeDefined();
    expect(effect!.name).toBe('Interactive Noise');
    expect(effect!.glsl).toContain('u_mouseRadius');
    expect(effect!.glsl).toContain('u_mouseIntensity');
    expect(effect!.glsl).toContain('u_noiseScale');
    expect(effect!.wgsl).toContain('u_mouseRadius: f32');
  });

  it('provides Caustics effect with underwater light refraction and depth exponent', () => {
    const effect = registry.getEffect('caustics');
    expect(effect).toBeDefined();
    expect(effect!.name).toBe('Caustics');
    expect(effect!.glsl).toContain('u_causticScale');
    expect(effect!.glsl).toContain('u_depth');
    expect(effect!.glsl).toContain('u_brightness');
    expect(effect!.glsl).toContain('u_waterColor');
    expect(effect!.wgsl).toContain('u_waterColor: vec3<f32>');
  });

  it('supports registry catalog queries (getEffect, hasEffect, listEffects)', () => {
    expect(registry.hasEffect('liquid-chrome')).toBe(true);
    expect(registry.hasEffect('mesh-gradient')).toBe(true);
    expect(registry.hasEffect('interactive-noise')).toBe(true);
    expect(registry.hasEffect('caustics')).toBe(true);
    expect(registry.hasEffect('unknown-shader-id')).toBe(false);

    const all = registry.listEffects();
    expect(all).toHaveLength(4);
  });
});
