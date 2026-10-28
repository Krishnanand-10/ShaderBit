import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ShaderbitPaths {
  components: string;
  lib: string;
}

export type SupportedFramework = 'react' | 'vue' | 'svelte' | 'vanilla';
export type SupportedDriver = 'auto' | 'webgpu' | 'webgl2' | 'canvas2d';

export interface ShaderbitConfig {
  $schema?: string;
  framework: SupportedFramework;
  typescript: boolean;
  paths: ShaderbitPaths;
  driver: SupportedDriver;
}

export async function loadConfig(cwd = process.cwd()): Promise<ShaderbitConfig | null> {
  const configPath = path.join(cwd, 'shaderbit.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as ShaderbitConfig;
  } catch {
    return null;
  }
}

export async function initConfig(
  options: Partial<ShaderbitConfig>,
  cwd = process.cwd()
): Promise<ShaderbitConfig> {
  const config: ShaderbitConfig = {
    $schema: 'https://shaderbit.dev/schema.json',
    framework: options.framework || 'react',
    typescript: options.typescript ?? true,
    paths: options.paths || {
      components: options.typescript ? '@/components/shaders' : 'src/components/shaders',
      lib: options.typescript ? '@/lib/shaders' : 'src/lib/shaders'
    },
    driver: options.driver || 'auto'
  };
  return config;
}

export async function saveConfig(
  config: ShaderbitConfig,
  cwd = process.cwd()
): Promise<string> {
  const configPath = path.join(cwd, 'shaderbit.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return configPath;
}
