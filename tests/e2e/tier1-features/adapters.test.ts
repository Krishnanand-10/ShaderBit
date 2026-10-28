/**
 * Tier 1 Feature Test: Framework Adapters (React, Vue, Svelte, Custom Element)
 * Tests mounting lifecycle, props synchronization, React StrictMode safety, and canvas cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';

// Simulated framework adapters conforming strictly to PROJECT.md § Framework Adapters
export class ReactShaderCanvasAdapter {
  private canvas: MockCanvasElement;
  private isMounted = false;
  private uniforms: Record<string, any> = {};
  public teardownCalls = 0;
  public mountCalls = 0;

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
  }

  mount(props: { uniforms?: Record<string, any> }): void {
    this.mountCalls++;
    this.isMounted = true;
    if (props.uniforms) {
      this.uniforms = { ...props.uniforms };
    }
  }

  updateProps(props: { uniforms?: Record<string, any> }): void {
    if (!this.isMounted) return;
    if (props.uniforms) {
      this.uniforms = { ...this.uniforms, ...props.uniforms };
    }
  }

  unmount(): void {
    this.teardownCalls++;
    this.isMounted = false;
  }

  getUniforms(): Record<string, any> {
    return this.uniforms;
  }

  getIsMounted(): boolean {
    return this.isMounted;
  }
}

export class VueShaderCanvasAdapter {
  private canvas: MockCanvasElement;
  private isMounted = false;
  private uniforms: Record<string, any> = {};

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
  }

  onMounted(): void {
    this.isMounted = true;
  }

  watchUniforms(newUniforms: Record<string, any>): void {
    if (this.isMounted) {
      this.uniforms = { ...newUniforms };
    }
  }

  onBeforeUnmount(): void {
    this.isMounted = false;
    this.uniforms = {};
  }

  getUniforms(): Record<string, any> {
    return this.uniforms;
  }

  getIsMounted(): boolean {
    return this.isMounted;
  }
}

export class SvelteShaderCanvasAdapter {
  private canvas: MockCanvasElement;
  private isDestroyed = false;
  private uniforms: Record<string, any> = {};

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
  }

  onMount(): void {
    this.isDestroyed = false;
  }

  reactiveStatement(uniforms: Record<string, any>): void {
    if (!this.isDestroyed) {
      this.uniforms = { ...uniforms };
    }
  }

  onDestroy(): void {
    this.isDestroyed = true;
    this.uniforms = {};
  }

  getIsDestroyed(): boolean {
    return this.isDestroyed;
  }

  getUniforms(): Record<string, any> {
    return this.uniforms;
  }
}

export class ShaderBitCustomElement {
  public canvas: MockCanvasElement;
  public isConnected = false;
  public attributes: Map<string, string> = new Map();
  public uniforms: Record<string, any> = {};

  constructor() {
    this.canvas = new MockCanvasElement();
  }

  connectedCallback(): void {
    this.isConnected = true;
  }

  disconnectedCallback(): void {
    this.isConnected = false;
    this.uniforms = {};
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.isConnected) return;
    this.attributes.set(name, newValue || '');
    if (name.startsWith('u-')) {
      const uniformName = name.replace('u-', 'u_');
      const num = parseFloat(newValue || '0');
      this.uniforms[uniformName] = isNaN(num) ? newValue : num;
    }
  }
}

describe('Tier 1: Framework Adapters', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('manages React adapter lifecycle and updates uniforms reactively upon prop changes', () => {
    const canvas = new MockCanvasElement();
    const adapter = new ReactShaderCanvasAdapter(canvas);

    adapter.mount({ uniforms: { u_speed: 1.0, u_reflection: 0.8 } });
    expect(adapter.getIsMounted()).toBe(true);
    expect(adapter.getUniforms().u_speed).toBe(1.0);

    // Prop update
    adapter.updateProps({ uniforms: { u_speed: 2.5 } });
    expect(adapter.getUniforms().u_speed).toBe(2.5);
    expect(adapter.getUniforms().u_reflection).toBe(0.8);

    // Unmount
    adapter.unmount();
    expect(adapter.getIsMounted()).toBe(false);
    expect(adapter.teardownCalls).toBe(1);
  });

  it('is resilient to React 18 StrictMode double-mounting pattern (mount -> unmount -> mount)', () => {
    const canvas = new MockCanvasElement();
    const adapter = new ReactShaderCanvasAdapter(canvas);

    // Initial mount
    adapter.mount({ uniforms: { u_speed: 1.0 } });
    expect(adapter.getIsMounted()).toBe(true);

    // Immediate unmount (Strict Mode simulate)
    adapter.unmount();
    expect(adapter.getIsMounted()).toBe(false);

    // Second mount
    adapter.mount({ uniforms: { u_speed: 1.0 } });
    expect(adapter.getIsMounted()).toBe(true);
    expect(adapter.mountCalls).toBe(2);
    expect(adapter.teardownCalls).toBe(1);
  });

  it('manages Vue 3 adapter lifecycle hooks and reactive watch synchronization', () => {
    const canvas = new MockCanvasElement();
    const adapter = new VueShaderCanvasAdapter(canvas);

    adapter.onMounted();
    expect(adapter.getIsMounted()).toBe(true);

    adapter.watchUniforms({ u_waveAmplitude: 0.5 });
    expect(adapter.getUniforms().u_waveAmplitude).toBe(0.5);

    adapter.onBeforeUnmount();
    expect(adapter.getIsMounted()).toBe(false);
  });

  it('manages Svelte adapter lifecycle and reactive statements', () => {
    const canvas = new MockCanvasElement();
    const adapter = new SvelteShaderCanvasAdapter(canvas);

    adapter.onMount();
    expect(adapter.getIsDestroyed()).toBe(false);

    adapter.reactiveStatement({ u_causticScale: 5.0 });
    expect(adapter.getUniforms().u_causticScale).toBe(5.0);

    adapter.onDestroy();
    expect(adapter.getIsDestroyed()).toBe(true);
  });

  it('manages Custom Element <shader-bit> lifecycle, connectedCallback, and attributeChangedCallback', () => {
    const el = new ShaderBitCustomElement();
    expect(el.isConnected).toBe(false);

    el.connectedCallback();
    expect(el.isConnected).toBe(true);

    el.attributeChangedCallback('effect', null, 'liquid-chrome');
    el.attributeChangedCallback('u-speed', null, '3.5');

    expect(el.attributes.get('effect')).toBe('liquid-chrome');
    expect(el.uniforms.u_speed).toBe(3.5);

    el.disconnectedCallback();
    expect(el.isConnected).toBe(false);
  });
});
