/**
 * Tier 1 Feature Test: Registry Schema Validation
 * Tests strict schema validation, uniform descriptor typing, error reporting, and metadata integrity.
 */

import { describe, it, expect } from '../harness/test-kit.ts';
import { STARTER_SHADERS, validateShaderComponent } from '../mocks/mock-registry-data.ts';

describe('Tier 1: Registry Schema Validation', () => {
  it('validates all built-in starter shaders successfully against registry schema', () => {
    for (const [id, shader] of Object.entries(STARTER_SHADERS)) {
      const validation = validateShaderComponent(shader);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(shader.id).toBe(id);
      expect(typeof shader.name).toBe('string');
      expect(typeof shader.glsl).toBe('string');
      expect(typeof shader.wgsl).toBe('string');
      expect(Array.isArray(shader.uniforms)).toBe(true);
    }
  });

  it('rejects component definition missing mandatory fields (id, name, glsl, wgsl)', () => {
    const invalidComp = {
      description: 'Missing id, name, glsl, wgsl',
      uniforms: []
    };

    const validation = validateShaderComponent(invalidComp);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('id'))).toBe(true);
    expect(validation.errors.some((e) => e.includes('name'))).toBe(true);
    expect(validation.errors.some((e) => e.includes('glsl'))).toBe(true);
    expect(validation.errors.some((e) => e.includes('wgsl'))).toBe(true);
  });

  it('validates allowed uniform types (float, vec2, vec3, vec4, int) and rejects invalid types', () => {
    const compWithInvalidUniform = {
      id: 'custom-effect',
      name: 'Custom Effect',
      glsl: 'void main(){}',
      wgsl: 'fn main(){}',
      uniforms: [
        { name: 'u_valid', type: 'float', defaultValue: 1.0 },
        { name: 'u_invalid', type: 'unsupported_matrix', defaultValue: null }
      ]
    };

    const validation = validateShaderComponent(compWithInvalidUniform);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('invalid type unsupported_matrix'))).toBe(true);
  });

  it('enforces defaultValue presence on all declared uniforms', () => {
    const compMissingDefault = {
      id: 'test-effect',
      name: 'Test Effect',
      glsl: 'void main(){}',
      wgsl: 'fn main(){}',
      uniforms: [{ name: 'u_speed', type: 'float' }]
    };

    const validation = validateShaderComponent(compMissingDefault);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('missing defaultValue'))).toBe(true);
  });

  it('provides structured array of error diagnostics explaining every failure', () => {
    const emptyObject = {};
    const validation = validateShaderComponent(emptyObject);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThanOrEqual(4);
    for (const err of validation.errors) {
      expect(typeof err).toBe('string');
      expect(err.length).toBeGreaterThan(0);
    }
  });
});
