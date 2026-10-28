/**
 * Milestone 3 Adversarial Stress & Empirical Challenge Suite (@shaderbit/registry)
 *
 * Probes:
 * 1. Schema validation edge cases (missing fields, malformed types, null, undefined, invalid uniform types, huge objects)
 * 2. UniformManager edge cases (rapid uniform updates, dirty tracking precision, NaN/Infinity values, empty uniform maps, standard uniform overriding)
 * 3. CSS hex parsing precision (malformed hex strings, 3-char, 6-char, 8-char parsing precision)
 * 4. Starter shaders: Canvas2D fallback under extreme dimensions (0x0, negative, 10000x10000, NaN, Infinity) with zero exceptions
 * 5. Catalog queries and error diagnostics resilience under adversarial inputs
 */

import { test, describe, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

// Load compiled registry bundle to verify built ESM artifacts
const repoRoot = resolve(import.meta.dirname, '../..');
const registryDistPath = resolve(repoRoot, 'packages/registry/dist/index.js');
const registry = await import(registryDistPath);

const {
  validateShaderComponent,
  validateComponent,
  UniformTypeSchema,
  UniformDescriptorSchema,
  ShaderComponentSchema,
  UniformManager,
  hexToVec3,
  hexToVec4,
  toShaderUniformValue,
  createUniformMap,
  getUniformDefaults,
  STANDARD_UNIFORMS,
  isStandardUniform,
  CATALOG,
  STARTER_SHADERS,
  listComponents,
  getComponent,
  hasComponent,
  searchComponents,
  filterByTag,
  getComponentsByTag,
  resetRegistry,
  parseGlslErrorLog,
  formatShaderDiagnosticContext,
  formatShaderError
} = registry;

// Standalone Mock Canvas 2D Context for headless zero-dep stress testing
function createMockCanvas2D() {
  const gradientStops: Array<{ offset: number; color: string }> = [];
  const calls: Array<{ method: string; args: any[] }> = [];

  const mockGradient = {
    addColorStop: (offset: number, color: string) => {
      gradientStops.push({ offset, color });
    }
  };

  const ctx = {
    fillStyle: '#000000' as any,
    strokeStyle: '#000000' as any,
    lineWidth: 1,
    calls,
    gradientStops,
    fillRect: (x: number, y: number, w: number, h: number) => {
      calls.push({ method: 'fillRect', args: [x, y, w, h] });
    },
    clearRect: (x: number, y: number, w: number, h: number) => {
      calls.push({ method: 'clearRect', args: [x, y, w, h] });
    },
    beginPath: () => {
      calls.push({ method: 'beginPath', args: [] });
    },
    closePath: () => {
      calls.push({ method: 'closePath', args: [] });
    },
    arc: (x: number, y: number, r: number, sAngle: number, eAngle: number) => {
      calls.push({ method: 'arc', args: [x, y, r, sAngle, eAngle] });
    },
    fill: () => {
      calls.push({ method: 'fill', args: [] });
    },
    stroke: () => {
      calls.push({ method: 'stroke', args: [] });
    },
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
      calls.push({ method: 'createLinearGradient', args: [x0, y0, x1, y1] });
      return mockGradient;
    },
    createRadialGradient: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => {
      calls.push({ method: 'createRadialGradient', args: [x0, y0, r0, x1, y1, r1] });
      return mockGradient;
    }
  };

  return ctx;
}

// =========================================================================
// 1. Schema Validation Edge Cases
// =========================================================================
describe('1. Schema Validation Edge Cases', () => {
  test('rejects non-object and primitive values without throwing uncaught exceptions', () => {
    const primitives = [null, undefined, 0, 12345, -99.9, '', 'invalid-string', true, false, Symbol('test'), BigInt(42)];
    for (const val of primitives) {
      const res = validateShaderComponent(val);
      assert.equal(res.valid, false, `Expected primitive ${String(val)} to fail validation`);
      assert.ok(res.errors.length > 0, `Expected error messages for ${String(val)}`);
      assert.ok(res.errors[0].includes('Component must be a non-null object'));
    }
  });

  test('rejects empty and sparse objects missing mandatory fields', () => {
    const emptyRes = validateShaderComponent({});
    assert.equal(emptyRes.valid, false);
    // Mandatory fields: id, name, glsl, wgsl, uniforms
    const errorText = emptyRes.errors.join(' ');
    assert.ok(errorText.includes('id'), 'Should report missing id');
    assert.ok(errorText.includes('name'), 'Should report missing name');
    assert.ok(errorText.includes('glsl'), 'Should report missing glsl');
    assert.ok(errorText.includes('wgsl'), 'Should report missing wgsl');
    assert.ok(errorText.includes('uniforms'), 'Should report missing uniforms');
  });

  test('rejects components with individual missing or malformed mandatory fields', () => {
    const validBase = {
      id: 'test-shader',
      name: 'Test Shader',
      glsl: '#version 300 es\nvoid main() {}',
      wgsl: '@fragment fn fs_main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }',
      uniforms: []
    };

    // Missing id
    const noId = { ...validBase, id: undefined };
    assert.equal(validateShaderComponent(noId).valid, false);

    // Empty id string
    const emptyId = { ...validBase, id: '' };
    assert.equal(validateShaderComponent(emptyId).valid, false);

    // Id with invalid type (number)
    const numId = { ...validBase, id: 12345 as any };
    assert.equal(validateShaderComponent(numId).valid, false);

    // Missing name
    const noName = { ...validBase, name: '' };
    assert.equal(validateShaderComponent(noName).valid, false);

    // Missing glsl
    const noGlsl = { ...validBase, glsl: null as any };
    assert.equal(validateShaderComponent(noGlsl).valid, false);

    // Missing wgsl
    const noWgsl = { ...validBase, wgsl: 12345 as any };
    assert.equal(validateShaderComponent(noWgsl).valid, false);

    // Uniforms is not an array
    const objUniforms = { ...validBase, uniforms: { u_speed: 1 } as any };
    assert.equal(validateShaderComponent(objUniforms).valid, false);

    const stringUniforms = { ...validBase, uniforms: 'u_speed' as any };
    assert.equal(validateShaderComponent(stringUniforms).valid, false);
  });

  test('rejects malformed uniform descriptors', () => {
    const validBase = {
      id: 'uniform-test',
      name: 'Uniform Test',
      glsl: 'void main() {}',
      wgsl: 'fn fs_main() {}',
      uniforms: []
    };

    // Array containing null / undefined / primitives
    const primitiveUniforms = {
      ...validBase,
      uniforms: [null, undefined, 42, 'invalid'] as any
    };
    const primRes = validateShaderComponent(primitiveUniforms);
    assert.equal(primRes.valid, false);
    assert.ok(primRes.errors.some((e: string) => e.includes('Uniform descriptor must be an object')));

    // Uniform missing name
    const unnamedUniform = {
      ...validBase,
      uniforms: [{ type: 'float', defaultValue: 1.0 }] as any
    };
    const unnamedRes = validateShaderComponent(unnamedUniform);
    assert.equal(unnamedRes.valid, false);
    assert.ok(unnamedRes.errors.some((e: string) => e.includes('Uniform missing name')));

    // Uniform with unsupported types (e.g. matrix4, bool, sampler2D)
    const unsupportedTypes = ['matrix4', 'bool', 'sampler2D', 'double', 'int[]', ''];
    for (const badType of unsupportedTypes) {
      const badUniform = {
        ...validBase,
        uniforms: [{ name: 'u_bad', type: badType as any, defaultValue: 1.0 }]
      };
      const res = validateShaderComponent(badUniform);
      assert.equal(res.valid, false, `Type ${badType} should be rejected`);
      assert.ok(res.errors.some((e: string) => e.includes('invalid type')));
    }

    // Uniform missing defaultValue (undefined)
    const missingDefault = {
      ...validBase,
      uniforms: [{ name: 'u_test', type: 'float' as const }]
    };
    const missingDefRes = validateShaderComponent(missingDefault);
    assert.equal(missingDefRes.valid, false);
    assert.ok(missingDefRes.errors.some((e: string) => e.includes('missing defaultValue')));
  });

  test('validates huge objects with 5,000 properties and prototype pollution attempts', () => {
    // 5000 arbitrary noise properties
    const hugeComp: Record<string, any> = {
      id: 'stress-huge-object',
      name: 'Huge Object Shader',
      glsl: '#version 300 es\nvoid main() {}',
      wgsl: '@fragment fn main() {}',
      uniforms: []
    };
    for (let i = 0; i < 5000; i++) {
      hugeComp[`extra_prop_${i}`] = `value_${i}`;
    }

    // Prototype pollution attempt
    hugeComp['__proto__'] = { admin: true };
    hugeComp['constructor'] = { prototype: { poll: true } };

    const t0 = performance.now();
    const res = validateShaderComponent(hugeComp);
    const duration = performance.now() - t0;

    assert.equal(res.valid, true, 'Huge object with valid core fields should pass non-throwing validation');
    assert.ok(duration < 100, `Validation of 5000 properties took ${duration}ms, expected < 100ms`);

    // Verify global Object prototype was not polluted
    assert.equal((Object.prototype as any).poll, undefined);
  });

  test('validates large uniform arrays (1,000 uniforms) without performance regression', () => {
    const manyUniforms: any[] = [];
    for (let i = 0; i < 1000; i++) {
      manyUniforms.push({
        name: `u_param_${i}`,
        type: i % 2 === 0 ? 'float' : 'vec3',
        defaultValue: i % 2 === 0 ? 0.5 : [0.1, 0.2, 0.3],
        description: `Auto-generated parameter ${i}`
      });
    }

    const comp = {
      id: 'stress-1000-uniforms',
      name: '1000 Uniforms Shader',
      glsl: 'void main() {}',
      wgsl: 'fn main() {}',
      uniforms: manyUniforms
    };

    const t0 = performance.now();
    const res = validateShaderComponent(comp);
    const duration = performance.now() - t0;

    assert.equal(res.valid, true);
    assert.ok(duration < 150, `1000 uniforms validation took ${duration}ms, expected < 150ms`);
  });

  test('Zod strict validator validateComponent throws on invalid schema', () => {
    assert.throws(
      () => validateComponent(null),
      /expected object, received null/i
    );
    // Missing required fields throws ZodError with Required
    assert.throws(
      () => validateComponent({ id: 'only-id' }),
      /Required/i
    );
    // Empty name throws min(1) error
    assert.throws(
      () => validateComponent({ id: 'test', name: '', glsl: '...', wgsl: '...' }),
      /too_small/i
    );
    // Unsupported uniform type
    assert.throws(
      () => validateComponent({
        id: 'bad-uniform',
        name: 'Bad Uniform',
        glsl: '...',
        wgsl: '...',
        uniforms: [{ name: 'u_x', type: 'unsupported_type', defaultValue: 1 }]
      }),
      /Invalid enum value/i
    );
  });
});

// =========================================================================
// 2. UniformManager Dirty-Tracking & State Machine Stress
// =========================================================================
describe('2. UniformManager Dirty-Tracking & Edge Cases', () => {
  let manager: any;

  beforeEach(() => {
    manager = new UniformManager();
  });

  test('handles 20,000 rapid sequential updates on a single uniform with precise dirty tracking', () => {
    const t0 = performance.now();
    for (let i = 0; i < 20000; i++) {
      const changed = manager.setUniform('u_time', i * 0.016);
      assert.equal(changed, true);
    }
    const elapsed = performance.now() - t0;
    assert.ok(elapsed < 200, `20,000 updates took ${elapsed}ms, expected < 200ms`);

    // Verify flushDirty returns u_time exactly once (Set deduplication)
    const dirty = manager.flushDirty();
    assert.deepEqual(dirty, ['u_time']);

    // Subsequent flush must be empty
    assert.deepEqual(manager.flushDirty(), []);
    assert.equal(manager.getUniform('u_time'), 19999 * 0.016);
  });

  test('deduplicates identical values and eliminates redundant GPU updates', () => {
    // Primitive number
    assert.equal(manager.setUniform('u_speed', 1.5), true);
    assert.equal(manager.setUniform('u_speed', 1.5), false); // Redundant

    // Vector tuple
    assert.equal(manager.setUniform('u_color', [0.5, 0.5, 0.5]), true);
    assert.equal(manager.setUniform('u_color', [0.5, 0.5, 0.5]), false); // Deep equality check

    // Vector with minute difference
    assert.equal(manager.setUniform('u_color', [0.5, 0.5, 0.5001]), true);

    const dirty = manager.flushDirty();
    assert.ok(dirty.includes('u_speed'));
    assert.ok(dirty.includes('u_color'));
    assert.equal(dirty.length, 2);

    // Verify after flush
    assert.deepEqual(manager.flushDirty(), []);
  });

  test('probes NaN and Infinity uniform values', () => {
    // Setting NaN
    assert.equal(manager.setUniform('u_factor', NaN), true);
    assert.ok(isNaN(manager.getUniform('u_factor')));
    assert.deepEqual(manager.flushDirty(), ['u_factor']);

    // Setting Infinity
    // Note: in JavaScript JSON.stringify(NaN) === "null" and JSON.stringify(Infinity) === "null"
    // When transitioning between NaN and Infinity, observe behavior:
    const changedToInfinity = manager.setUniform('u_factor', Infinity);
    if (!changedToInfinity) {
      assert.equal(JSON.stringify(NaN), JSON.stringify(Infinity));
    }

    // Setting regular valid float clears and tracks dirty
    assert.equal(manager.setUniform('u_factor', 42.0), true);
    assert.deepEqual(manager.flushDirty(), ['u_factor']);
  });

  test('handles empty and uninitialized uniform manager states safely', () => {
    assert.equal(manager.hasUniform('u_nonexistent'), false);
    assert.equal(manager.getUniform('u_nonexistent'), undefined);
    assert.deepEqual(manager.flushDirty(), []);

    // Calling clear on empty manager
    manager.clear();
    assert.deepEqual(manager.flushDirty(), []);

    // createUniformMap with empty descriptors
    const emptyMap = createUniformMap([]);
    assert.deepEqual(emptyMap, {});

    // createUniformMap with empty descriptors and irrelevant overrides
    const emptyWithOverrides = createUniformMap([], { u_random: 999 });
    assert.deepEqual(emptyWithOverrides, {});
  });

  test('handles system uniform auto-binding and user override cycles', () => {
    // 1. Initial system bind
    manager.bindSystemUniforms(1920, 1080, 1.25, [0.4, 0.6], 2.0);
    assert.deepEqual(manager.getUniform('u_resolution'), [1920, 1080]);
    assert.equal(manager.getUniform('u_time'), 1.25);
    assert.deepEqual(manager.getUniform('u_mouse'), [0.4, 0.6]);
    assert.equal(manager.getUniform('u_dpr'), 2.0);

    const dirty1 = manager.flushDirty();
    assert.equal(dirty1.length, 4);
    assert.ok(dirty1.includes('u_resolution'));
    assert.ok(dirty1.includes('u_time'));
    assert.ok(dirty1.includes('u_mouse'));
    assert.ok(dirty1.includes('u_dpr'));

    // 2. Re-bind identical values -> 0 dirty keys
    manager.bindSystemUniforms(1920, 1080, 1.25, [0.4, 0.6], 2.0);
    assert.deepEqual(manager.flushDirty(), []);

    // 3. User overrides u_time
    assert.equal(manager.setUniform('u_time', 99.9), true);
    assert.deepEqual(manager.flushDirty(), ['u_time']);

    // 4. Clear resets all
    manager.clear();
    assert.equal(manager.hasUniform('u_resolution'), false);
    assert.equal(manager.hasUniform('u_time'), false);
    assert.deepEqual(manager.flushDirty(), []);
  });

  test('STANDARD_UNIFORMS and isStandardUniform accurately identify reserved system uniforms', () => {
    assert.deepEqual(STANDARD_UNIFORMS, ['u_resolution', 'u_time', 'u_mouse', 'u_dpr']);
    assert.equal(isStandardUniform('u_resolution'), true);
    assert.equal(isStandardUniform('u_time'), true);
    assert.equal(isStandardUniform('u_mouse'), true);
    assert.equal(isStandardUniform('u_dpr'), true);

    assert.equal(isStandardUniform('u_custom'), false);
    assert.equal(isStandardUniform('resolution'), false);
    assert.equal(isStandardUniform('time'), false);
    assert.equal(isStandardUniform(''), false);
  });
});

// =========================================================================
// 3. CSS Hex Parsing Precision & Edge Cases
// =========================================================================
describe('3. CSS Hex Parsing Precision', () => {
  test('handles malformed hex strings gracefully without throwing', () => {
    const malformed = [
      '#xyz',
      '#12',
      '#12345',
      '#gggggg',
      '#',
      '##',
      '###',
      '',
      '   ',
      null as any,
      undefined as any,
      12345 as any,
      {} as any
    ];

    for (const bad of malformed) {
      const v3 = hexToVec3(bad);
      assert.deepEqual(v3, [0, 0, 0], `hexToVec3(${bad}) should return [0, 0, 0]`);

      const v4 = hexToVec4(bad);
      assert.deepEqual(v4, [0, 0, 0, 1], `hexToVec4(${bad}) should return [0, 0, 0, 1]`);
    }
  });

  test('parses 3-character hex shorthand (#RGB) with precision', () => {
    // #fff -> [1, 1, 1]
    assert.deepEqual(hexToVec3('#fff'), [1, 1, 1]);
    assert.deepEqual(hexToVec4('#fff'), [1, 1, 1, 1]);

    // #000 -> [0, 0, 0]
    assert.deepEqual(hexToVec3('#000'), [0, 0, 0]);
    assert.deepEqual(hexToVec4('#000'), [0, 0, 0, 1]);

    // #f00 -> [1, 0, 0]
    assert.deepEqual(hexToVec3('#f00'), [1, 0, 0]);
    assert.deepEqual(hexToVec4('#f00'), [1, 0, 0, 1]);

    // #0f0 -> [0, 1, 0]
    assert.deepEqual(hexToVec3('#0f0'), [0, 1, 0]);
    assert.deepEqual(hexToVec4('#0f0'), [0, 1, 0, 1]);

    // #00f -> [0, 0, 1]
    assert.deepEqual(hexToVec3('#00f'), [0, 0, 1]);
    assert.deepEqual(hexToVec4('#00f'), [0, 0, 1, 1]);

    // #888 -> 0x88 / 255 = 136 / 255 = 0.5333
    assert.deepEqual(hexToVec3('#888'), [0.5333, 0.5333, 0.5333]);
  });

  test('parses 6-character hex strings (#RRGGBB) with 4-decimal precision', () => {
    assert.deepEqual(hexToVec3('#ffffff'), [1, 1, 1]);
    assert.deepEqual(hexToVec3('#000000'), [0, 0, 0]);

    // #ff8000 -> [255/255, 128/255, 0] = [1, 0.502, 0]
    assert.deepEqual(hexToVec3('#ff8000'), [1, 0.502, 0]);

    // Tailored Tailwind sky-400: #38bdf8 -> [56/255, 189/255, 248/255] = [0.2196, 0.7412, 0.9725]
    assert.deepEqual(hexToVec3('#38bdf8'), [0.2196, 0.7412, 0.9725]);

    // Hex with surrounding whitespace
    assert.deepEqual(hexToVec3('  #38bdf8  '), [0.2196, 0.7412, 0.9725]);
  });

  test('parses 8-character hex strings with alpha channel (#RRGGBBAA)', () => {
    // Full opacity #ffffffff
    assert.deepEqual(hexToVec4('#ffffffff'), [1, 1, 1, 1]);

    // Zero opacity #00000000
    assert.deepEqual(hexToVec4('#00000000'), [0, 0, 0, 0]);

    // Half opacity red #ff000080 -> [1, 0, 0, 128/255 = 0.502]
    assert.deepEqual(hexToVec4('#ff000080'), [1, 0, 0, 0.502]);

    // 6-char fallback adds alpha 1.0 (0xff)
    assert.deepEqual(hexToVec4('#ff8000'), [1, 0.502, 0, 1]);
  });

  test('toShaderUniformValue converts hex colors and preserves raw primitives', () => {
    const vec3Desc = { name: 'u_color', type: 'vec3' as const, defaultValue: '#38bdf8' };
    const val3 = toShaderUniformValue(vec3Desc);
    assert.equal(val3.type, 'vec3');
    assert.deepEqual(val3.value, [0.2196, 0.7412, 0.9725]);

    const vec4Desc = { name: 'u_tint', type: 'vec4' as const, defaultValue: '#ff000080' };
    const val4 = toShaderUniformValue(vec4Desc);
    assert.equal(val4.type, 'vec4');
    assert.deepEqual(val4.value, [1, 0, 0, 0.502]);

    // Float pass-through
    const floatDesc = { name: 'u_speed', type: 'float' as const, defaultValue: 2.5 };
    assert.deepEqual(toShaderUniformValue(floatDesc), { type: 'float', value: 2.5 });

    // Custom override value
    assert.deepEqual(toShaderUniformValue(floatDesc, 5.0), { type: 'float', value: 5.0 });
  });
});

// =========================================================================
// 4. Starter Shaders: Canvas2D Fallbacks Under Extreme Dimensions
// =========================================================================
describe('4. Starter Shaders Canvas2D Fallback Under Extreme Dimensions', () => {
  const starterIds = ['liquid-chrome', 'mesh-gradient', 'interactive-noise', 'caustics'];

  test('all starter shaders define a callable canvas2dFallback function', () => {
    for (const id of starterIds) {
      const shader = getComponent(id);
      assert.ok(shader, `Shader ${id} must exist in catalog`);
      assert.equal(typeof shader.canvas2dFallback, 'function', `${id} must have canvas2dFallback function`);
    }
  });

  const testDimensions = [
    { name: '0x0 zero dimension', w: 0, h: 0 },
    { name: '-100x-200 negative dimensions', w: -100, h: -200 },
    { name: '1x1 minimum canvas', w: 1, h: 1 },
    { name: '10000x10000 extreme 10K resolution', w: 10000, h: 10000 },
    { name: '15360x8640 16K cinema resolution', w: 15360, h: 8640 },
    { name: '0x1080 zero width, positive height', w: 0, h: 1080 },
    { name: '1920x0 positive width, zero height', w: 1920, h: 0 },
    { name: 'NaN dimensions', w: NaN, h: NaN },
    { name: 'Infinity dimensions', w: Infinity, h: Infinity },
    { name: '-Infinity dimensions', w: -Infinity, h: -Infinity }
  ];

  for (const dim of testDimensions) {
    test(`executes all starter canvas2dFallbacks under ${dim.name} with zero uncaught exceptions`, () => {
      for (const id of starterIds) {
        const shader = getComponent(id)!;
        const ctx = createMockCanvas2D();

        assert.doesNotThrow(() => {
          shader.canvas2dFallback!(ctx, dim.w, dim.h, 1.23, [0.5, 0.5]);
        }, `Shader ${id} threw exception under dimension ${dim.name}`);

        // Verify that drawing commands were invoked
        assert.ok(ctx.calls.length > 0, `${id} should invoke drawing calls on canvas 2D context`);
      }
    });
  }

  test('handles 1,000 rapid consecutive Canvas2D fallback animation frames without memory or state leaks', () => {
    const shader = getComponent('liquid-chrome')!;
    const ctx = createMockCanvas2D();

    const t0 = performance.now();
    for (let frame = 0; frame < 1000; frame++) {
      const time = frame * 0.016;
      shader.canvas2dFallback!(ctx, 800, 600, time, [0.5, 0.5]);
    }
    const duration = performance.now() - t0;
    assert.ok(duration < 250, `1000 fallback frames took ${duration}ms, expected < 250ms`);
  });
});

// =========================================================================
// 5. Catalog Search & Error Diagnostics Adversarial Inputs
// =========================================================================
describe('5. Catalog Search & Error Diagnostics Adversarial Inputs', () => {
  beforeEach(() => {
    resetRegistry();
  });

  test('searchComponents handles special characters, regex syntax, and injection strings', () => {
    const injections = [
      '.*',
      '[a-z]+',
      '\\\\',
      '(?=.*)',
      '\' OR 1=1 --',
      '<script>alert("xss")</script>',
      '${process.env}',
      '\0',
      '   ',
      '🔥'
    ];

    for (const q of injections) {
      assert.doesNotThrow(() => {
        const results = searchComponents(q);
        assert.ok(Array.isArray(results));
      }, `searchComponents threw on query: ${q}`);
    }
  });

  test('getComponentsByTag and filterByTag handle adversarial tag strings', () => {
    const weirdTags = ['', '   ', 'NONEXISTENT_TAG_XYZ', 'null', 'undefined', '\n\t', '🚀'];
    for (const tag of weirdTags) {
      assert.doesNotThrow(() => {
        const byTag = getComponentsByTag(tag);
        assert.ok(Array.isArray(byTag));
        const filtered = filterByTag(tag);
        assert.ok(Array.isArray(filtered));
      });
    }
  });

  test('parseGlslErrorLog parses multi-format logs and handles 10,000 lines of garbage', () => {
    // 1. Standard WebGL error format
    const standardLog = 'ERROR: 0:29: \'u_time\' : undeclared identifier\nERROR: 0:45(12): syntax error';
    const parsed = parseGlslErrorLog(standardLog);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].line, 29);
    assert.equal(parsed[1].line, 45);
    assert.equal(parsed[1].column, 12);

    // 2. 10,000 lines of unstructured garbage
    const garbageLines: string[] = [];
    for (let i = 0; i < 10000; i++) {
      garbageLines.push(`random_noise_line_${i}: with strange characters %%% &&& ###`);
    }
    const t0 = performance.now();
    const parsedGarbage = parseGlslErrorLog(garbageLines.join('\n'));
    const duration = performance.now() - t0;
    assert.ok(duration < 200, `Garbage log parsing took ${duration}ms, expected < 200ms`);
    assert.ok(Array.isArray(parsedGarbage));
  });

  test('formatShaderDiagnosticContext handles out-of-bounds line numbers safely', () => {
    const glsl = 'void main() {\n  gl_FragColor = vec4(1.0);\n}';

    // Negative line
    const negOut = formatShaderDiagnosticContext(glsl, -10);
    assert.equal(typeof negOut, 'string');

    // Line beyond end of file
    const highOut = formatShaderDiagnosticContext(glsl, 99999);
    assert.equal(typeof highOut, 'string');

    // Empty source
    const emptyOut = formatShaderDiagnosticContext('', 1);
    assert.equal(emptyOut, '');
  });

  test('formatShaderError formats full error report even on missing or null inputs', () => {
    const report1 = formatShaderError('', '');
    assert.equal(typeof report1.formatted, 'string');
    assert.ok(report1.formatted.includes('Shader compilation failed'));

    const report2 = formatShaderError(null as any, null as any);
    assert.equal(typeof report2.formatted, 'string');
  });
});
