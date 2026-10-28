/**
 * Tier 3 Pairwise Test: Custom Element <shader-bit> + Dynamic Attribute Reactivity
 * Tests zero-framework Custom Element with attribute mutations and DOM lifecycles.
 */

import { describe, it, expect } from '../harness/test-kit.ts';
import { ShaderBitCustomElement } from '../tier1-features/adapters.test.ts';

describe('Tier 3: Pairwise - Custom Element <shader-bit> + Dynamic Attribute Reactivity', () => {
  it('updates shader uniforms reactively when observed HTML attributes change', () => {
    const el = new ShaderBitCustomElement();
    el.connectedCallback();

    el.attributeChangedCallback('effect', null, 'mesh-gradient');
    el.attributeChangedCallback('u-speed', null, '2.0');
    el.attributeChangedCallback('u-waveAmplitude', null, '0.75');

    expect(el.attributes.get('effect')).toBe('mesh-gradient');
    expect(el.uniforms.u_speed).toBe(2.0);
    expect(el.uniforms.u_waveAmplitude).toBe(0.75);

    // Dynamic attribute change (e.g. document.querySelector('shader-bit').setAttribute('u-speed', '4.0'))
    el.attributeChangedCallback('u-speed', '2.0', '4.0');
    expect(el.uniforms.u_speed).toBe(4.0);

    el.disconnectedCallback();
  });

  it('handles custom element re-attachment to DOM without leaking state', () => {
    const el = new ShaderBitCustomElement();
    el.connectedCallback();
    el.attributeChangedCallback('effect', null, 'caustics');
    expect(el.isConnected).toBe(true);

    // Disconnect (e.g. element moved or conditional DOM branch)
    el.disconnectedCallback();
    expect(el.isConnected).toBe(false);
    expect(Object.keys(el.uniforms)).toHaveLength(0);

    // Re-connect
    el.connectedCallback();
    expect(el.isConnected).toBe(true);
    el.attributeChangedCallback('u-depth', null, '1.8');
    expect(el.uniforms.u_depth).toBe(1.8);

    el.disconnectedCallback();
  });
});
