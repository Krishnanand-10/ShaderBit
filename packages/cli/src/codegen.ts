import type { ShaderComponent, UniformDescriptor } from '@shaderbit/registry';
import type { SupportedFramework } from './config';

export interface GenerateOptions {
  typescript?: boolean;
  adapterMode?: boolean;
}

export function toPascalCase(str: string): string {
  return str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function toPropName(uniformName: string): string {
  const stripped = uniformName.replace(/^u[_-]/, '');
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

export function getFileExtension(framework: SupportedFramework, typescript = true): string {
  switch (framework) {
    case 'react':
      return typescript ? 'tsx' : 'jsx';
    case 'vue':
      return 'vue';
    case 'svelte':
      return 'svelte';
    case 'vanilla':
    default:
      return typescript ? 'ts' : 'js';
  }
}

export function getComponentFilename(
  componentId: string,
  framework: SupportedFramework,
  typescript = true
): string {
  return `${componentId}.${getFileExtension(framework, typescript)}`;
}

function escapeShaderCode(code: string): string {
  return code.replace(/`/g, '\\`').replace(/\${/g, '\\${');
}

function getTsPropType(desc: UniformDescriptor): string {
  switch (desc.type) {
    case 'float':
    case 'int':
      return 'number';
    case 'vec2':
      return '[number, number]';
    case 'vec3':
      return '[number, number, number] | string';
    case 'vec4':
      return '[number, number, number, number] | string';
    default:
      return 'any';
  }
}

function formatDefaultValue(desc: UniformDescriptor): string {
  if (Array.isArray(desc.defaultValue)) {
    return JSON.stringify(desc.defaultValue);
  }
  if (typeof desc.defaultValue === 'number') {
    return Number.isInteger(desc.defaultValue)
      ? `${desc.defaultValue}`
      : `${desc.defaultValue.toFixed(desc.defaultValue.toString().split('.')[1]?.length || 1)}`;
  }
  return JSON.stringify(desc.defaultValue);
}

function hasColorUniforms(uniforms: UniformDescriptor[]): boolean {
  return uniforms.some((u) => u.type === 'vec3' || u.type === 'vec4');
}

export function generateComponent(
  component: ShaderComponent,
  framework: SupportedFramework,
  typescript = true,
  options: GenerateOptions = {}
): { filename: string; content: string } {
  const filename = getComponentFilename(component.id, framework, typescript);
  const pascalName = toPascalCase(component.id);
  const glslEscaped = escapeShaderCode(component.glsl);
  const wgslEscaped = escapeShaderCode(component.wgsl);
  const rawFallback = component.canvas2dFallback ? component.canvas2dFallback.toString() : 'undefined';
  const typedFallback = rawFallback.replace(
    /^\s*\(([^)]*)\)\s*=>/,
    (_, params) => `(${params.split(',').map((p: string) => `${p.trim()}: any`).join(', ')}) =>`
  );
  const fallbackStr =
    typescript && component.canvas2dFallback ? `(${typedFallback}) as any` : rawFallback;
  const uniforms = component.uniforms || [];
  const needsColorParser = hasColorUniforms(uniforms);

  let content = '';

  switch (framework) {
    case 'react':
      content = generateReactComponent({
        component,
        pascalName,
        glslEscaped,
        wgslEscaped,
        fallbackStr,
        uniforms,
        typescript,
        needsColorParser,
        adapterMode: options.adapterMode ?? false
      });
      break;

    case 'vue':
      content = generateVueComponent({
        component,
        pascalName,
        glslEscaped,
        wgslEscaped,
        fallbackStr,
        uniforms,
        typescript,
        needsColorParser,
        adapterMode: options.adapterMode ?? false
      });
      break;

    case 'svelte':
      content = generateSvelteComponent({
        component,
        pascalName,
        glslEscaped,
        wgslEscaped,
        fallbackStr,
        uniforms,
        typescript,
        needsColorParser,
        adapterMode: options.adapterMode ?? false
      });
      break;

    case 'vanilla':
    default:
      content = generateVanillaComponent({
        component,
        pascalName,
        glslEscaped,
        wgslEscaped,
        fallbackStr,
        uniforms,
        typescript,
        needsColorParser
      });
      break;
  }

  return { filename, content };
}

interface GeneratorContext {
  component: ShaderComponent;
  pascalName: string;
  glslEscaped: string;
  wgslEscaped: string;
  fallbackStr: string;
  uniforms: UniformDescriptor[];
  typescript: boolean;
  needsColorParser: boolean;
  adapterMode?: boolean;
}

function generateReactComponent(ctx: GeneratorContext): string {
  const { component, pascalName, glslEscaped, wgslEscaped, fallbackStr, uniforms, typescript, needsColorParser } = ctx;

  const propLines = uniforms
    .map((u) => `  ${toPropName(u.name)}?: ${getTsPropType(u)};`)
    .join('\n');

  const destructureList = [
    ...uniforms.map((u) => `${toPropName(u.name)} = ${formatDefaultValue(u)}`),
    `driver = 'auto'`,
    `worker = false`,
    `dpr`,
    `canvasRef`,
    `className`,
    `style`,
    `...rest`
  ].join(',\n    ');

  const uniformMapLines = uniforms
    .map((u) => {
      const pName = toPropName(u.name);
      if (u.type === 'vec3' || u.type === 'vec4') {
        return `          ${u.name}: parseColor(${pName}) ?? ${formatDefaultValue(u)}`;
      }
      return `          ${u.name}: ${pName}`;
    })
    .join(',\n');

  const propNamesList = uniforms.map((u) => toPropName(u.name)).join(', ');

  const colorParserFn = needsColorParser
    ? `\nfunction parseColor(val${typescript ? '?: [number, number, number] | string' : ''})${typescript ? ': [number, number, number] | undefined' : ''} {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  let hex = val.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255
    ];
  }
  return undefined;
}\n`
    : '';

  if (typescript) {
    return `// Auto-generated by ShaderBit for ${component.name}
import React, { useEffect, useRef } from 'react';
import { ShaderPipeline, type DriverType } from '@shaderbit/core';

export interface ${pascalName}Props extends React.HTMLAttributes<HTMLCanvasElement> {
${propLines}
  driver?: DriverType;
  worker?: boolean;
  dpr?: number;
  canvasRef?: React.Ref<HTMLCanvasElement>;
}

export const ${pascalName}Shaders = {
  glsl: \`${glslEscaped}\`,
  wgsl: \`${wgslEscaped}\`,
  fallback: ${fallbackStr}
};
${colorParserFn}
export function ${pascalName}({
    ${destructureList}
}: ${pascalName}Props) {
  const internalRef = useRef<HTMLCanvasElement | null>(null);
  const pipelineRef = useRef<ShaderPipeline | null>(null);

  // Dynamic uniform synchronization without pipeline rebuild
  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.setUniforms({
${uniformMapLines}
      });
    }
  }, [${propNamesList}]);

  // Canvas engine lifecycle
  useEffect(() => {
    const canvas = internalRef.current;
    if (!canvas) return;

    const pipeline = new ShaderPipeline({
      canvas,
      driver,
      worker,
      dpr,
      glsl: ${pascalName}Shaders.glsl,
      wgsl: ${pascalName}Shaders.wgsl,
      canvas2dFallback: (${pascalName}Shaders.fallback) as any,
      uniforms: {
${uniformMapLines}
      }
    });

    pipelineRef.current = pipeline;
    pipeline.init().then(() => pipeline.start()).catch(console.error);

    return () => {
      pipeline.dispose();
      pipelineRef.current = null;
    };
  }, [driver, worker, dpr]);

  return (
    <canvas
      ref={(el) => {
        internalRef.current = el;
        if (typeof canvasRef === 'function') canvasRef(el);
        else if (canvasRef && typeof canvasRef === 'object' && 'current' in canvasRef) {
          (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
        }
      }}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', ...style }}
      {...rest}
    />
  );
}

${pascalName}.displayName = '${pascalName}';
`;
  }

  // JavaScript React JSX
  return `// Auto-generated by ShaderBit for ${component.name}
import React, { useEffect, useRef } from 'react';
import { ShaderPipeline } from '@shaderbit/core';

export const ${pascalName}Shaders = {
  glsl: \`${glslEscaped}\`,
  wgsl: \`${wgslEscaped}\`,
  fallback: ${fallbackStr}
};
${colorParserFn}
export function ${pascalName}({
    ${destructureList}
}) {
  const internalRef = useRef(null);
  const pipelineRef = useRef(null);

  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.setUniforms({
${uniformMapLines}
      });
    }
  }, [${propNamesList}]);

  useEffect(() => {
    const canvas = internalRef.current;
    if (!canvas) return;

    const pipeline = new ShaderPipeline({
      canvas,
      driver,
      worker,
      dpr,
      glsl: ${pascalName}Shaders.glsl,
      wgsl: ${pascalName}Shaders.wgsl,
      canvas2dFallback: ${pascalName}Shaders.fallback,
      uniforms: {
${uniformMapLines}
      }
    });

    pipelineRef.current = pipeline;
    pipeline.init().then(() => pipeline.start()).catch(console.error);

    return () => {
      pipeline.dispose();
      pipelineRef.current = null;
    };
  }, [driver, worker, dpr]);

  return (
    <canvas
      ref={(el) => {
        internalRef.current = el;
        if (typeof canvasRef === 'function') canvasRef(el);
        else if (canvasRef && typeof canvasRef === 'object' && 'current' in canvasRef) {
          canvasRef.current = el;
        }
      }}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', ...style }}
      {...rest}
    />
  );
}

${pascalName}.displayName = '${pascalName}';
`;
}

function generateVueComponent(ctx: GeneratorContext): string {
  const { component, pascalName, glslEscaped, wgslEscaped, fallbackStr, uniforms, typescript, needsColorParser } = ctx;

  const propLines = uniforms
    .map((u) => `  ${toPropName(u.name)}?: ${getTsPropType(u)};`)
    .join('\n');

  const defaultLines = [
    ...uniforms.map((u) => {
      const p = toPropName(u.name);
      const val = formatDefaultValue(u);
      return Array.isArray(u.defaultValue) ? `  ${p}: () => ${val}` : `  ${p}: ${val}`;
    }),
    `  driver: 'auto'`,
    `  worker: false`
  ].join(',\n');

  const uniformMapLines = uniforms
    .map((u) => {
      const pName = `props.${toPropName(u.name)}`;
      if (u.type === 'vec3' || u.type === 'vec4') {
        return `  ${u.name}: parseColor(${pName}) ?? ${formatDefaultValue(u)}`;
      }
      return `  ${u.name}: ${pName}`;
    })
    .join(',\n');

  const propWatcherList = uniforms.map((u) => `props.${toPropName(u.name)}`).join(', ');

  const colorParserFn = needsColorParser
    ? `\nfunction parseColor(val${typescript ? '?: [number, number, number] | string' : ''})${typescript ? ': [number, number, number] | undefined' : ''} {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  let hex = val.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255
    ];
  }
  return undefined;
}\n`
    : '';

  if (typescript) {
    return `<template>
  <canvas
    ref="canvasRef"
    :class="className"
    :style="[{ width: '100%', height: '100%', display: 'block' }, style]"
  />
</template>

<script setup lang="ts">
// Auto-generated by ShaderBit for ${component.name}
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { ShaderPipeline, type DriverType } from '@shaderbit/core';

export interface ${pascalName}Props {
${propLines}
  driver?: DriverType;
  worker?: boolean;
  dpr?: number;
  className?: string;
  style?: string | Record<string, any>;
}

const props = withDefaults(defineProps<${pascalName}Props>(), {
${defaultLines}
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
let pipeline: ShaderPipeline | null = null;

const glsl = \`${glslEscaped}\`;
const wgsl = \`${wgslEscaped}\`;
const fallback = ${fallbackStr};
${colorParserFn}
const getUniforms = () => ({
${uniformMapLines}
});

onMounted(async () => {
  if (!canvasRef.value) return;

  pipeline = new ShaderPipeline({
    canvas: canvasRef.value,
    driver: props.driver,
    worker: props.worker,
    dpr: props.dpr,
    glsl,
    wgsl,
    canvas2dFallback: (fallback) as any,
    uniforms: getUniforms()
  });

  await pipeline.init();
  pipeline.start();
});

watch(
  () => [${propWatcherList}],
  () => {
    if (pipeline) {
      pipeline.setUniforms(getUniforms());
    }
  }
);

onBeforeUnmount(() => {
  if (pipeline) {
    pipeline.dispose();
    pipeline = null;
  }
});

defineExpose({
  canvas: canvasRef,
  getPipeline: () => pipeline
});
</script>
`;
  }

  // Vue JS
  const jsPropDefs = uniforms
    .map((u) => {
      const p = toPropName(u.name);
      const isArr = Array.isArray(u.defaultValue);
      const def = isArr ? `() => ${formatDefaultValue(u)}` : formatDefaultValue(u);
      const type = isArr ? '[Array, String]' : 'Number';
      return `  ${p}: { type: ${type}, default: ${def} }`;
    })
    .join(',\n');

  return `<template>
  <canvas
    ref="canvasRef"
    :class="className"
    :style="[{ width: '100%', height: '100%', display: 'block' }, style]"
  />
</template>

<script setup>
// Auto-generated by ShaderBit for ${component.name}
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { ShaderPipeline } from '@shaderbit/core';

const props = defineProps({
${jsPropDefs},
  driver: { type: String, default: 'auto' },
  worker: { type: Boolean, default: false },
  dpr: { type: Number, default: undefined },
  className: { type: String, default: '' },
  style: { type: [String, Object], default: () => ({}) }
});

const canvasRef = ref(null);
let pipeline = null;

const glsl = \`${glslEscaped}\`;
const wgsl = \`${wgslEscaped}\`;
const fallback = ${fallbackStr};
${colorParserFn}
const getUniforms = () => ({
${uniformMapLines}
});

onMounted(async () => {
  if (!canvasRef.value) return;

  pipeline = new ShaderPipeline({
    canvas: canvasRef.value,
    driver: props.driver,
    worker: props.worker,
    dpr: props.dpr,
    glsl,
    wgsl,
    canvas2dFallback: fallback,
    uniforms: getUniforms()
  });

  await pipeline.init();
  pipeline.start();
});

watch(
  () => [${propWatcherList}],
  () => {
    if (pipeline) {
      pipeline.setUniforms(getUniforms());
    }
  }
);

onBeforeUnmount(() => {
  if (pipeline) {
    pipeline.dispose();
    pipeline = null;
  }
});

defineExpose({
  canvas: canvasRef,
  getPipeline: () => pipeline
});
</script>
`;
}

function generateSvelteComponent(ctx: GeneratorContext): string {
  const { component, glslEscaped, wgslEscaped, fallbackStr, uniforms, typescript, needsColorParser } = ctx;

  const exportProps = uniforms
    .map((u) => {
      const p = toPropName(u.name);
      const val = formatDefaultValue(u);
      return typescript
        ? `  export let ${p}: ${getTsPropType(u)} = ${val};`
        : `  export let ${p} = ${val};`;
    })
    .join('\n');

  const uniformMapLines = uniforms
    .map((u) => {
      const p = toPropName(u.name);
      if (u.type === 'vec3' || u.type === 'vec4') {
        return `      ${u.name}: parseColor(${p})`;
      }
      return `      ${u.name}: ${p}`;
    })
    .join(',\n');

  const colorParserFn = needsColorParser
    ? `\n  function parseColor(val${typescript ? ': [number, number, number] | string' : ''})${typescript ? ': [number, number, number]' : ''} {
    if (Array.isArray(val)) return val;
    let hex = val.replace('#', '').trim();
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255
      ];
    }
    return [0, 0, 0];
  }\n`
    : '';

  return `<!-- Auto-generated by ShaderBit for ${component.name} -->
<script${typescript ? ' lang="ts"' : ''}>
  import { onMount, onDestroy } from 'svelte';
  import { ShaderPipeline${typescript ? ', type DriverType' : ''} } from '@shaderbit/core';

${exportProps}
  export let driver${typescript ? ': DriverType' : ''} = 'auto';
  export let worker${typescript ? ': boolean' : ''} = false;
  export let dpr${typescript ? ': number | undefined' : ''} = undefined;

  let className${typescript ? ': string' : ''} = '';
  export { className as class };
  export let style${typescript ? ': string' : ''} = '';

  let canvasEl${typescript ? ': HTMLCanvasElement' : ''};
  let pipeline${typescript ? ': ShaderPipeline | null' : ''} = null;

  const glsl = \`${glslEscaped}\`;
  const wgsl = \`${wgslEscaped}\`;
  const fallback = ${fallbackStr};
${colorParserFn}
  $: if (pipeline) {
    pipeline.setUniforms({
${uniformMapLines}
    });
  }

  onMount(async () => {
    if (!canvasEl) return;
    pipeline = new ShaderPipeline({
      canvas: canvasEl,
      driver,
      worker,
      dpr,
      glsl,
      wgsl,
      canvas2dFallback: ${typescript ? '(fallback) as any' : 'fallback'},
      uniforms: {
${uniformMapLines}
      }
    });

    await pipeline.init();
    pipeline.start();
  });

  onDestroy(() => {
    if (pipeline) {
      pipeline.dispose();
      pipeline = null;
    }
  });
</script>

<canvas
  bind:this={canvasEl}
  class={className}
  style={\`width: 100%; height: 100%; display: block; \${style}\`}
/>
`;
}

function generateVanillaComponent(ctx: GeneratorContext): string {
  const { component, pascalName, glslEscaped, wgslEscaped, fallbackStr, uniforms, typescript } = ctx;

  const uniformInitEntries = uniforms
    .map((u) => `    ${u.name}: ${formatDefaultValue(u)}`)
    .join(',\n');

  const observedAttrs = [
    `'driver'`,
    `'worker'`,
    ...uniforms.map((u) => `'u-${toPropName(u.name).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}'`)
  ].join(',\n      ');

  return `// Auto-generated by ShaderBit for ${component.name}
import { ShaderPipeline${typescript ? ', type DriverType' : ''} } from '@shaderbit/core';

export const ${pascalName}Shaders = {
  glsl: \`${glslEscaped}\`,
  wgsl: \`${wgslEscaped}\`,
  fallback: ${fallbackStr}
};

export class ${pascalName}Element extends HTMLElement {
  private pipeline${typescript ? ': ShaderPipeline | null' : ''} = null;
  private canvas${typescript ? ': HTMLCanvasElement' : ''};
  private uniforms${typescript ? ': Record<string, any>' : ''} = {
${uniformInitEntries}
  };

  static get observedAttributes()${typescript ? ': string[]' : ''} {
    return [
      ${observedAttrs}
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.shadowRoot!.appendChild(this.canvas);
  }

  async connectedCallback()${typescript ? ': Promise<void>' : ''} {
    this.extractAttributes();
    this.pipeline = new ShaderPipeline({
      canvas: this.canvas,
      driver: (this.getAttribute('driver')${typescript ? ' as DriverType' : ''}) || 'auto',
      worker: this.hasAttribute('worker'),
      glsl: ${pascalName}Shaders.glsl,
      wgsl: ${pascalName}Shaders.wgsl,
      canvas2dFallback: ${typescript ? `(${pascalName}Shaders.fallback) as any` : `${pascalName}Shaders.fallback`},
      uniforms: this.uniforms
    });

    await this.pipeline.init();
    this.pipeline.start();
  }

  disconnectedCallback()${typescript ? ': void' : ''} {
    if (this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = null;
    }
  }

  attributeChangedCallback(name${typescript ? ': string' : ''}, oldValue${typescript ? ': string | null' : ''}, newValue${typescript ? ': string | null' : ''})${typescript ? ': void' : ''} {
    if (oldValue === newValue || !newValue) return;
    if (name.startsWith('u-')) {
      const uName = this.normalizeUniform(name);
      const val = this.parseValue(newValue);
      this.uniforms[uName] = val;
      if (this.pipeline) {
        this.pipeline.setUniform(uName, val);
      }
    }
  }

  private normalizeUniform(attr${typescript ? ': string' : ''})${typescript ? ': string' : ''} {
    const raw = attr.replace(/^u-/, '');
    return 'u_' + raw.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
  }

  private parseValue(val${typescript ? ': string' : ''})${typescript ? ': any' : ''} {
    if (val.startsWith('#')) {
      let hex = val.replace('#', '').trim();
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16) / 255,
          parseInt(hex.slice(2, 4), 16) / 255,
          parseInt(hex.slice(4, 6), 16) / 255
        ];
      }
    }
    const num = parseFloat(val);
    return isNaN(num) ? val : num;
  }

  private extractAttributes()${typescript ? ': void' : ''} {
    for (const attr of Array.from(this.attributes)) {
      if (attr.name.startsWith('u-')) {
        this.uniforms[this.normalizeUniform(attr.name)] = this.parseValue(attr.value);
      }
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('shader-${component.id}')) {
  customElements.define('shader-${component.id}', ${pascalName}Element);
}

export function create${pascalName}Element(props${typescript ? '?: Record<string, any>' : ''})${typescript ? ': HTMLElement' : ''} {
  const el = document.createElement('shader-${component.id}');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      const attr = k.startsWith('u-') ? k : \`u-\${k.replace(/[A-Z]/g, (m) => \`-\${m.toLowerCase()}\`)}\`;
      el.setAttribute(attr, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  }
  return el;
}
`;
}
