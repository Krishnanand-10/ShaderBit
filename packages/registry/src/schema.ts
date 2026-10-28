import { z } from 'zod';
import type { ShaderComponent, UniformDescriptor } from './uniforms';

export const UniformTypeSchema = z.enum(['float', 'vec2', 'vec3', 'vec4', 'int']);

export const UniformDescriptorSchema = z.object({
  name: z.string().min(1, 'Uniform missing name'),
  type: UniformTypeSchema,
  defaultValue: z.any().refine((val) => val !== undefined, {
    message: 'missing defaultValue'
  }),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  description: z.string().optional()
});

export const ShaderComponentSchema = z.object({
  id: z.string().min(1, 'Field "id" is required and must be a string'),
  name: z.string().min(1, 'Field "name" is required and must be a string'),
  description: z.string().optional().default(''),
  version: z.string().optional().default('1.0.0'),
  author: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  glsl: z.string().min(1, 'Field "glsl" is required and must be a string'),
  wgsl: z.string().min(1, 'Field "wgsl" is required and must be a string'),
  canvas2dFallback: z.function().optional(),
  uniforms: z.array(UniformDescriptorSchema).default([]),
  dependencies: z.record(z.string()).optional()
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a component definition without throwing.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateShaderComponent(comp: unknown): ValidationResult {
  const errors: string[] = [];

  if (!comp || typeof comp !== 'object') {
    return { valid: false, errors: ['Component must be a non-null object'] };
  }

  const raw = comp as Record<string, any>;

  if (!raw.id || typeof raw.id !== 'string') {
    errors.push('Field "id" is required and must be a string');
  }
  if (!raw.name || typeof raw.name !== 'string') {
    errors.push('Field "name" is required and must be a string');
  }
  if (!raw.glsl || typeof raw.glsl !== 'string') {
    errors.push('Field "glsl" is required and must be a string');
  }
  if (!raw.wgsl || typeof raw.wgsl !== 'string') {
    errors.push('Field "wgsl" is required and must be a string');
  }

  if (!Array.isArray(raw.uniforms)) {
    errors.push('Field "uniforms" must be an array of uniform descriptors');
  } else {
    for (const u of raw.uniforms) {
      if (!u || typeof u !== 'object') {
        errors.push('Uniform descriptor must be an object');
        continue;
      }
      if (!u.name) {
        errors.push('Uniform missing name');
      }
      if (!u.type || !['float', 'vec2', 'vec3', 'vec4', 'int'].includes(u.type)) {
        errors.push(`Uniform ${u.name || 'unnamed'} has invalid type ${u.type}`);
      }
      if (u.defaultValue === undefined) {
        errors.push(`Uniform ${u.name || 'unnamed'} missing defaultValue`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Strictly parses and validates a component definition, throwing if invalid.
 */
export function validateComponent(data: unknown): ShaderComponent {
  return ShaderComponentSchema.parse(data) as unknown as ShaderComponent;
}
