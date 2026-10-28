import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

export type SupportedFramework = 'react' | 'vue' | 'svelte' | 'vanilla';
export type SupportedDriver = 'auto' | 'webgpu' | 'webgl2' | 'canvas2d';

export interface ShaderbitPaths {
  components: string;
  lib?: string;
}

export interface ShaderbitConfig {
  $schema?: string;
  framework: SupportedFramework;
  typescript: boolean;
  paths: ShaderbitPaths;
  driver: SupportedDriver;
}

export const SupportedFrameworkSchema = z.enum(['react', 'vue', 'svelte', 'vanilla']);
export const SupportedDriverSchema = z.enum(['auto', 'webgpu', 'webgl2', 'canvas2d']);

export const ShaderbitPathsSchema = z.object({
  components: z.string().min(1, 'Missing required configuration field: paths.components'),
  lib: z.string().optional()
});

export const ShaderbitConfigSchema = z.object({
  $schema: z.string().optional(),
  framework: SupportedFrameworkSchema,
  typescript: z.boolean().default(true),
  paths: ShaderbitPathsSchema,
  driver: SupportedDriverSchema.default('auto')
});

export function validateConfig(data: unknown): { valid: boolean; config?: ShaderbitConfig; error?: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Invalid configuration format: expected an object' };
  }

  const raw = data as Record<string, any>;

  if (!raw.framework || !['react', 'vue', 'svelte', 'vanilla'].includes(raw.framework)) {
    return { valid: false, error: `Invalid framework specified: ${raw.framework}` };
  }

  if (!raw.paths || typeof raw.paths !== 'object' || !raw.paths.components) {
    return { valid: false, error: 'Missing required configuration field: paths.components' };
  }

  const result = ShaderbitConfigSchema.safeParse(data);
  if (!result.success) {
    return { valid: false, error: result.error.issues[0]?.message || 'Configuration validation error' };
  }

  return { valid: true, config: result.data as ShaderbitConfig };
}

export function loadAndValidateConfig(
  configPath: string
): { valid: boolean; config?: ShaderbitConfig; error?: string } {
  if (!fs.existsSync(configPath)) {
    return { valid: false, error: 'Configuration file shaderbit.json does not exist' };
  }

  let parsed: unknown;
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err: any) {
    return { valid: false, error: `JSON parse error in shaderbit.json: ${err.message}` };
  }

  return validateConfig(parsed);
}

export async function loadConfig(cwd = process.cwd()): Promise<ShaderbitConfig | null> {
  const configPath = path.join(cwd, 'shaderbit.json');
  const res = loadAndValidateConfig(configPath);
  return res.valid ? res.config! : null;
}

export async function initConfig(
  options: Partial<ShaderbitConfig>,
  cwd = process.cwd()
): Promise<ShaderbitConfig> {
  const typescript = options.typescript ?? true;
  const config: ShaderbitConfig = {
    $schema: 'https://shaderbit.dev/schema.json',
    framework: options.framework || 'react',
    typescript,
    paths: options.paths || {
      components: typescript ? '@/components/shaders' : 'src/components/shaders',
      lib: typescript ? '@/lib/shaders' : 'src/lib/shaders'
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
