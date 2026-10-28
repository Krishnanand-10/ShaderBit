import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectProject } from '../detector';
import {
  initConfig,
  saveConfig,
  type ShaderbitConfig,
  type SupportedDriver,
  type SupportedFramework
} from '../config';

export interface InitCommandOptions {
  cwd?: string;
  yes?: boolean;
  overwrite?: boolean;
  framework?: SupportedFramework;
  typescript?: boolean;
  componentsDir?: string;
  driver?: SupportedDriver;
}

export async function initCommand(
  options: InitCommandOptions = {}
): Promise<{ success: boolean; configPath: string; config?: ShaderbitConfig; error?: string }> {
  const cwd = options.cwd || process.cwd();
  const configPath = path.join(cwd, 'shaderbit.json');

  if (fs.existsSync(configPath) && !options.overwrite && !options.yes) {
    return {
      success: false,
      configPath,
      error: 'Error: Configuration file shaderbit.json already exists. Use --overwrite or -y to replace.'
    };
  }

  const validFrameworks: SupportedFramework[] = ['react', 'vue', 'svelte', 'vanilla'];
  if (options.framework && !validFrameworks.includes(options.framework)) {
    return {
      success: false,
      configPath,
      error: `Error: Invalid framework '${options.framework}'. Allowed frameworks: ${validFrameworks.join(', ')}`
    };
  }

  const validDrivers: SupportedDriver[] = ['auto', 'webgpu', 'webgl2', 'canvas2d'];
  if (options.driver && !validDrivers.includes(options.driver)) {
    return {
      success: false,
      configPath,
      error: `Error: Invalid driver '${options.driver}'. Allowed drivers: ${validDrivers.join(', ')}`
    };
  }

  const detected = detectProject(cwd);
  const framework = options.framework || detected.framework;
  const typescript = options.typescript !== undefined ? options.typescript : detected.typescript;
  const componentsDir =
    options.componentsDir || (typescript ? '@/components/shaders' : 'src/components/shaders');
  const driver = options.driver || 'auto';

  const config = await initConfig(
    {
      framework,
      typescript,
      paths: {
        components: componentsDir,
        lib: typescript ? '@/lib/shaders' : 'src/lib/shaders'
      },
      driver
    },
    cwd
  );

  await saveConfig(config, cwd);
  return { success: true, configPath, config };
}
