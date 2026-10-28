import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getComponent } from '@shaderbit/registry';
import {
  listAvailableShaders,
  createCli,
  initConfig,
  saveConfig,
  loadConfig,
  loadAndValidateConfig,
  validateConfig,
  detectProject,
  generateComponent,
  getFileExtension,
  initCommand,
  listCommand,
  addCommand,
  addShaderComponent
} from './index';

describe('@shaderbit/cli unit & integration tests', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shaderbit-cli-unit-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('1. Catalog & Listing', () => {
    it('lists available shaders from registry', () => {
      const list = listAvailableShaders();
      expect(list).toContain('liquid-chrome');
      expect(list).toContain('mesh-gradient');
      expect(list).toContain('interactive-noise');
      expect(list).toContain('caustics');
    });

    it('formats catalog in listCommand text mode', () => {
      const textRes = listCommand();
      expect(textRes.output).toContain('liquid-chrome');
      expect(textRes.output).toContain('Drivers: WebGL2, WebGPU, 2D');
      expect(textRes.data.length).toBeGreaterThanOrEqual(4);
    });

    it('formats catalog in listCommand JSON mode', () => {
      const jsonRes = listCommand({ json: true });
      const parsed = JSON.parse(jsonRes.output);
      expect(parsed).toHaveLength(4);
      expect(parsed[0].id).toBe('liquid-chrome');
      expect(parsed[0].uniforms).toBeDefined();
    });

    it('filters components by category tag', () => {
      const waterRes = listCommand({ category: 'water', json: true });
      expect(waterRes.data).toHaveLength(1);
      expect(waterRes.data[0].id).toBe('caustics');

      const nonExistent = listCommand({ category: 'non-existent-tag', json: true });
      expect(nonExistent.data).toHaveLength(0);
      expect(nonExistent.output).toBe('[]');
    });

    it('filters components by driver capability', () => {
      const webgpuRes = listCommand({ driver: 'webgpu', json: true });
      expect(webgpuRes.data.length).toBeGreaterThanOrEqual(4);

      const canvas2dRes = listCommand({ driver: 'canvas2d', json: true });
      expect(canvas2dRes.data.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('2. Configuration & Validation', () => {
    it('initializes default and custom config objects', async () => {
      const config = await initConfig({ framework: 'vue', driver: 'webgpu' });
      expect(config.framework).toBe('vue');
      expect(config.driver).toBe('webgpu');
      expect(config.typescript).toBe(true);
      expect(config.paths.components).toBe('@/components/shaders');
    });

    it('saves and loads config cleanly', async () => {
      const config = await initConfig({ framework: 'react' }, tmpDir);
      const savedPath = await saveConfig(config, tmpDir);
      expect(fs.existsSync(savedPath)).toBe(true);

      const loaded = await loadConfig(tmpDir);
      expect(loaded).toBeDefined();
      expect(loaded?.framework).toBe('react');
    });

    it('returns error when config file does not exist', () => {
      const res = loadAndValidateConfig(path.join(tmpDir, 'nonexistent.json'));
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Configuration file shaderbit.json does not exist');
    });

    it('detects corrupted or unparseable JSON in shaderbit.json', () => {
      const configPath = path.join(tmpDir, 'shaderbit.json');
      fs.writeFileSync(configPath, '{ "framework": "react", broken_json_here: ');

      const res = loadAndValidateConfig(configPath);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('JSON parse error in shaderbit.json:');
    });

    it('validates allowed framework types and rejects invalid ones', () => {
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
      expect(res.error).toBe('Invalid framework specified: angular-unsupported');
    });

    it('validates required configuration keys and rejects missing paths.components', () => {
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
      expect(res.error).toBe('Missing required configuration field: paths.components');
    });

    it('validates configuration object directly via validateConfig', () => {
      const invalidRes = validateConfig({ framework: 'react', paths: {} });
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.error).toBe('Missing required configuration field: paths.components');

      const validRes = validateConfig({
        framework: 'react',
        typescript: true,
        paths: { components: 'src/components/shaders' },
        driver: 'auto'
      });
      expect(validRes.valid).toBe(true);
      expect(validRes.config?.framework).toBe('react');
    });
  });

  describe('3. Environment Detection', () => {
    it('detects React project with TypeScript', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' } })
      );
      fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');

      const env = detectProject(tmpDir);
      expect(env.framework).toBe('react');
      expect(env.typescript).toBe(true);
    });

    it('detects Vue project without TypeScript', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { vue: '^3.4.0' } })
      );

      const env = detectProject(tmpDir);
      expect(env.framework).toBe('vue');
      expect(env.typescript).toBe(false);
    });

    it('detects Svelte project from devDependencies', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ devDependencies: { svelte: '^4.0.0' } })
      );

      const env = detectProject(tmpDir);
      expect(env.framework).toBe('svelte');
      expect(env.typescript).toBe(false);
    });

    it('defaults to vanilla when no framework is recognized', () => {
      const env = detectProject(tmpDir);
      expect(env.framework).toBe('vanilla');
      expect(env.typescript).toBe(false);
    });
  });

  describe('4. Standalone Code Generation', () => {
    it('resolves correct file extensions per framework', () => {
      expect(getFileExtension('react', true)).toBe('tsx');
      expect(getFileExtension('react', false)).toBe('jsx');
      expect(getFileExtension('vue', true)).toBe('vue');
      expect(getFileExtension('vue', false)).toBe('vue');
      expect(getFileExtension('svelte', true)).toBe('svelte');
      expect(getFileExtension('svelte', false)).toBe('svelte');
      expect(getFileExtension('vanilla', true)).toBe('ts');
      expect(getFileExtension('vanilla', false)).toBe('js');
    });

    it('generates standalone React component with @shaderbit/core and embedded shaders', () => {
      const comp = getComponent('liquid-chrome')!;
      const { filename, content } = generateComponent(comp, 'react', true);

      expect(filename).toBe('liquid-chrome.tsx');
      expect(content).toContain('export function LiquidChrome');
      expect(content).toContain('@shaderbit/core');
      expect(content).toContain('#version 300 es');
      expect(content).toContain('setUniforms');
      expect(content).not.toContain('three');
      expect(content).not.toContain('babylon');
    });

    it('generates standalone Vue 3 SFC component with <template> and <script setup>', () => {
      const comp = getComponent('mesh-gradient')!;
      const { filename, content } = generateComponent(comp, 'vue', true);

      expect(filename).toBe('mesh-gradient.vue');
      expect(content).toContain('<template>');
      expect(content).toContain('<script setup lang="ts">');
      expect(content).toContain('@shaderbit/core');
      expect(content).toContain('onMounted');
      expect(content).toContain('onBeforeUnmount');
      expect(content).not.toContain('three');
    });

    it('generates standalone Svelte component with canvas binding and lifecycle', () => {
      const comp = getComponent('interactive-noise')!;
      const { filename, content } = generateComponent(comp, 'svelte', true);

      expect(filename).toBe('interactive-noise.svelte');
      expect(content).toContain('<script lang="ts">');
      expect(content).toContain('@shaderbit/core');
      expect(content).toContain('onMount');
      expect(content).toContain('onDestroy');
      expect(content).toContain('<canvas');
    });

    it('generates vanilla Custom Element component', () => {
      const comp = getComponent('caustics')!;
      const { filename, content } = generateComponent(comp, 'vanilla', true);

      expect(filename).toBe('caustics.ts');
      expect(content).toContain('CausticsElement extends HTMLElement');
      expect(content).toContain('customElements.define');
      expect(content).toContain('createCausticsElement');
    });
  });

  describe('5. CLI Commands Execution', () => {
    it('executes initCommand and writes shaderbit.json', async () => {
      const res = await initCommand({
        cwd: tmpDir,
        framework: 'react',
        typescript: true,
        componentsDir: 'src/components/shaders'
      });

      expect(res.success).toBe(true);
      expect(fs.existsSync(res.configPath)).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(res.configPath, 'utf8'));
      expect(parsed.framework).toBe('react');
      expect(parsed.paths.components).toBe('src/components/shaders');
    });

    it('aborts initCommand if shaderbit.json already exists without overwrite flag', async () => {
      await initCommand({ cwd: tmpDir, framework: 'react' });

      const second = await initCommand({ cwd: tmpDir, framework: 'vue' });
      expect(second.success).toBe(false);
      expect(second.error).toContain('already exists. Use --overwrite or -y to replace.');

      const overwrite = await initCommand({ cwd: tmpDir, framework: 'vue', overwrite: true });
      expect(overwrite.success).toBe(true);
      expect(overwrite.config?.framework).toBe('vue');
    });

    it('executes addCommand for single component', async () => {
      await initCommand({ cwd: tmpDir, framework: 'react', typescript: true });

      const res = await addCommand('liquid-chrome', { cwd: tmpDir });
      expect(res.success).toBe(true);
      expect(res.writtenFiles.length).toBe(1);
      expect(fs.existsSync(res.writtenFiles[0])).toBe(true);

      const content = fs.readFileSync(res.writtenFiles[0], 'utf8');
      expect(content).toContain('LiquidChrome');
    });

    it('executes addCommand for multiple components in batch', async () => {
      await initCommand({ cwd: tmpDir, framework: 'react', typescript: true });

      const res = await addCommand(['mesh-gradient', 'caustics'], { cwd: tmpDir });
      expect(res.success).toBe(true);
      expect(res.writtenFiles.length).toBe(2);
      expect(fs.existsSync(res.writtenFiles[0])).toBe(true);
      expect(fs.existsSync(res.writtenFiles[1])).toBe(true);
    });

    it('rejects batch atomically if any component is invalid', async () => {
      await initCommand({ cwd: tmpDir, framework: 'react', typescript: true });

      const res = await addCommand(['liquid-chrome', 'unknown-effect-999'], { cwd: tmpDir });
      expect(res.success).toBe(false);
      expect(res.writtenFiles.length).toBe(0);
      expect(res.errors[0]).toContain("Component 'unknown-effect-999' not found in registry");
      expect(res.errors[0]).toContain('Available components: liquid-chrome, mesh-gradient, interactive-noise, caustics');
    });

    it('guards against accidental overwrite in addCommand', async () => {
      await initCommand({ cwd: tmpDir, framework: 'react', typescript: true });

      const first = await addCommand('caustics', { cwd: tmpDir });
      expect(first.success).toBe(true);

      const second = await addCommand('caustics', { cwd: tmpDir });
      expect(second.success).toBe(false);
      expect(second.errors[0]).toContain('already exists. Use --overwrite to replace.');

      const overwrite = await addCommand('caustics', { cwd: tmpDir, overwrite: true });
      expect(overwrite.success).toBe(true);
    });

    it('creates nested target directory recursively', async () => {
      await initCommand({ cwd: tmpDir, framework: 'react', typescript: true });

      const res = await addCommand('liquid-chrome', {
        cwd: tmpDir,
        dir: 'deeply/nested/custom/dir'
      });
      expect(res.success).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'deeply/nested/custom/dir/liquid-chrome.tsx'))).toBe(true);
    });

    it('executes addShaderComponent wrapper', async () => {
      await initCommand({ cwd: tmpDir, framework: 'react', typescript: true });
      await expect(addShaderComponent('liquid-chrome', { cwd: tmpDir })).resolves.not.toThrow();
      await expect(addShaderComponent('nonexistent', { cwd: tmpDir })).rejects.toThrow('not found in registry');
    });

    it('creates commander CLI instance with expected commands and options', () => {
      const cli = createCli();
      expect(cli.name()).toBe('shaderbit');
      const commandNames = cli.commands.map((c) => c.name());
      expect(commandNames).toContain('init');
      expect(commandNames).toContain('list');
      expect(commandNames).toContain('add');
    });
  });

  describe('6. Milestone 5 Remediation Features', () => {
    it('supports 3-character hex shorthand in generated parseColor and parseValue functions', () => {
      const comp = getComponent('liquid-chrome')!;
      for (const framework of ['react', 'vue', 'svelte', 'vanilla'] as const) {
        const { content } = generateComponent(comp, framework, true);
        expect(content).toContain('hex.length === 3');
      }
    });

    it('casts canvas2dFallback with as any in generated TypeScript templates', () => {
      const comp = getComponent('liquid-chrome')!;
      for (const framework of ['react', 'vue', 'svelte', 'vanilla'] as const) {
        const { content } = generateComponent(comp, framework, true);
        expect(content).toContain('as any');
      }
    });

    it('validates framework option in initCommand and rejects invalid framework', async () => {
      const res = await initCommand({ cwd: tmpDir, framework: 'angular' as any });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid framework 'angular'");
      expect(res.error).toContain('Allowed frameworks: react, vue, svelte, vanilla');
    });

    it('validates driver option in initCommand and rejects invalid driver', async () => {
      const res = await initCommand({ cwd: tmpDir, driver: 'vulkan' as any });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid driver 'vulkan'");
      expect(res.error).toContain('Allowed drivers: auto, webgpu, webgl2, canvas2d');
    });

    it('validates framework option in addCommand and rejects invalid framework', async () => {
      const res = await addCommand('liquid-chrome', { cwd: tmpDir, framework: 'angular' as any });
      expect(res.success).toBe(false);
      expect(res.errors[0]).toContain("Invalid framework specified: angular");
      expect(res.errors[0]).toContain('Allowed frameworks: react, vue, svelte, vanilla');
    });

    it('aborts addCommand with error when shaderbit.json exists but is invalid', async () => {
      const configPath = path.join(tmpDir, 'shaderbit.json');
      fs.writeFileSync(configPath, '{ "framework": "invalid-framework", "paths": {} }');

      const res = await addCommand('liquid-chrome', { cwd: tmpDir });
      expect(res.success).toBe(false);
      expect(res.errors[0]).toContain('Invalid configuration in shaderbit.json:');
    });

    it('filters out unsupported drivers in listCommand, returning 0 components', () => {
      const metalRes = listCommand({ driver: 'metal', json: true });
      expect(metalRes.data.length).toBe(0);

      const autoRes = listCommand({ driver: 'auto', json: true });
      expect(autoRes.data.length).toBeGreaterThanOrEqual(4);
    });
  });
});
