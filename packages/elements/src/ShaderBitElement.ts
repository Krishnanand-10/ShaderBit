import { ShaderPipeline, type DriverType } from '@shaderbit/core';
import { getComponent, hexToVec3 } from '@shaderbit/registry';

// Normalizes HTML attribute name like 'u-wave-amplitude' or 'u-waveamplitude' to 'u_waveAmplitude'
export function normalizeUniformName(attr: string): string {
  const withoutPrefix = attr.replace(/^u-/, '');
  const mapping: Record<string, string> = {
    speed: 'u_speed',
    reflection: 'u_reflection',
    roughness: 'u_roughness',
    waveamplitude: 'u_waveAmplitude',
    'wave-amplitude': 'u_waveAmplitude',
    wave_amplitude: 'u_waveAmplitude',
    color1: 'u_color1',
    color2: 'u_color2',
    color3: 'u_color3',
    color4: 'u_color4',
    'color-a': 'u_color1',
    'color-b': 'u_color2',
    'color-c': 'u_color3',
    'color-d': 'u_color4',
    noisescale: 'u_noiseScale',
    'noise-scale': 'u_noiseScale',
    noise_scale: 'u_noiseScale',
    mouseradius: 'u_mouseRadius',
    'mouse-radius': 'u_mouseRadius',
    mouseintensity: 'u_mouseIntensity',
    'mouse-intensity': 'u_mouseIntensity',
    frequency: 'u_frequency',
    amplitude: 'u_amplitude',
    causticscale: 'u_causticScale',
    'caustic-scale': 'u_causticScale',
    depth: 'u_depth',
    brightness: 'u_brightness'
  };

  const lower = withoutPrefix.toLowerCase();
  if (mapping[lower]) {
    return mapping[lower];
  }
  // Fallback: convert kebab-case to camelCase
  return 'u_' + withoutPrefix.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
}

export function parseAttributeValue(val: string | null): any {
  if (val === null || val === undefined) return 0;
  const trimmed = val.trim();
  if (trimmed === 'true') return 1;
  if (trimmed === 'false') return 0;
  if (trimmed.startsWith('#')) {
    return hexToVec3(trimmed);
  }
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  const num = parseFloat(trimmed);
  return isNaN(num) ? trimmed : num;
}

export class ShaderBitElement extends (typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as any)) {
  private _canvas: HTMLCanvasElement | null = null;
  private pipelineInstance: ShaderPipeline | null = null;
  private isDisposed = false;
  public uniforms: Record<string, any> = {};

  static get observedAttributes(): string[] {
    return [
      'effect',
      'driver',
      'worker',
      'dpr',
      'glsl',
      'wgsl',
      'uniforms',
      // Common starter shader uniform attributes for native HTML reflection
      'u-speed',
      'u-reflection',
      'u-roughness',
      'u-waveamplitude',
      'u-wave-amplitude',
      'u-color1',
      'u-color2',
      'u-color3',
      'u-color4',
      'u-color-a',
      'u-color-b',
      'u-color-c',
      'u-color-d',
      'u-noisescale',
      'u-noise-scale',
      'u-mouseradius',
      'u-mouse-radius',
      'u-mouseintensity',
      'u-mouse-intensity',
      'u-frequency',
      'u-amplitude',
      'u-causticscale',
      'u-caustic-scale',
      'u-depth',
      'u-brightness'
    ];
  }

  connectedCallback(): void {
    if (typeof document === 'undefined') return;
    this.isDisposed = false;

    if (!this._canvas) {
      this._canvas = document.createElement('canvas');
      this._canvas.style.width = '100%';
      this._canvas.style.height = '100%';
      this._canvas.style.display = 'block';

      const targetParent = (this as any).shadowRoot || this;
      if (typeof targetParent.appendChild === 'function') {
        targetParent.appendChild(this._canvas);
      }
    }

    this.extractAttributesToUniforms();
    this.mountPipeline();
  }

  disconnectedCallback(): void {
    this.isDisposed = true;
    if (this.pipelineInstance) {
      this.pipelineInstance.dispose();
      this.pipelineInstance = null;
    }
    this.uniforms = {};
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;

    // 1. Dynamic uniform attribute adjustment (in-place update, preserves active GPU pipeline)
    if (name.startsWith('u-')) {
      const uniformName = normalizeUniformName(name);
      if (newValue !== null && newValue !== undefined) {
        const parsed = parseAttributeValue(newValue);
        this.uniforms[uniformName] = parsed;
        if (this.pipelineInstance) {
          this.pipelineInstance.setUniform(uniformName, parsed);
        }
      }
      return;
    }

    // 2. Multi-uniform JSON attribute
    if (name === 'uniforms' && newValue) {
      try {
        const parsed = JSON.parse(newValue);
        Object.assign(this.uniforms, parsed);
        if (this.pipelineInstance) {
          this.pipelineInstance.setUniforms(parsed);
        }
      } catch (err) {
        console.warn('[shader-bit] Failed to parse JSON uniforms attribute:', err);
      }
      return;
    }

    // 3. Structural attribute changes (rebuild pipeline when element is attached)
    if ((this as any).isConnected) {
      this.mountPipeline();
    }
  }

  private extractAttributesToUniforms(): void {
    const self = this as any;
    const attrs = self.attributes;
    if (!attrs) return;

    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (attr && attr.name && attr.name.startsWith('u-')) {
        const uName = normalizeUniformName(attr.name);
        this.uniforms[uName] = parseAttributeValue(attr.value);
      }
    }

    const jsonUniforms = self.getAttribute?.('uniforms');
    if (jsonUniforms) {
      try {
        Object.assign(this.uniforms, JSON.parse(jsonUniforms));
      } catch {}
    }
  }

  private async mountPipeline(): Promise<void> {
    if (!this._canvas) return;

    if (this.pipelineInstance) {
      this.pipelineInstance.dispose();
      this.pipelineInstance = null;
    }

    const self = this as any;
    const customGlsl = self.getAttribute?.('glsl') || undefined;
    const customWgsl = self.getAttribute?.('wgsl') || undefined;
    const effectId = self.getAttribute?.('effect') || (!customGlsl && !customWgsl ? 'liquid-chrome' : undefined);

    let glsl = customGlsl;
    let wgsl = customWgsl;
    let canvas2dFallback: any = undefined;

    if (effectId) {
      const component = getComponent(effectId);
      if (component) {
        glsl = glsl || component.glsl;
        wgsl = wgsl || component.wgsl;
        canvas2dFallback = component.canvas2dFallback;
      }
    }

    if (!glsl && !wgsl && !canvas2dFallback) return;

    const driverAttr = (self.getAttribute?.('driver') || 'auto') as DriverType;
    const workerAttr = self.hasAttribute?.('worker') && self.getAttribute?.('worker') !== 'false';
    const dprAttr = self.getAttribute?.('dpr') ? parseFloat(self.getAttribute('dpr')) : undefined;

    const pipeline = new ShaderPipeline({
      canvas: this._canvas,
      driver: driverAttr,
      worker: workerAttr,
      dpr: isNaN(dprAttr as number) ? undefined : dprAttr,
      glsl,
      wgsl,
      canvas2dFallback,
      uniforms: { ...this.uniforms }
    });

    this.pipelineInstance = pipeline;

    try {
      await pipeline.init();
      // Guard against race condition: check if disconnected while awaiting init
      if (this.isDisposed || this.pipelineInstance !== pipeline) {
        pipeline.dispose();
        return;
      }
      pipeline.start();
    } catch {
      if (this.isDisposed || this.pipelineInstance !== pipeline) {
        pipeline.dispose();
      }
    }
  }

  get pipeline(): ShaderPipeline | null {
    return this.pipelineInstance;
  }

  get canvas(): HTMLCanvasElement | null {
    return this._canvas;
  }

  set canvas(c: HTMLCanvasElement | null) {
    this._canvas = c;
  }

  get canvasElement(): HTMLCanvasElement | null {
    return this._canvas;
  }

  get effect(): string | null {
    return (this as any).getAttribute?.('effect');
  }

  set effect(val: string | null) {
    const self = this as any;
    if (val) {
      self.setAttribute?.('effect', val);
    } else {
      self.removeAttribute?.('effect');
    }
  }

  public setUniform(name: string, value: any): void {
    this.uniforms[name] = value;
    this.pipelineInstance?.setUniform(name, value);
  }

  public setUniforms(uniforms: Record<string, any>): void {
    Object.assign(this.uniforms, uniforms);
    this.pipelineInstance?.setUniforms(uniforms);
  }
}

export function defineShaderBitElement(tagName = 'shader-bit'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, ShaderBitElement as any);
  }
}

if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
  defineShaderBitElement();
}
