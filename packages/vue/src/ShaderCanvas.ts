import {
  defineComponent,
  ref,
  h,
  type PropType
} from 'vue';
import type { DriverType, ShaderPipeline, ShaderUniformValue } from '@shaderbit/core';
import { useShaderCanvas } from './useShaderCanvas';

export const ShaderCanvas = defineComponent({
  name: 'ShaderCanvas',
  props: {
    component: { type: Object as PropType<any>, required: false },
    glsl: { type: String, required: false },
    wgsl: { type: String, required: false },
    uniforms: { type: Object as PropType<Record<string, ShaderUniformValue | any>>, required: false },
    driver: { type: String as PropType<DriverType>, default: 'auto' },
    worker: { type: Boolean, default: false },
    autoResize: { type: Boolean, default: true },
    dpr: { type: Number, required: false },
    canvas2dFallback: { type: Function as PropType<any>, required: false },
    class: { type: String, required: false },
    style: { type: [String, Object], required: false }
  },
  emits: ['init', 'error'],
  setup(props, { emit, expose }) {
    const canvasEl = ref<HTMLCanvasElement | null>(null);

    const { pipeline, setUniform, setUniforms } = useShaderCanvas(canvasEl, () => ({
      ...(props as any),
      onInit: (inst: ShaderPipeline) => {
        emit('init', inst);
      },
      onError: (err: Error) => {
        emit('error', err);
      }
    }));

    expose({ pipeline, canvas: canvasEl, setUniform, setUniforms });

    return () =>
      h('canvas', {
        ref: canvasEl,
        class: props.class,
        style: [
          { width: '100%', height: '100%', display: 'block' },
          props.style
        ]
      });
  }
});
