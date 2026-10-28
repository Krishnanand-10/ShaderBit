<script lang="ts">
  import { shaderCanvas, type ShaderActionOptions } from './action';
  import type { DriverType, ShaderUniformValue } from '@shaderbit/core';

  export let component: any = undefined;
  export let glsl: string | undefined = undefined;
  export let wgsl: string | undefined = undefined;
  export let driver: DriverType = 'auto';
  export let uniforms: Record<string, ShaderUniformValue | any> | undefined = undefined;
  export let worker: boolean = false;
  export let autoResize: boolean = true;
  export let dpr: number | undefined = undefined;
  export let canvas2dFallback: any = undefined;
  export let powerPreference: 'default' | 'high-performance' | 'low-power' = 'default';

  let className: string = '';
  export { className as class };
  export let style: string = '';

  $: actionOptions = {
    component,
    glsl,
    wgsl,
    driver,
    uniforms,
    worker,
    autoResize,
    dpr,
    canvas2dFallback,
    powerPreference
  };
</script>

<canvas
  use:shaderCanvas={actionOptions}
  class={className}
  style={`width: 100%; height: 100%; display: block; ${style}`}
/>
