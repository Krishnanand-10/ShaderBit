import {
  ref,
  watch,
  isRef,
  onMounted,
  onUnmounted,
  type Ref
} from 'vue';
import {
  ShaderPipeline,
  type ShaderPipelineOptions,
  type ShaderUniformValue
} from '@shaderbit/core';

export interface UseShaderCanvasOptions extends Omit<ShaderPipelineOptions, 'canvas'> {
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

export interface UseShaderCanvasReturn {
  pipeline: Ref<ShaderPipeline | null>;
  setUniform: (name: string, value: ShaderUniformValue | any) => void;
  setUniforms: (uniforms: Record<string, ShaderUniformValue | any>) => void;
}

export function useShaderCanvas(
  canvasRef: Ref<HTMLCanvasElement | null | undefined>,
  options:
    | Ref<UseShaderCanvasOptions>
    | UseShaderCanvasOptions
    | (() => UseShaderCanvasOptions)
): UseShaderCanvasReturn {
  const pipeline = ref<ShaderPipeline | null>(null) as Ref<ShaderPipeline | null>;
  let disposed = false;

  const getOptions = (): UseShaderCanvasOptions => {
    if (typeof options === 'function') {
      return options();
    }
    return isRef(options) ? options.value : (options as any).value ?? options;
  };

  const initPipeline = async () => {
    const canvas = canvasRef.value;
    if (!canvas || disposed) return;

    pipeline.value?.dispose();
    pipeline.value = null;

    const opts = getOptions();
    const glsl = opts.glsl ?? opts.component?.glsl;
    const wgsl = opts.wgsl ?? opts.component?.wgsl;
    const canvas2dFallback = opts.canvas2dFallback ?? opts.component?.canvas2dFallback;

    const inst = new ShaderPipeline({
      ...opts,
      canvas,
      glsl,
      wgsl,
      canvas2dFallback
    });

    try {
      await inst.init();
      if (disposed) {
        inst.dispose();
        return;
      }
      inst.start();
      pipeline.value = inst;
      opts.onInit?.(inst);
    } catch (err) {
      if (disposed) return;
      const error = err instanceof Error ? err : new Error(String(err));
      opts.onError?.(error);
    }
  };

  onMounted(() => {
    initPipeline();
  });

  // Watch uniforms reactively with deep watcher (updates uniforms without rebuilding pipeline)
  watch(
    () => getOptions().uniforms,
    (newUniforms) => {
      if (pipeline.value && newUniforms) {
        pipeline.value.setUniforms(newUniforms);
      }
    },
    { deep: true }
  );

  // Watch structural changes (glsl, wgsl, driver, etc.) to re-trigger pipeline init
  watch(
    () => {
      const opts = getOptions();
      return [
        opts.glsl,
        opts.wgsl,
        opts.driver,
        opts.worker,
        opts.component?.id,
        opts.component?.glsl
      ];
    },
    () => {
      if (!disposed) {
        initPipeline();
      }
    }
  );

  onUnmounted(() => {
    disposed = true;
    pipeline.value?.dispose();
    pipeline.value = null;
  });

  return {
    pipeline,
    setUniform: (name, val) => pipeline.value?.setUniform(name, val),
    setUniforms: (uniforms) => pipeline.value?.setUniforms(uniforms)
  };
}
