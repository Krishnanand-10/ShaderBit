import { listComponents, type ShaderComponent } from '@shaderbit/registry';

export interface ListCommandOptions {
  json?: boolean;
  category?: string;
  driver?: string;
}

export function listCommand(options: ListCommandOptions = {}): { output: string; data: ShaderComponent[] } {
  let components = listComponents();

  if (options.category) {
    components = components.filter((c) =>
      c.tags.some((t) => t.toLowerCase().includes(options.category!.toLowerCase()))
    );
  }

  if (options.json) {
    return {
      output: JSON.stringify(components, null, 2),
      data: components
    };
  }

  let text = 'ShaderBit Component Registry Catalog:\n';
  text += '------------------------------------------------------------\n';
  for (const c of components) {
    text += `  • ${c.id.padEnd(20)} [${c.name}] - ${c.description}\n`;
    text += `    Tags: ${c.tags.join(', ')} | Drivers: WebGL2, WebGPU, 2D\n`;
  }
  text += '------------------------------------------------------------\n';

  return { output: text, data: components };
}
