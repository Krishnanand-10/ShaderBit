import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SupportedFramework } from './config';

export interface ProjectEnvironment {
  framework: SupportedFramework;
  typescript: boolean;
}

export function detectProject(cwd = process.cwd()): ProjectEnvironment {
  let framework: SupportedFramework = 'vanilla';
  let typescript = false;

  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps['react'] || deps['react-dom']) framework = 'react';
      else if (deps['vue']) framework = 'vue';
      else if (deps['svelte']) framework = 'svelte';
    } catch {
      // Ignore JSON parse errors
    }
  }

  if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
    typescript = true;
  }

  return { framework, typescript };
}
