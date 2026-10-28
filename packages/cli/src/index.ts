#!/usr/bin/env node
import { Command } from 'commander';
import { listComponents } from '@shaderbit/registry';
import { initCommand } from './commands/init';
import { listCommand } from './commands/list';
import { addCommand } from './commands/add';

export * from './config';
export * from './detector';
export * from './codegen';
export * from './commands/init';
export * from './commands/list';
export * from './commands/add';

export function listAvailableShaders(): string[] {
  return listComponents().map(c => c.id);
}

export async function addShaderComponent(
  componentId: string,
  options?: { cwd?: string; overwrite?: boolean }
): Promise<void> {
  await addCommand(componentId, options);
}

export function createCli(): Command {
  const program = new Command();
  program
    .name('shaderbit')
    .description('Zero-dependency GPU shader component registry CLI')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize ShaderBit in your project')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('-o, --overwrite', 'Overwrite existing shaderbit.json')
    .option('-f, --framework <framework>', 'Target framework (react, vue, svelte, vanilla)')
    .option('-d, --driver <driver>', 'Default driver (auto, webgpu, webgl2, canvas2d)')
    .option('--dir <dir>', 'Components directory')
    .action(async (opts) => {
      try {
        const res = await initCommand({
          yes: opts.yes,
          overwrite: opts.overwrite,
          framework: opts.framework,
          driver: opts.driver,
          componentsDir: opts.dir
        });
        if (res.success) {
          console.log(`ShaderBit initialized at ${res.configPath}`);
        } else {
          console.error(res.error);
          process.exit(1);
        }
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  program
    .command('list')
    .description('List available shader components')
    .option('--json', 'Output catalog in JSON format')
    .option('-c, --category <category>', 'Filter by category tag')
    .action(async (opts) => {
      const res = listCommand({ json: opts.json, category: opts.category });
      console.log(res.output);
    });

  program
    .command('add <component>')
    .description('Add a shader component to your project')
    .option('-o, --overwrite', 'Overwrite existing files')
    .action(async (component, opts) => {
      try {
        const res = await addCommand(component, { overwrite: opts.overwrite });
        console.log(`Added ${component} -> ${res.filePath}`);
      } catch (err: any) {
        console.error(err.message);
        process.exit(1);
      }
    });

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createCli();
  await program.parseAsync(argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
