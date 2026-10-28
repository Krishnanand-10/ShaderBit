import { useState, useRef, useEffect, type RefObject } from 'react';
import {
  ShaderPipeline,
  type ShaderPipelineOptions,
  type ShaderUniformValue
} from '@shaderbit/core';

export interface UseShaderPipelineOptions extends Omit<ShaderPipelineOptions, 'canvas'> {
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

export interface UseShaderPipelineReturn {
  pipeline: ShaderPipeline | null;
  setUniform: (name: string, value: ShaderUniformValue | any) => void;
  setUniforms: (uniforms: Record<string, ShaderUniformValue | any>) => void;
}

export function useShaderPipeline(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: UseShaderPipelineOptions
): UseShaderPipelineReturn {
  const [pipeline, setPipeline] = useState<ShaderPipeline | null>(null);
  const pipelineRef = useRef<ShaderPipeline | null>(null);

  const glsl = options.glsl ?? options.component?.glsl;
  const wgsl = options.wgsl ?? options.component?.wgsl;
  const canvas2dFallback = options.canvas2dFallback ?? options.component?.canvas2dFallback;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const inst = new ShaderPipeline({
      ...options,
      canvas,
      glsl,
      wgsl,
      canvas2dFallback
    });
    pipelineRef.current = inst;

    inst
      .init()
      .then(() => {
        if (disposed) {
          inst.dispose();
        } else {
          inst.start();
          setPipeline(inst);
          options.onInit?.(inst);
        }
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        options.onError?.(error);
      });

    return () => {
      disposed = true;
      inst.dispose();
      pipelineRef.current = null;
      setPipeline(null);
    };
  }, [
    canvasRef,
    glsl,
    wgsl,
    options.driver,
    options.worker,
    options.workerUrl,
    options.powerPreference,
    options.autoResize,
    options.dpr
  ]);

  // Decoupled uniform synchronization effect (handles high-frequency 120Hz slider updates)
  useEffect(() => {
    if (pipelineRef.current && options.uniforms) {
      pipelineRef.current.setUniforms(options.uniforms);
    }
  }, [options.uniforms]);

  return {
    pipeline,
    setUniform: (name, val) => pipelineRef.current?.setUniform(name, val),
    setUniforms: (uniforms) => pipelineRef.current?.setUniforms(uniforms)
  };
}
