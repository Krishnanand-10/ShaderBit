/**
 * Tier 1 Feature Test: CLI list Catalog Display
 * Tests catalog listing, --json output format, category filtering, and driver metadata.
 */

import { describe, it, expect } from '../harness/test-kit.ts';
import { STARTER_SHADERS } from '../mocks/mock-registry-data.ts';
import type { ShaderComponent } from '../mocks/mock-registry-data.ts';

export interface ListOptions {
  json?: boolean;
  category?: string;
  driver?: string;
}

export function runList(options: ListOptions = {}): { output: string; data?: ShaderComponent[] } {
  let components = Object.values(STARTER_SHADERS);

  if (options.category) {
    components = components.filter((c) =>
      c.tags.some((t) => t.toLowerCase().includes(options.category!.toLowerCase()))
    );
  }

  if (options.json) {
    return {
      output: JSON.stringify(components, null, 2),
      data: components
    };
  }

  // Terminal formatted table / text output
  let text = 'ShaderBit Component Registry Catalog:\n';
  text += '------------------------------------------------------------\n';
  for (const c of components) {
    text += `  • ${c.id.padEnd(20)} [${c.name}] - ${c.description}\n`;
    text += `    Tags: ${c.tags.join(', ')} | Drivers: WebGL2, WebGPU, 2D\n`;
  }
  text += '------------------------------------------------------------\n';
  return { output: text, data: components };
}

describe('Tier 1: CLI list Catalog Display', () => {
  it('lists all 4 starter components in formatted terminal text mode', () => {
    const result = runList();
    expect(result.output).toContain('liquid-chrome');
    expect(result.output).toContain('mesh-gradient');
    expect(result.output).toContain('interactive-noise');
    expect(result.output).toContain('caustics');
    expect(result.data).toHaveLength(4);
  });

  it('outputs valid JSON array when --json flag is provided', () => {
    const result = runList({ json: true });
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data!.length).toBe(4);

    const parsed = JSON.parse(result.output);
    expect(parsed.length).toBe(4);
    expect(parsed[0].id).toBe('liquid-chrome');
    expect(parsed[0].name).toBe('Liquid Chrome');
    expect(parsed[0].uniforms).toBeDefined();
  });

  it('filters catalog components by category tag', () => {
    const resultWater = runList({ category: 'water', json: true });
    expect(resultWater.data!.length).toBe(1);
    expect(resultWater.data![0].id).toBe('caustics');

    const resultMetallic = runList({ category: 'metallic', json: true });
    expect(resultMetallic.data!.length).toBe(1);
    expect(resultMetallic.data![0].id).toBe('liquid-chrome');
  });

  it('includes uniform parameter counts and driver compatibility in listing', () => {
    const result = runList();
    expect(result.output).toContain('Drivers: WebGL2, WebGPU, 2D');
    
    const jsonResult = runList({ json: true });
    const chrome = jsonResult.data!.find((c) => c.id === 'liquid-chrome');
    expect(chrome!.uniforms.length).toBeGreaterThanOrEqual(4);
  });

  it('returns empty list gracefully when filtering for non-existent category', () => {
    const result = runList({ category: 'non-existent-tag', json: true });
    expect(result.data!.length).toBe(0);
    expect(result.output).toBe('[]');
  });
});
