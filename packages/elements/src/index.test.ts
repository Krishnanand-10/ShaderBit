import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ShaderBitElement,
  defineShaderBitElement,
  normalizeUniformName,
  parseAttributeValue
} from './index';

function createMockElement(): ShaderBitElement {
  const el = new ShaderBitElement();
  const attributesMap = new Map<string, string>();

  // Mock DOM properties & methods for node test environment
  (el as any).isConnected = true;
  (el as any).attributes = [];
  (el as any).setAttribute = vi.fn((name: string, val: string) => {
    attributesMap.set(name, String(val));
    (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
  });
  (el as any).getAttribute = vi.fn((name: string) => attributesMap.get(name) || null);
  (el as any).hasAttribute = vi.fn((name: string) => attributesMap.has(name));
  (el as any).removeAttribute = vi.fn((name: string) => {
    attributesMap.delete(name);
    (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
  });
  (el as any).appendChild = vi.fn((child: any) => child);
  return el;
}

describe('@shaderbit/elements', () => {
  beforeEach(() => {
    // Canvas global is provided by setupFiles in vitest config
  });

  it('exports ShaderBitElement class, defineShaderBitElement, and helpers', () => {
    expect(ShaderBitElement).toBeDefined();
    expect(typeof defineShaderBitElement).toBe('function');
    expect(typeof normalizeUniformName).toBe('function');
    expect(typeof parseAttributeValue).toBe('function');
  });

  it('contains structural and starter uniform attributes in observedAttributes', () => {
    const observed = ShaderBitElement.observedAttributes;
    expect(observed).toContain('effect');
    expect(observed).toContain('driver');
    expect(observed).toContain('worker');
    expect(observed).toContain('dpr');
    expect(observed).toContain('glsl');
    expect(observed).toContain('wgsl');
    expect(observed).toContain('uniforms');
    expect(observed).toContain('u-speed');
    expect(observed).toContain('u-waveamplitude');
    expect(observed).toContain('u-wave-amplitude');
    expect(observed).toContain('u-causticscale');
    expect(observed).toContain('u-noisescale');
  });

  it('normalizes uniform attribute names correctly', () => {
    expect(normalizeUniformName('u-speed')).toBe('u_speed');
    expect(normalizeUniformName('u-reflection')).toBe('u_reflection');
    expect(normalizeUniformName('u-waveamplitude')).toBe('u_waveAmplitude');
    expect(normalizeUniformName('u-wave-amplitude')).toBe('u_waveAmplitude');
    expect(normalizeUniformName('u-noisescale')).toBe('u_noiseScale');
    expect(normalizeUniformName('u-noise-scale')).toBe('u_noiseScale');
    expect(normalizeUniformName('u-custom-param')).toBe('u_customParam');
  });

  it('parses attribute values for numbers, booleans, hex colors, and JSON', () => {
    expect(parseAttributeValue('2.5')).toBe(2.5);
    expect(parseAttributeValue('true')).toBe(1);
    expect(parseAttributeValue('false')).toBe(0);
    expect(parseAttributeValue('#ff0000')).toEqual([1, 0, 0]);
    expect(parseAttributeValue('[0.5, 0.5]')).toEqual([0.5, 0.5]);
    expect(parseAttributeValue('{"speed": 1.5}')).toEqual({ speed: 1.5 });
    expect(parseAttributeValue('some-string')).toBe('some-string');
  });

  it('mounts canvas and initializes pipeline on connectedCallback', async () => {
    const el = createMockElement();
    el.setAttribute('effect', 'liquid-chrome');
    el.setAttribute('driver', 'canvas2d');

    el.connectedCallback();
    expect(el.canvas).not.toBeNull();
    expect((el as any).appendChild).toHaveBeenCalledWith(el.canvas);

    // Wait for async mountPipeline
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(el.pipeline).not.toBeNull();
    expect(el.pipeline?.isRunning).toBe(true);

    el.disconnectedCallback();
    expect(el.pipeline).toBeNull();
  });

  it('updates uniforms in-place via attributeChangedCallback without rebuilding pipeline', async () => {
    const el = createMockElement();
    el.setAttribute('effect', 'liquid-chrome');
    el.setAttribute('driver', 'canvas2d');

    el.connectedCallback();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const originalPipeline = el.pipeline;
    expect(originalPipeline).not.toBeNull();

    // In-place uniform update
    el.attributeChangedCallback('u-speed', '1.0', '3.5');
    expect(el.uniforms.u_speed).toBe(3.5);
    expect(el.pipeline).toBe(originalPipeline); // Same instance, not rebuilt
    expect((originalPipeline as any).uniforms.u_speed).toBe(3.5);

    // Multi-uniform JSON update
    el.attributeChangedCallback('uniforms', null, JSON.stringify({ u_reflection: 0.9 }));
    expect(el.uniforms.u_reflection).toBe(0.9);
    expect(el.pipeline).toBe(originalPipeline);

    el.disconnectedCallback();
  });

  it('re-mounts pipeline when structural attributes change', async () => {
    const el = createMockElement();
    el.setAttribute('effect', 'liquid-chrome');
    el.setAttribute('driver', 'canvas2d');

    el.connectedCallback();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const firstPipeline = el.pipeline;
    expect(firstPipeline).not.toBeNull();

    // Structural change: effect switch
    el.setAttribute('effect', 'mesh-gradient');
    el.attributeChangedCallback('effect', 'liquid-chrome', 'mesh-gradient');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(el.pipeline).not.toBeNull();
    expect(el.pipeline).not.toBe(firstPipeline);
    expect(firstPipeline?.isRunning).toBe(false); // Disposed
    expect(el.pipeline?.isRunning).toBe(true);   // Running new

    el.disconnectedCallback();
  });

  it('safely handles rapid disconnect during async mountPipeline without errors', async () => {
    const el = createMockElement();
    el.setAttribute('effect', 'liquid-chrome');
    el.setAttribute('driver', 'canvas2d');

    // Connect and immediately disconnect while init is in-flight
    el.connectedCallback();
    el.disconnectedCallback();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(el.pipeline).toBeNull();
  });

  it('supports imperative setUniform and setUniforms methods', async () => {
    const el = createMockElement();
    el.setAttribute('effect', 'liquid-chrome');
    el.setAttribute('driver', 'canvas2d');

    el.connectedCallback();
    await new Promise((resolve) => setTimeout(resolve, 50));

    el.setUniform('u_custom', 42);
    expect(el.uniforms.u_custom).toBe(42);

    el.setUniforms({ u_a: 1, u_b: 2 });
    expect(el.uniforms.u_a).toBe(1);
    expect(el.uniforms.u_b).toBe(2);

    el.disconnectedCallback();
  });

  it('manages effect getter and setter', () => {
    const el = createMockElement();
    el.effect = 'caustics';
    expect((el as any).setAttribute).toHaveBeenCalledWith('effect', 'caustics');

    el.effect = null;
    expect((el as any).removeAttribute).toHaveBeenCalledWith('effect');
  });
});
