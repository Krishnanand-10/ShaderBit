import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  type CSSProperties
} from 'react';
import type { ShaderPipeline } from '@shaderbit/core';
import { useShaderPipeline, type UseShaderPipelineOptions } from './useShaderPipeline';

export interface ShaderCanvasProps extends UseShaderPipelineOptions {
  className?: string;
  style?: CSSProperties;
  onInit?: (pipeline: ShaderPipeline) => void;
  onError?: (error: Error) => void;
  [key: string]: any;
}

export const ShaderCanvas = forwardRef<HTMLCanvasElement, ShaderCanvasProps>(
  (props, ref) => {
    const innerRef = useRef<HTMLCanvasElement | null>(null);

    const {
      component,
      glsl,
      wgsl,
      uniforms,
      driver,
      worker,
      workerUrl,
      powerPreference,
      autoResize,
      dpr,
      canvas2dFallback,
      className,
      style,
      onInit,
      onError,
      ...rest
    } = props;

    const { pipeline } = useShaderPipeline(innerRef, {
      component,
      glsl,
      wgsl,
      uniforms,
      driver,
      worker,
      workerUrl,
      powerPreference,
      autoResize,
      dpr,
      canvas2dFallback,
      onInit,
      onError
    });

    useImperativeHandle(ref, () => {
      const el = innerRef.current as any;
      if (el) {
        el.pipeline = pipeline;
        el.canvas = el;
      }
      return el as HTMLCanvasElement;
    }, [pipeline]);

    return React.createElement('canvas', {
      key: props.driver ?? 'auto',
      ref: innerRef,
      className,
      style: { width: '100%', height: '100%', display: 'block', ...style },
      ...rest
    });
  }
);

ShaderCanvas.displayName = 'ShaderCanvas';
