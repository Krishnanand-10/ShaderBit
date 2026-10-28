/**
 * Tier 1 Feature Test: CLI init & Configuration
 * Tests project framework detection, config generation, CLI options, and overwrite guards.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';

// CLI init simulation logic conforming to PROJECT.md interface contract
export interface InitOptions {
  cwd: string;
  framework?: 'react' | 'vue' | 'svelte' | 'vanilla';
  typescript?: boolean;
  componentsDir?: string;
  driver?: 'auto' | 'webgpu' | 'webgl2' | 'canvas2d';
  yes?: boolean;
  overwrite?: boolean;
}

export function detectProject(cwd: string): { framework: 'react' | 'vue' | 'svelte' | 'vanilla'; typescript: boolean } {
  let framework: 'react' | 'vue' | 'svelte' | 'vanilla' = 'vanilla';
  let typescript = false;

  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps['react'] || deps['react-dom']) framework = 'react';
      else if (deps['vue']) framework = 'vue';
      else if (deps['svelte']) framework = 'svelte';
    } catch {}
  }

  if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
    typescript = true;
  }

  return { framework, typescript };
}

export function runInit(options: InitOptions): { success: boolean; configPath: string; config?: any; error?: string } {
  const configPath = path.join(options.cwd, 'shaderbit.json');

  if (fs.existsSync(configPath) && !options.overwrite && !options.yes) {
    return {
      success: false,
      configPath,
      error: 'Error: Configuration file shaderbit.json already exists. Use --overwrite or -y to replace.'
    };
  }

  const detected = detectProject(options.cwd);
  const framework = options.framework || detected.framework;
  const typescript = options.typescript !== undefined ? options.typescript : detected.typescript;
  const componentsDir = options.componentsDir || (typescript ? '@/components/shaders' : 'src/components/shaders');
  const driver = options.driver || 'auto';

  const config = {
    $schema: 'https://shaderbit.dev/schema.json',
    framework,
    typescript,
    paths: {
      components: componentsDir,
      lib: typescript ? '@/lib/shaders' : 'src/lib/shaders'
    },
    driver
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return { success: true, configPath, config };
}

describe('Tier 1: CLI init & Configuration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderbit-init-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects React project with TypeScript from package.json and tsconfig.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' } })
    );
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));

    const result = runInit({ cwd: tmpDir });
    expect(result.success).toBe(true);
    expect(result.config.framework).toBe('react');
    expect(result.config.typescript).toBe(true);
    expect(result.config.paths.components).toBe('@/components/shaders');
  });

  it('detects Vue project without TypeScript and defaults to JS paths', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { vue: '^3.4.0' } })
    );

    const result = runInit({ cwd: tmpDir });
    expect(result.success).toBe(true);
    expect(result.config.framework).toBe('vue');
    expect(result.config.typescript).toBe(false);
    expect(result.config.paths.components).toBe('src/components/shaders');
  });

  it('detects Svelte project and writes valid shaderbit.json schema', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { svelte: '^4.0.0' } })
    );
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');

    const result = runInit({ cwd: tmpDir });
    expect(result.success).toBe(true);
    expect(result.config.framework).toBe('svelte');
    expect(result.config.$schema).toBe('https://shaderbit.dev/schema.json');
    expect(result.config.driver).toBe('auto');
  });

  it('honors explicit CLI override flags (--framework, --driver, --dir)', () => {
    const result = runInit({
      cwd: tmpDir,
      framework: 'vanilla',
      typescript: true,
      driver: 'webgpu',
      componentsDir: 'custom/shaders'
    });

    expect(result.success).toBe(true);
    expect(result.config.framework).toBe('vanilla');
    expect(result.config.driver).toBe('webgpu');
    expect(result.config.paths.components).toBe('custom/shaders');
  });

  it('aborts with error if shaderbit.json already exists without overwrite flag', () => {
    // First init
    const firstResult = runInit({ cwd: tmpDir });
    expect(firstResult.success).toBe(true);

    // Second init without overwrite
    const secondResult = runInit({ cwd: tmpDir, framework: 'vue' });
    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toContain('already exists');

    // Overwrite with flag
    const overwriteResult = runInit({ cwd: tmpDir, framework: 'vue', overwrite: true });
    expect(overwriteResult.success).toBe(true);
    expect(overwriteResult.config.framework).toBe('vue');
  });
});
