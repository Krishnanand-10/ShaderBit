import { SvelteComponent } from 'svelte';
import type { DriverType, ShaderUniformValue } from '@shaderbit/core';

export interface ShaderCanvasProps {
  component?: any;
  glsl?: string;
  wgsl?: string;
  driver?: DriverType;
  uniforms?: Record<string, ShaderUniformValue | any>;
  worker?: boolean;
  autoResize?: boolean;
  dpr?: number;
  canvas2dFallback?: any;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  class?: string;
  style?: string;
}

export interface ShaderCanvasEvents {
  init: CustomEvent<any>;
  error: CustomEvent<Error>;
}

export interface ShaderCanvasSlots {
  default: {};
}

export class ShaderCanvas extends SvelteComponent<
  ShaderCanvasProps,
  ShaderCanvasEvents,
  ShaderCanvasSlots
> {}
