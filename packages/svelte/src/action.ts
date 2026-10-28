import {
  ShaderPipeline,
  type ShaderPipelineOptions
} from '@shaderbit/core';

export interface ShaderActionOptions extends Omit<ShaderPipelineOptions, 'canvas'> {
  component?: {
    id?: string;
    glsl?: string;
    wgsl?: string;
    canvas2dFallback?: (
      ctx: any,
      width: number,
      height: number,
      time: number,
      mouse: [number, number]
    ) => void;
    [key: string]: any;
  };
  onError?: (error: Error) => void;
  onInit?: (pipeline: ShaderPipeline) => void;
}

export interface ShaderActionReturn {
  update(newOptions: Partial<ShaderActionOptions>): void;
  destroy(): void;
  readonly pipeline?: ShaderPipeline | null;
}

/**
 * Svelte Action for binding ShaderPipeline to a <canvas> element.
 * Usage: <canvas use:shaderCanvas={options} />
 */
export function shaderCanvas(
  node: HTMLCanvasElement,
  options: ShaderActionOptions
): ShaderActionReturn {
  let currentOptions = { ...options };
  let disposed = false;
  let pipeline: ShaderPipeline | null = null;

  const createPipeline = (opts: ShaderActionOptions) => {
    if (disposed) return;
    pipeline?.dispose();
    pipeline = null;

    const glsl = opts.glsl ?? opts.component?.glsl;
    const wgsl = opts.wgsl ?? opts.component?.wgsl;
    const canvas2dFallback = opts.canvas2dFallback ?? opts.component?.canvas2dFallback;

    const inst = new ShaderPipeline({
      ...opts,
      canvas: node,
      glsl,
      wgsl,
      canvas2dFallback
    });
    pipeline = inst;

    inst
      .init()
      .then(() => {
        if (disposed || pipeline !== inst) {
          inst.dispose();
          if (pipeline === inst) {
            pipeline = null;
          }
        } else {
          inst.start();
          opts.onInit?.(inst);
        }
      })
      .catch((err) => {
        if (disposed) return;
        const error = err instanceof Error ? err : new Error(String(err));
        opts.onError?.(error);
      });
  };

  createPipeline(currentOptions);

  return {
    get pipeline() {
      return pipeline;
    },
    update(newOptions: Partial<ShaderActionOptions>) {
      if (disposed) return;
      const glslChanged = newOptions.glsl !== undefined && newOptions.glsl !== currentOptions.glsl;
      const wgslChanged = newOptions.wgsl !== undefined && newOptions.wgsl !== currentOptions.wgsl;
      const driverChanged = newOptions.driver !== undefined && newOptions.driver !== currentOptions.driver;
      const compChanged =
        newOptions.component?.id !== currentOptions.component?.id ||
        newOptions.component?.glsl !== currentOptions.component?.glsl;

      currentOptions = { ...currentOptions, ...newOptions };

      if (glslChanged || wgslChanged || driverChanged || compChanged) {
        createPipeline(currentOptions);
      } else if (newOptions.uniforms && pipeline) {
        pipeline.setUniforms(newOptions.uniforms);
      }
    },
    destroy() {
      disposed = true;
      if (pipeline) {
        pipeline.dispose();
        pipeline = null;
      }
    }
  };
}
