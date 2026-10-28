#!/usr/bin/env node
import { Command } from 'commander';
import prompts from 'prompts';
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
  return listComponents().map((c) => c.id);
}

export async function addShaderComponent(
  componentId: string,
  options?: { cwd?: string; overwrite?: boolean; dir?: string; framework?: any }
): Promise<void> {
  const res = await addCommand(componentId, options);
  if (!res.success) {
    throw new Error(res.errors.join('\n'));
  }
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
    .option('--components-dir <dir>', 'Components directory (alias)')
    .option('--ts, --typescript', 'Use TypeScript')
    .option('--js, --javascript', 'Use JavaScript')
    .action(async (opts) => {
      try {
        let typescript: boolean | undefined = undefined;
        if (opts.typescript) typescript = true;
        if (opts.javascript) typescript = false;

        const res = await initCommand({
          yes: opts.yes,
          overwrite: opts.overwrite,
          framework: opts.framework,
          driver: opts.driver,
          componentsDir: opts.dir || opts.componentsDir,
          typescript
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
    .option('-d, --driver <driver>', 'Filter by driver support (webgl2, webgpu, canvas2d)')
    .action(async (opts) => {
      const res = listCommand({
        json: opts.json,
        category: opts.category,
        driver: opts.driver
      });
      console.log(res.output);
    });

  program
    .command('add [components...]')
    .description('Add shader component(s) to your project')
    .option('-o, --overwrite', 'Overwrite existing files')
    .option('-d, --dir <dir>', 'Custom output directory')
    .option('-f, --framework <framework>', 'Target framework (react, vue, svelte, vanilla)')
    .option('--all', 'Add all available shader components')
    .action(async (components: string[], opts) => {
      try {
        let targets = components || [];

        if (targets.length === 0 && !opts.all) {
          if (process.stdin.isTTY) {
            const response = await prompts({
              type: 'multiselect',
              name: 'selected',
              message: 'Select shader components to add:',
              choices: listComponents().map((c) => ({
                title: `${c.name} (${c.id})`,
                value: c.id
              }))
            });

            if (response.selected && response.selected.length > 0) {
              targets = response.selected;
            } else {
              console.log('No components selected.');
              return;
            }
          } else {
            console.error('Error: Please specify at least one component name or use --all');
            process.exit(1);
          }
        }

        const res = await addCommand(opts.all ? undefined : targets, {
          overwrite: opts.overwrite,
          dir: opts.dir,
          framework: opts.framework,
          all: opts.all
        });

        if (res.success) {
          console.log(`Added component(s): ${res.writtenFiles.join(', ')}`);
        } else {
          for (const err of res.errors) {
            console.error(err);
          }
          process.exit(1);
        }
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
