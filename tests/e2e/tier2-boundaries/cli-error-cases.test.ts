/**
 * Tier 2 Boundary Test: CLI Error Handling & Invalid Invocations
 * Tests unknown component names, corrupted configuration files, and invalid CLI options.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import { runAdd } from '../tier1-features/cli-add.test.ts';
import { runInit } from '../tier1-features/cli-init.test.ts';

export function loadAndValidateConfig(configPath: string): { valid: boolean; config?: any; error?: string } {
  if (!fs.existsSync(configPath)) {
    return { valid: false, error: 'Configuration file shaderbit.json does not exist' };
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed.framework || !['react', 'vue', 'svelte', 'vanilla'].includes(parsed.framework)) {
      return { valid: false, error: `Invalid framework specified: ${parsed.framework}` };
    }
    if (!parsed.paths || !parsed.paths.components) {
      return { valid: false, error: 'Missing required configuration field: paths.components' };
    }

    return { valid: true, config: parsed };
  } catch (err: any) {
    return { valid: false, error: `JSON parse error in shaderbit.json: ${err.message}` };
  }
}

describe('Tier 2: CLI Error Handling & Invalid Invocations', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderbit-cli-err-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports descriptive error when adding unknown component name and exits with failure', () => {
    const result = runAdd({
      cwd: tmpDir,
      components: ['non-existent-shader-xyz']
    });

    expect(result.success).toBe(false);
    expect(result.writtenFiles.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Component 'non-existent-shader-xyz' not found in registry");
  });

  it('rejects partially valid component batches when at least one component is unknown', () => {
    const result = runAdd({
      cwd: tmpDir,
      components: ['liquid-chrome', 'invalid-component-123']
    });

    // Should report failure because one of the requested components is invalid
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid-component-123'))).toBe(true);
  });

  it('detects corrupted or unparseable shaderbit.json configuration files', () => {
    const configPath = path.join(tmpDir, 'shaderbit.json');
    fs.writeFileSync(configPath, '{ "framework": "react", broken_json_here: ');

    const res = loadAndValidateConfig(configPath);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('JSON parse error');
  });

  it('validates allowed framework types and rejects unknown frameworks in config', () => {
    const configPath = path.join(tmpDir, 'shaderbit.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        framework: 'angular-unsupported',
        paths: { components: 'src/components' }
      })
    );

    const res = loadAndValidateConfig(configPath);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Invalid framework specified: angular-unsupported');
  });

  it('validates required configuration keys and rejects configs missing paths.components', () => {
    const configPath = path.join(tmpDir, 'shaderbit.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        framework: 'react',
        paths: {}
      })
    );

    const res = loadAndValidateConfig(configPath);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Missing required configuration field: paths.components');
  });
});
