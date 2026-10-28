import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listComponents,
  getComponent,
  hasComponent,
  getComponentsByTag,
  filterByTag,
  searchComponents,
  registerComponent,
  unregisterComponent,
  resetRegistry,
  clearRegistry,
  validateComponent,
  validateShaderComponent,
  UniformTypeSchema,
  UniformDescriptorSchema,
  ShaderComponentSchema,
  CATALOG,
  STARTER_SHADERS,
  liquidChrome,
  meshGradient,
  interactiveNoise,
  caustics,
  hexToVec3,
  hexToVec4,
  toShaderUniformValue,
  createUniformMap,
  getUniformDefaults,
  UniformManager,
  STANDARD_UNIFORMS,
  isStandardUniform,
  formatShaderError,
  formatShaderDiagnosticContext,
  parseGlslErrorLog,
  ShaderRegistryCatalog,
  getEffect,
  hasEffect,
  listEffects
} from './index';
import type { ShaderComponent } from './index';

describe('@shaderbit/registry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  describe('Catalog & Query APIs', () => {
    it('exports all 4 starter shaders in CATALOG array and STARTER_SHADERS map', () => {
      expect(CATALOG).toHaveLength(4);
      expect(Object.keys(STARTER_SHADERS)).toHaveLength(4);
      expect(listComponents()).toHaveLength(4);
      const ids = listComponents().map((c) => c.id);
      expect(ids).toContain('liquid-chrome');
      expect(ids).toContain('mesh-gradient');
      expect(ids).toContain('interactive-noise');
      expect(ids).toContain('caustics');
    });

    it('retrieves components by id with getComponent and hasComponent', () => {
      expect(getComponent('liquid-chrome')).toBe(liquidChrome);
      expect(getComponent('mesh-gradient')).toBe(meshGradient);
      expect(getComponent('interactive-noise')).toBe(interactiveNoise);
      expect(getComponent('caustics')).toBe(caustics);
      expect(getComponent('nonexistent')).toBeUndefined();

      expect(hasComponent('liquid-chrome')).toBe(true);
      expect(hasComponent('unknown-id')).toBe(false);
    });

    it('filters components by tag case-insensitively with getComponentsByTag and filterByTag', () => {
      const liquidTagged = getComponentsByTag('liquid');
      expect(liquidTagged).toHaveLength(1);
      expect(liquidTagged[0].id).toBe('liquid-chrome');

      const metallicTagged = getComponentsByTag('METALLIC');
      expect(metallicTagged).toHaveLength(1);
      expect(metallicTagged[0].id).toBe('liquid-chrome');

      const waterTagged = getComponentsByTag('water');
      expect(waterTagged).toHaveLength(1);
      expect(waterTagged[0].id).toBe('caustics');

      expect(getComponentsByTag('nonexistent-tag')).toEqual([]);

      const filtered = filterByTag('grad');
      expect(filtered.some((c) => c.id === 'mesh-gradient')).toBe(true);
    });

    it('searches components across id, name, description, and tags', () => {
      // Empty query returns all components
      expect(searchComponents('')).toHaveLength(4);

      // Search by id
      const byId = searchComponents('chrome');
      expect(byId.length).toBeGreaterThanOrEqual(1);
      expect(byId[0].id).toBe('liquid-chrome');

      // Search by description keyword
      const byDesc = searchComponents('simplex');
      expect(byDesc).toHaveLength(1);
      expect(byDesc[0].id).toBe('interactive-noise');

      // Search by tag
      const byTag = searchComponents('refraction');
      expect(byTag).toHaveLength(1);
      expect(byTag[0].id).toBe('caustics');

      // Non-matching query
      expect(searchComponents('nonexistent-query-string-xyz')).toEqual([]);
    });

    it('registers valid custom components and adds to catalog', () => {
      const customComp: ShaderComponent = {
        id: 'custom-bloom',
        name: 'Custom Bloom',
        description: 'Post-process bloom effect',
        version: '1.0.0',
        tags: ['bloom', 'glow'],
        glsl: '#version 300 es\nvoid main(){}',
        wgsl: '@fragment fn fs_main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }',
        uniforms: [{ name: 'u_intensity', type: 'float', defaultValue: 1.0 }]
      };

      registerComponent(customComp);
      expect(hasComponent('custom-bloom')).toBe(true);
      expect(getComponent('custom-bloom')).toBe(customComp);
      expect(getComponentsByTag('glow')).toContain(customComp);
      expect(listComponents()).toHaveLength(5);

      // Unregister
      const deleted = unregisterComponent('custom-bloom');
      expect(deleted).toBe(true);
      expect(hasComponent('custom-bloom')).toBe(false);
      expect(listComponents()).toHaveLength(4);
    });

    it('supports clearRegistry and resetRegistry', () => {
      clearRegistry();
      expect(listComponents()).toHaveLength(0);

      resetRegistry();
      expect(listComponents()).toHaveLength(4);
    });

    it('supports ShaderRegistryCatalog class wrapper and aliases', () => {
      const catalogWrapper = new ShaderRegistryCatalog();
      expect(catalogWrapper.getEffect('liquid-chrome')).toBe(liquidChrome);
      expect(catalogWrapper.hasEffect('liquid-chrome')).toBe(true);
      expect(catalogWrapper.listEffects()).toHaveLength(4);
      expect(catalogWrapper.searchComponents('chrome')).toHaveLength(1);
      expect(catalogWrapper.filterByTag('water')).toHaveLength(1);

      expect(getEffect('caustics')).toBe(caustics);
      expect(hasEffect('caustics')).toBe(true);
      expect(listEffects()).toHaveLength(4);
    });
  });

  describe('Schema Validation', () => {
    it('validates all built-in starter shaders with validateShaderComponent', () => {
      for (const comp of CATALOG) {
        const res = validateShaderComponent(comp);
        expect(res.valid).toBe(true);
        expect(res.errors).toHaveLength(0);
      }
    });

    it('validates with throwing validateComponent without errors', () => {
      for (const comp of CATALOG) {
        expect(() => validateComponent(comp)).not.toThrow();
      }
    });

    it('rejects component missing mandatory fields (id, name, glsl, wgsl)', () => {
      const incomplete = {
        description: 'Missing fields',
        uniforms: []
      };
      const res = validateShaderComponent(incomplete);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('id'))).toBe(true);
      expect(res.errors.some((e) => e.includes('name'))).toBe(true);
      expect(res.errors.some((e) => e.includes('glsl'))).toBe(true);
      expect(res.errors.some((e) => e.includes('wgsl'))).toBe(true);
    });

    it('rejects invalid uniform type', () => {
      const badUniform = {
        id: 'bad-u',
        name: 'Bad Uniform',
        glsl: 'void main(){}',
        wgsl: 'fn main(){}',
        tags: [],
        description: 'test',
        version: '1.0.0',
        uniforms: [{ name: 'u_mat', type: 'unsupported_matrix', defaultValue: null }]
      };
      const res = validateShaderComponent(badUniform);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('invalid type unsupported_matrix'))).toBe(true);
    });

    it('rejects uniform missing defaultValue', () => {
      const compMissingDefault = {
        id: 'test-effect',
        name: 'Test Effect',
        glsl: 'void main(){}',
        wgsl: 'fn main(){}',
        uniforms: [{ name: 'u_speed', type: 'float' }]
      };
      const res = validateShaderComponent(compMissingDefault);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('missing defaultValue'))).toBe(true);
    });

    it('rejects non-object or null components', () => {
      expect(validateShaderComponent(null).valid).toBe(false);
      expect(validateShaderComponent(undefined).valid).toBe(false);
      expect(validateShaderComponent('not an object').valid).toBe(false);
      expect(validateShaderComponent(12345).valid).toBe(false);
    });

    it('validates using Zod schemas directly', () => {
      expect(UniformTypeSchema.parse('float')).toBe('float');
      expect(UniformTypeSchema.parse('vec2')).toBe('vec2');
      expect(UniformTypeSchema.parse('vec3')).toBe('vec3');
      expect(UniformTypeSchema.parse('vec4')).toBe('vec4');
      expect(UniformTypeSchema.parse('int')).toBe('int');
      expect(() => UniformTypeSchema.parse('mat4')).toThrow();

      const validDesc = { name: 'u_speed', type: 'float', defaultValue: 1.0 };
      expect(() => UniformDescriptorSchema.parse(validDesc)).not.toThrow();

      const invalidDesc = { name: 'u_speed', type: 'float' }; // missing defaultValue
      expect(() => UniformDescriptorSchema.parse(invalidDesc)).toThrow();
    });
  });

  describe('Uniform Abstractions & Conversion Utilities', () => {
    it('identifies standard system uniforms', () => {
      expect(STANDARD_UNIFORMS).toEqual(['u_resolution', 'u_time', 'u_mouse', 'u_dpr']);
      expect(isStandardUniform('u_resolution')).toBe(true);
      expect(isStandardUniform('u_time')).toBe(true);
      expect(isStandardUniform('u_mouse')).toBe(true);
      expect(isStandardUniform('u_dpr')).toBe(true);
      expect(isStandardUniform('u_custom')).toBe(false);
    });

    it('converts CSS hex colors to normalized vec3 and vec4', () => {
      expect(hexToVec3('#ffffff')).toEqual([1, 1, 1]);
      expect(hexToVec3('#f00')).toEqual([1, 0, 0]);
      expect(hexToVec3('#000000')).toEqual([0, 0, 0]);
      expect(hexToVec3('invalid')).toEqual([0, 0, 0]);

      const v4 = hexToVec4('#00ff0080');
      expect(v4[0]).toBe(0);
      expect(v4[1]).toBe(1);
      expect(v4[2]).toBe(0);
      expect(v4[3]).toBeCloseTo(0.5, 1);

      expect(hexToVec4('#fff')).toEqual([1, 1, 1, 1]);
      expect(hexToVec4('invalid')).toEqual([0, 0, 0, 1]);
    });

    it('converts uniform descriptors to ShaderUniformValue with hex color handling', () => {
      const descVec3 = { name: 'u_col', type: 'vec3' as const, defaultValue: [0, 0, 0] };
      const resHex = toShaderUniformValue(descVec3, '#ffffff');
      expect(resHex).toEqual({ type: 'vec3', value: [1, 1, 1] });

      const descVec4 = { name: 'u_col4', type: 'vec4' as const, defaultValue: [0, 0, 0, 1] };
      const resHex4 = toShaderUniformValue(descVec4, '#00ff00ff');
      expect(resHex4).toEqual({ type: 'vec4', value: [0, 1, 0, 1] });

      const descFloat = { name: 'u_speed', type: 'float' as const, defaultValue: 1.0 };
      expect(toShaderUniformValue(descFloat)).toEqual({ type: 'float', value: 1.0 });
    });

    it('creates uniform maps and handles overrides', () => {
      const desc = liquidChrome.uniforms;
      const map = createUniformMap(desc, { u_speed: 2.5, u_baseColor: '#ffffff' });

      expect(map.u_speed).toEqual({ type: 'float', value: 2.5 });
      expect(map.u_baseColor).toEqual({ type: 'vec3', value: [1, 1, 1] });
      expect(map.u_reflection.value).toBe(0.8);
    });

    it('extracts uniform defaults with getUniformDefaults', () => {
      const defaults = getUniformDefaults(liquidChrome);
      expect(defaults.u_speed).toBe(1.0);
      expect(defaults.u_reflection).toBe(0.8);
      expect(defaults.u_roughness).toBe(0.2);
      expect(defaults.u_baseColor).toEqual([0.7, 0.75, 0.8]);
      expect(defaults.u_lightColor).toEqual([1.0, 0.95, 0.9]);
    });

    it('manages uniform caching with UniformManager', () => {
      const mgr = new UniformManager();
      mgr.bindSystemUniforms(1920, 1080, 1.25, [0.5, 0.5], 2.0);

      expect(mgr.getUniform('u_resolution')).toEqual([1920, 1080]);
      expect(mgr.getUniform('u_time')).toBe(1.25);
      expect(mgr.getUniform('u_mouse')).toEqual([0.5, 0.5]);
      expect(mgr.getUniform('u_dpr')).toBe(2.0);
      expect(mgr.hasUniform('u_time')).toBe(true);
      expect(mgr.hasUniform('u_nonexistent')).toBe(false);

      const changed1 = mgr.setUniform('u_speed', 1.0);
      expect(changed1).toBe(true);
      expect(mgr.flushDirty()).toContain('u_speed');

      // Redundant set returns false and does not mark dirty
      const changed2 = mgr.setUniform('u_speed', 1.0);
      expect(changed2).toBe(false);
      expect(mgr.flushDirty()).not.toContain('u_speed');

      mgr.clear();
      expect(mgr.hasUniform('u_speed')).toBe(false);
    });
  });

  describe('Shader Code Validity & Canvas2D Fallbacks', () => {
    it('verifies GLSL ES 3.00 headers and entry points across all shaders', () => {
      for (const comp of CATALOG) {
        expect(comp.glsl).toContain('#version 300 es');
        expect(comp.glsl).toContain('precision highp float;');
        expect(comp.glsl).toContain('void main()');
      }
    });

    it('verifies WGSL structure across all shaders', () => {
      for (const comp of CATALOG) {
        expect(comp.wgsl).toContain('@fragment');
        expect(comp.wgsl).toContain('fn fs_main');
      }
    });

    it('verifies shader bundle size is compact (under 5KB JSON)', () => {
      for (const comp of CATALOG) {
        const size = Buffer.byteLength(JSON.stringify(comp), 'utf8');
        expect(size).toBeLessThan(5120);
      }
    });

    it('executes canvas2dFallback functions without throwing', () => {
      const mockCtx = {
        fillStyle: '',
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
      };

      for (const comp of CATALOG) {
        expect(typeof comp.canvas2dFallback).toBe('function');
        expect(() => {
          comp.canvas2dFallback!(mockCtx as any, 800, 600, 1.0, [0.5, 0.5]);
        }).not.toThrow();
      }
    });
  });

  describe('Shader Error Diagnostics', () => {
    it('parses standard GLSL error logs', () => {
      const rawLog = "ERROR: 0:29: 'SYNTAX_ERROR' : syntax error\nERROR: 0:34: 'undeclared' : undeclared identifier";
      const parsed = parseGlslErrorLog(rawLog);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].line).toBe(29);
      expect(parsed[1].line).toBe(34);
    });

    it('handles empty or malformed error logs in parseGlslErrorLog', () => {
      expect(parseGlslErrorLog('')).toEqual([]);
      expect(parseGlslErrorLog(null as any)).toEqual([]);
    });

    it('formats diagnostic context with line context and column pointers', () => {
      const source = `line 1
line 2
line 3 with error
line 4
line 5`;
      const formatted = formatShaderDiagnosticContext(source, 3, 6, 1);
      expect(formatted).toContain('> 3 | line 3 with error');
      expect(formatted).toContain('^');
      expect(formatted).toContain('  2 | line 2');
      expect(formatted).toContain('  4 | line 4');
    });

    it('formats shader compilation errors with line context and pointers', () => {
      const dummyGlsl = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  SYNTAX_ERROR here;
  fragColor = vec4(uv, 0.0, 1.0);
}`;
      const rawLog = "ERROR: 0:6: 'SYNTAX_ERROR' : syntax error";
      const formatted = formatShaderError(rawLog, dummyGlsl);

      expect(formatted.diagnostics).toHaveLength(1);
      expect(formatted.diagnostics[0].line).toBe(6);
      expect(formatted.formatted).toContain('[Line 6]');
      expect(formatted.formatted).toContain('SYNTAX_ERROR here;');
      expect(formatted.formatted).toContain('>');
    });

    it('handles formatShaderError when no line numbers can be parsed', () => {
      const unparseableLog = 'Unknown GPU driver failure';
      const formatted = formatShaderError(unparseableLog, 'some source');
      expect(formatted.diagnostics).toHaveLength(0);
      expect(formatted.formatted).toContain('Unknown GPU driver failure');
    });
  });
});
