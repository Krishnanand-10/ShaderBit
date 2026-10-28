import * as fs from 'node:fs';
import * as path from 'node:path';
import { getComponent, listComponents } from '@shaderbit/registry';
import { loadConfig } from '../config';
import { generateComponent } from '../codegen';

export interface AddCommandOptions {
  cwd?: string;
  overwrite?: boolean;
}

export async function addCommand(
  componentId: string,
  options: AddCommandOptions = {}
): Promise<{ success: boolean; filePath: string }> {
  const cwd = options.cwd || process.cwd();
  const component = getComponent(componentId);

  if (!component) {
    const available = listComponents().map(c => c.id).join(', ');
    throw new Error(`Component "${componentId}" not found in registry. Available components: ${available}`);
  }

  const config = (await loadConfig(cwd)) || {
    framework: 'react',
    typescript: true,
    paths: { components: 'src/components/shaders', lib: 'src/lib/shaders' },
    driver: 'auto'
  };

  const { filename, content } = generateComponent(component, config.framework, config.typescript);
  const targetDir = path.resolve(cwd, config.paths.components.replace(/^@\//, 'src/'));

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, filename);
  if (fs.existsSync(filePath) && !options.overwrite) {
    throw new Error(`File "${filePath}" already exists. Use --overwrite to replace.`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return { success: true, filePath };
}
