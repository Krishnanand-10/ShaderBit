import * as fs from 'node:fs';
import * as path from 'node:path';
import { getComponent, listComponents } from '@shaderbit/registry';
import { loadAndValidateConfig, type ShaderbitConfig, type SupportedFramework } from '../config';
import { generateComponent } from '../codegen';

export interface AddCommandOptions {
  cwd?: string;
  dir?: string;
  framework?: SupportedFramework;
  typescript?: boolean;
  overwrite?: boolean;
  all?: boolean;
}

export async function addCommand(
  componentIdOrIds?: string | string[],
  options: AddCommandOptions = {}
): Promise<{ success: boolean; writtenFiles: string[]; errors: string[]; filePath?: string }> {
  const cwd = options.cwd || process.cwd();

  const validFrameworks: SupportedFramework[] = ['react', 'vue', 'svelte', 'vanilla'];
  if (options.framework && !validFrameworks.includes(options.framework)) {
    return {
      success: false,
      writtenFiles: [],
      errors: [
        `Invalid framework specified: ${options.framework}. Allowed frameworks: ${validFrameworks.join(', ')}`
      ]
    };
  }

  let components: string[] = [];
  if (options.all) {
    components = listComponents().map((c) => c.id);
  } else if (typeof componentIdOrIds === 'string') {
    components = [componentIdOrIds];
  } else if (Array.isArray(componentIdOrIds)) {
    components = componentIdOrIds;
  }

  if (components.length === 0) {
    return {
      success: false,
      writtenFiles: [],
      errors: ['No components specified']
    };
  }

  // Atomically pre-validate all requested components against registry
  const missing: string[] = [];
  for (const id of components) {
    if (!getComponent(id)) {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    const available = listComponents().map((c) => c.id).join(', ');
    const errors = missing.map(
      (id) => `Component '${id}' not found in registry. Available components: ${available}`
    );
    return {
      success: false,
      writtenFiles: [],
      errors
    };
  }

  const configPath = path.join(cwd, 'shaderbit.json');
  let config: ShaderbitConfig | null = null;
  if (fs.existsSync(configPath)) {
    const validated = loadAndValidateConfig(configPath);
    if (!validated.valid) {
      return {
        success: false,
        writtenFiles: [],
        errors: [`Invalid configuration in shaderbit.json: ${validated.error}`]
      };
    }
    config = validated.config!;
  }
  const framework: SupportedFramework =
    options.framework || config?.framework || 'react';
  const typescript: boolean =
    options.typescript !== undefined
      ? options.typescript
      : (config?.typescript ?? true);

  const rawDir =
    options.dir ||
    config?.paths?.components ||
    (typescript ? '@/components/shaders' : 'src/components/shaders');
  const targetDir = path.resolve(cwd, rawDir.replace(/^@\//, 'src/'));

  // Pre-validate overwrite collisions across all files
  if (!options.overwrite) {
    const collisions: string[] = [];
    for (const id of components) {
      const comp = getComponent(id)!;
      const { filename } = generateComponent(comp, framework, typescript);
      const filePath = path.join(targetDir, filename);
      if (fs.existsSync(filePath)) {
        collisions.push(`Error: File '${filePath}' already exists. Use --overwrite to replace.`);
      }
    }

    if (collisions.length > 0) {
      return {
        success: false,
        writtenFiles: [],
        errors: collisions
      };
    }
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const writtenFiles: string[] = [];
  for (const id of components) {
    const comp = getComponent(id)!;
    const { filename, content } = generateComponent(comp, framework, typescript);
    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    writtenFiles.push(filePath);
  }

  return {
    success: true,
    writtenFiles,
    errors: [],
    filePath: writtenFiles[0]
  };
}
