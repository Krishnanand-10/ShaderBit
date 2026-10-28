import type { ShaderComponent } from '@shaderbit/registry';
import type { SupportedFramework } from './config';

export function generateComponent(
  component: ShaderComponent,
  framework: SupportedFramework,
  typescript = true
): { filename: string; content: string } {
  const ext = typescript ? (framework === 'react' ? 'tsx' : 'ts') : (framework === 'react' ? 'jsx' : 'js');
  const filename = `${component.id}.${ext}`;

  let content = '';
  switch (framework) {
    case 'react':
      content = `import React from 'react';\nimport { ShaderCanvas } from '@shaderbit/react';\n\nexport function ${toPascalCase(component.id)}() {\n  return (\n    <ShaderCanvas\n      glsl={\`${component.glsl}\`}\n      wgsl={\`${component.wgsl}\`}\n    />\n  );\n}\n`;
      break;
    case 'vue':
      content = `<template>\n  <ShaderCanvas :glsl="glsl" :wgsl="wgsl" />\n</template>\n\n<script setup${typescript ? ' lang="ts"' : ''}>\nimport { ShaderCanvas } from '@shaderbit/vue';\nconst glsl = \`${component.glsl}\`;\nconst wgsl = \`${component.wgsl}\`;\n</script>\n`;
      break;
    case 'svelte':
      content = `<script${typescript ? ' lang="ts"' : ''}>\n  import { shaderCanvas } from '@shaderbit/svelte';\n  const glsl = \`${component.glsl}\`;\n  const wgsl = \`${component.wgsl}\`;\n</script>\n\n<canvas use:shaderCanvas={{ glsl, wgsl }} />\n`;
      break;
    case 'vanilla':
    default:
      content = `import '@shaderbit/elements';\n\nexport function create${toPascalCase(component.id)}Element() {\n  const el = document.createElement('shader-bit');\n  el.setAttribute('effect', '${component.id}');\n  return el;\n}\n`;
      break;
  }

  return { filename, content };
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
