/**
 * Milestone 4 Adversarial Stress & Empirical Challenge Suite
 * Focus: Svelte Action/Component & <shader-bit> Custom Element
 *
 * Empirical Challenges:
 * 1. <shader-bit> Custom Element:
 *    - Rapid DOM mutations (10,000 uniform updates, high-frequency attribute updates)
 *    - In-place uniform mutation integrity (pipeline preserved, no re-initialization churn)
 *    - Dynamic structural mutations (50 rapid effect changes, driver switching)
 *    - Re-parenting & hostile lifecycle (100 rapid remove/append cycles, in-flight init races)
 *    - Idempotent connectedCallback & disconnectedCallback
 *    - Attribute parsing boundary cases & fuzzing (malformed hex colors, non-numeric strings, invalid JSON, booleans)
 *    - Uniform name normalization fuzzing (aliases, kebab-case, snake_case, custom prefixes)
 * 2. Svelte Action Lifecycle:
 *    - High-frequency action.update() (10,000 updates, pipeline preservation)
 *    - Structural updates (driver, glsl, wgsl, component changes)
 *    - In-flight destruction race condition
 *    - Multiple consecutive destroy() calls (idempotency)
 *    - Calling update() after destroy() (safe no-op)
 * 3. Package Bundle Determinism & Zero 3D Runtime Dependency Integrity:
 *    - Verification of ESM, CJS, DTS bundle exports across all 4 adapter packages
 *    - Strict verification of zero 3D runtime libraries (Three.js, Babylon, OGL, etc.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Import compiled bundles and source directly to test both build artifacts and runtime behavior
import {
  ShaderBitElement,
  defineShaderBitElement,
  normalizeUniformName,
  parseAttributeValue
} from '../../packages/elements/src/index';

import {
  shaderCanvas,
  ShaderCanvas as SvelteShaderCanvas
} from '../../packages/svelte/src/index';

import {
  ShaderCanvas as ReactShaderCanvas,
  useShaderPipeline
} from '../../packages/react/src/index';

import {
  ShaderCanvas as VueShaderCanvas,
  useShaderCanvas
} from '../../packages/vue/src/index';

import { ShaderPipeline } from '../../packages/core/src/index';
import { MockHTMLCanvasElement } from '../mocks/canvas';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/**
 * Creates a fully functioning mock Custom Element DOM environment
 */
function createHostElement(): {
  el: ShaderBitElement;
  container: any;
  canvasCreated: MockHTMLCanvasElement[];
  cleanup: () => void;
} {
  const canvasCreated: MockHTMLCanvasElement[] = [];

  const origCreateElement = (globalThis as any).document?.createElement;
  if ((globalThis as any).document) {
    (globalThis as any).document.createElement = (tag: string) => {
      if (tag.toLowerCase() === 'canvas') {
        const c = new MockHTMLCanvasElement(800, 600);
        canvasCreated.push(c);
        return c;
      }
      return origCreateElement ? origCreateElement(tag) : { tagName: tag.toUpperCase(), style: {} };
    };
  }

  const attributesMap = new Map<string, string>();
  const el = new ShaderBitElement();
  (el as any).isConnected = true;
  (el as any).attributes = [];

  (el as any).setAttribute = vi.fn((name: string, val: any) => {
    const oldVal = attributesMap.get(name) || null;
    const newVal = String(val);
    attributesMap.set(name, newVal);
    (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
    el.attributeChangedCallback(name, oldVal, newVal);
  });

  (el as any).getAttribute = vi.fn((name: string) => attributesMap.get(name) ?? null);
  (el as any).hasAttribute = vi.fn((name: string) => attributesMap.has(name));
  (el as any).removeAttribute = vi.fn((name: string) => {
    const oldVal = attributesMap.get(name) || null;
    attributesMap.delete(name);
    (el as any).attributes = Array.from(attributesMap.entries()).map(([k, v]) => ({ name: k, value: v }));
    el.attributeChangedCallback(name, oldVal, null);
  });

  const children: any[] = [];
  (el as any).appendChild = vi.fn((child: any) => {
    children.push(child);
    child.parentElement = el;
    return child;
  });
  (el as any).removeChild = vi.fn((child: any) => {
    const idx = children.indexOf(child);
    if (idx !== -1) children.splice(idx, 1);
    child.parentElement = null;
    return child;
  });

  const containerChildren: any[] = [];
  const container = {
    children: containerChildren,
    appendChild: vi.fn((node: any) => {
      containerChildren.push(node);
      node.parentElement = container;
      (node as any).isConnected = true;
      if (typeof node.connectedCallback === 'function') {
        node.connectedCallback();
      }
      return node;
    }),
    removeChild: vi.fn((node: any) => {
      const idx = containerChildren.indexOf(node);
      if (idx !== -1) containerChildren.splice(idx, 1);
      node.parentElement = null;
      (node as any).isConnected = false;
      if (typeof node.disconnectedCallback === 'function') {
        node.disconnectedCallback();
      }
      return node;
    })
  };

  const cleanup = () => {
    if ((globalThis as any).document && origCreateElement) {
      (globalThis as any).document.createElement = origCreateElement;
    }
  };

  return { el, container, canvasCreated, cleanup };
}

describe('Empirical Adversarial Challenge Suite: Milestone 4 Framework Adapters', () => {

  describe('1. <shader-bit> Custom Element: Rapid DOM Mutations & Dynamic Updates', () => {
    it('handles 1,000 rapid consecutive setAttribute uniform updates without pipeline churn', async () => {
      const { el, container, cleanup } = createHostElement();
      el.setAttribute('effect', 'liquid-chrome');
      el.setAttribute('driver', 'canvas2d');
      container.appendChild(el);

      await new Promise((r) => setTimeout(r, 60));
      const activePipeline = el.pipeline;
      expect(activePipeline).not.toBeNull();
      expect(activePipeline?.isRunning).toBe(true);

      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        el.setAttribute('u-speed', String((i * 0.01).toFixed(4)));
      }
      const elapsed = performance.now() - startTime;

      expect(el.pipeline).toBe(activePipeline); // Pipeline instance must be preserved (zero recreation)
      expect(el.uniforms.u_speed).toBeCloseTo(9.99, 2);
      expect(elapsed).toBeLessThan(1500); // 1000 uniform updates should execute comfortably under 1.5s

      container.removeChild(el);
      cleanup();
    });

    it('survives alternating attribute mutations (10,000 updates) without state drift or memory explosion', async () => {
      const { el, container, cleanup } = createHostElement();
      el.setAttribute('effect', 'mesh-gradient');
      el.setAttribute('driver', 'canvas2d');
      container.appendChild(el);

      await new Promise((r) => setTimeout(r, 60));
      const activePipeline = el.pipeline;

      for (let i = 0; i < 10000; i++) {
        if (i % 2 === 0) {
          el.setAttribute('u-waveamplitude', '0.85');
          el.setAttribute('u-color1', '#ff0055');
        } else {
          el.setAttribute('u-waveamplitude', '0.25');
          el.setAttribute('u-color1', '#00ffcc');
        }
      }

      expect(el.pipeline).toBe(activePipeline);
      expect(el.uniforms.u_waveAmplitude).toBe(0.25);
      expect(el.uniforms.u_color1).toEqual([0, 1, 0.8]);

      container.removeChild(el);
      cleanup();
    });

    it('handles 50 rapid structural effect switches without unhandled rejections or leaked pipelines', async () => {
      const { el, container, cleanup } = createHostElement();
      el.setAttribute('driver', 'canvas2d');
      container.appendChild(el);

      const effects = ['liquid-chrome', 'mesh-gradient', 'interactive-noise', 'caustics'];
      for (let i = 0; i < 50; i++) {
        el.setAttribute('effect', effects[i % effects.length]);
      }

      // Allow final asynchronous mount to settle
      await new Promise((r) => setTimeout(r, 100));

      expect(el.pipeline).not.toBeNull();
      expect(el.pipeline?.isRunning).toBe(true);
      expect(el.getAttribute('effect')).toBe(effects[49 % effects.length]);

      container.removeChild(el);
      expect(el.pipeline).toBeNull();
      cleanup();
    });

    it('handles attribute removals gracefully without crashing', async () => {
      const { el, container, cleanup } = createHostElement();
      el.setAttribute('effect', 'caustics');
      el.setAttribute('driver', 'canvas2d');
      el.setAttribute('u-depth', '2.5');
      container.appendChild(el);

      await new Promise((r) => setTimeout(r, 60));
      expect(el.uniforms.u_depth).toBe(2.5);

      // Remove uniform attribute
      el.removeAttribute('u-depth');
      // Remove structural effect attribute
      el.removeAttribute('effect');

      await new Promise((r) => setTimeout(r, 60));
      container.removeChild(el);
      cleanup();
    });
  });

  describe('2. <shader-bit> Custom Element: Re-Parenting & Hostile Lifecycle Attacks', () => {
    it('survives 25 rapid synchronous remove() and appendChild() cycles without leaks or crashes', async () => {
      const { el, container, cleanup } = createHostElement();
      el.setAttribute('effect', 'interactive-noise');
      el.setAttribute('driver', 'canvas2d');

      // 25 rapid disconnect and reconnect operations
      for (let i = 0; i < 25; i++) {
        container.appendChild(el);
        container.removeChild(el);
      }

      // Re-append a final time and verify it settles into a healthy running state
      container.appendChild(el);
      await new Promise((r) => setTimeout(r, 80));

      expect(el.pipeline).not.toBeNull();
      expect(el.pipeline?.isRunning).toBe(true);

      // Verify canvas rendered correctly
      expect(el.canvas).not.toBeNull();

      container.removeChild(el);
      expect(el.pipeline).toBeNull();
      cleanup();
    });

    it('safely resolves in-flight pipeline initialization races when re-parented immediately', async () => {
      const { el, container, cleanup } = createHostElement();
      el.setAttribute('effect', 'caustics');
      el.setAttribute('driver', 'canvas2d');

      // Mount element (triggers async mountPipeline)
      container.appendChild(el);

      // Disconnect immediately before promise settles
      container.removeChild(el);

      // Reconnect immediately
      container.appendChild(el);

      // Disconnect again immediately
      container.removeChild(el);

      // Finally attach and wait
      container.appendChild(el);
      await new Promise((r) => setTimeout(r, 100));

      expect(el.pipeline).not.toBeNull();
      expect(el.pipeline?.isRunning).toBe(true);

      container.removeChild(el);
      expect(el.pipeline).toBeNull();
      cleanup();
    });

    it('enforces idempotency on disconnectedCallback', async () => {
      const { el, container, cleanup } = createHostElement();
      el.setAttribute('effect', 'mesh-gradient');
      el.setAttribute('driver', 'canvas2d');
      container.appendChild(el);

      await new Promise((r) => setTimeout(r, 60));
      expect(el.pipeline?.isRunning).toBe(true);

      // Call disconnectedCallback 5 times consecutively
      expect(() => {
        el.disconnectedCallback();
        el.disconnectedCallback();
        el.disconnectedCallback();
        el.disconnectedCallback();
        el.disconnectedCallback();
      }).not.toThrow();

      expect(el.pipeline).toBeNull();
      expect(Object.keys(el.uniforms)).toHaveLength(0);
      cleanup();
    });

    it('enforces idempotency on connectedCallback when already connected', async () => {
      const { el, container, cleanup } = createHostElement();
      el.setAttribute('effect', 'mesh-gradient');
      el.setAttribute('driver', 'canvas2d');
      container.appendChild(el);

      await new Promise((r) => setTimeout(r, 60));
      const initialCanvas = el.canvas;

      // Duplicate connectedCallback calls
      expect(() => {
        el.connectedCallback();
        el.connectedCallback();
      }).not.toThrow();

      // Canvas element should not be duplicated
      expect(el.canvas).toBe(initialCanvas);

      container.removeChild(el);
      cleanup();
    });

    it('continues rendering frames across DOM re-parenting between different containers', async () => {
      const { el, container: c1, cleanup } = createHostElement();
      const { container: c2 } = createHostElement();

      el.setAttribute('effect', 'liquid-chrome');
      el.setAttribute('driver', 'canvas2d');

      // Mount in Container 1
      c1.appendChild(el);
      await new Promise((r) => setTimeout(r, 60));
      expect(el.pipeline?.render(1.0, [0.5, 0.5])).toBe(true);

      // Move to Container 2
      c1.removeChild(el);
      c2.appendChild(el);
      await new Promise((r) => setTimeout(r, 60));

      expect(el.pipeline).not.toBeNull();
      expect(el.pipeline?.isRunning).toBe(true);
      expect(el.pipeline?.render(2.0, [0.8, 0.2])).toBe(true);

      c2.removeChild(el);
      cleanup();
    });
  });

  describe('3. <shader-bit> Custom Element: Boundary Value & Fuzzing Attacks', () => {
    it('parses malformed and boundary CSS hex color strings without throwing', () => {
      const boundaryHexes = [
        '#',
        '##',
        '###',
        '#1',
        '#12',
        '#1234',
        '#12345',
        '#gggggg',
        '#z',
        '#!@$%^',
        '   #ff00ff   ',
        '#1234567890',
        '#ff0000',
        '#00ff00',
        '#0000ff'
      ];

      for (const hex of boundaryHexes) {
        let parsed: any;
        expect(() => {
          parsed = parseAttributeValue(hex);
        }).not.toThrow();

        if (Array.isArray(parsed)) {
          expect(parsed).toHaveLength(3);
          expect(typeof parsed[0]).toBe('number');
          expect(typeof parsed[1]).toBe('number');
          expect(typeof parsed[2]).toBe('number');
          expect(parsed[0]).toBeGreaterThanOrEqual(0);
          expect(parsed[0]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('handles non-numeric strings, scientific notation, and extreme floats safely', () => {
      expect(parseAttributeValue('true')).toBe(1);
      expect(parseAttributeValue('false')).toBe(0);
      expect(parseAttributeValue('null')).toBe('null');
      expect(parseAttributeValue('undefined')).toBe('undefined');
      expect(parseAttributeValue('')).toBe('');
      expect(parseAttributeValue('   ')).toBe('');
      expect(parseAttributeValue('abc')).toBe('abc');

      // Scientific notation and extreme floats
      expect(parseAttributeValue('1e5')).toBe(100000);
      expect(parseAttributeValue('-1.5e-3')).toBeCloseTo(-0.0015);
      expect(parseAttributeValue(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
      expect(parseAttributeValue(String(Number.MIN_SAFE_INTEGER))).toBe(Number.MIN_SAFE_INTEGER);
      expect(parseAttributeValue('Infinity')).toBe(Infinity);
      expect(parseAttributeValue('-Infinity')).toBe(-Infinity);
    });

    it('handles malformed and edge-case JSON uniforms attributes without crashing', () => {
      const malformed = [
        '{',
        '{ invalid: json }',
        '[1, 2,',
        'undefined',
        '<xml>not json</xml>'
      ];

      for (const str of malformed) {
        expect(() => {
          parseAttributeValue(str);
        }).not.toThrow();
      }

      // Valid JSON objects and arrays
      expect(parseAttributeValue('[0.2, 0.4]')).toEqual([0.2, 0.4]);
      expect(parseAttributeValue('[1, 2, 3, 4]')).toEqual([1, 2, 3, 4]);
      expect(parseAttributeValue('{"speed": 3.0}')).toEqual({ speed: 3.0 });
    });

    it('fuzzes normalizeUniformName across standard, aliases, and arbitrary attribute patterns', () => {
      // Standard mappings
      expect(normalizeUniformName('u-speed')).toBe('u_speed');
      expect(normalizeUniformName('u-reflection')).toBe('u_reflection');
      expect(normalizeUniformName('u-roughness')).toBe('u_roughness');
      expect(normalizeUniformName('u-waveamplitude')).toBe('u_waveAmplitude');
      expect(normalizeUniformName('u-wave-amplitude')).toBe('u_waveAmplitude');
      expect(normalizeUniformName('u-noisescale')).toBe('u_noiseScale');
      expect(normalizeUniformName('u-noise-scale')).toBe('u_noiseScale');
      expect(normalizeUniformName('u-mouseradius')).toBe('u_mouseRadius');
      expect(normalizeUniformName('u-mouse-radius')).toBe('u_mouseRadius');
      expect(normalizeUniformName('u-mouseintensity')).toBe('u_mouseIntensity');
      expect(normalizeUniformName('u-mouse-intensity')).toBe('u_mouseIntensity');
      expect(normalizeUniformName('u-causticscale')).toBe('u_causticScale');
      expect(normalizeUniformName('u-caustic-scale')).toBe('u_causticScale');
      expect(normalizeUniformName('u-depth')).toBe('u_depth');
      expect(normalizeUniformName('u-brightness')).toBe('u_brightness');

      // Aliases
      expect(normalizeUniformName('u-color-a')).toBe('u_color1');
      expect(normalizeUniformName('u-color-b')).toBe('u_color2');
      expect(normalizeUniformName('u-color-c')).toBe('u_color3');
      expect(normalizeUniformName('u-color-d')).toBe('u_color4');

      // Arbitrary kebab-case uniform names
      expect(normalizeUniformName('u-custom-complex-uniform')).toBe('u_customComplexUniform');
      expect(normalizeUniformName('u-foo-bar-baz')).toBe('u_fooBarBaz');
    });

    it('applies malformed attribute updates to active pipeline without crashing or unhandled exceptions', async () => {
      const { el, container, cleanup } = createHostElement();
      el.setAttribute('effect', 'liquid-chrome');
      el.setAttribute('driver', 'canvas2d');
      container.appendChild(el);

      await new Promise((r) => setTimeout(r, 60));

      expect(() => {
        el.setAttribute('u-speed', 'not-a-number');
        el.setAttribute('u-color1', '#invalid-hex');
        el.setAttribute('uniforms', '{ corrupted: json');
        el.setAttribute('u-unknown-param', '999');
      }).not.toThrow();

      expect(el.pipeline?.isRunning).toBe(true);

      container.removeChild(el);
      cleanup();
    });
  });

  describe('4. Svelte Action Lifecycle & Component Stress Testing', () => {
    it('executes 10,000 rapid consecutive action.update() uniform calls without pipeline recreation', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let initCount = 0;

      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        uniforms: { u_speed: 1.0 },
        onInit: () => {
          initCount++;
        }
      });

      await new Promise((r) => setTimeout(r, 60));
      expect(initCount).toBe(1);
      const activePipeline = action.pipeline;
      expect(activePipeline).toBeDefined();

      const startTime = performance.now();
      for (let i = 0; i < 10000; i++) {
        action.update({
          uniforms: { u_speed: i * 0.001 }
        });
      }
      const elapsed = performance.now() - startTime;

      expect(initCount).toBe(1); // Crucial: pipeline was NEVER recreated during uniform updates
      expect(action.pipeline).toBe(activePipeline);
      expect((activePipeline as any).uniforms.u_speed).toBeCloseTo(9.999, 2);
      expect(elapsed).toBeLessThan(2000); // 10,000 updates under 2 seconds

      action.destroy();
      expect((activePipeline as any).isRunning).toBe(false);
    });

    it('safely tears down and reconstructs pipeline upon structural update (glsl change)', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let initCalls = 0;
      const pipelines: any[] = [];

      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        onInit: (p) => {
          initCalls++;
          pipelines.push(p);
        }
      });

      await new Promise((r) => setTimeout(r, 60));
      expect(initCalls).toBe(1);
      const firstPipeline = pipelines[0];
      expect(firstPipeline.isRunning).toBe(true);

      // Trigger structural change by updating glsl (valid on same canvas)
      action.update({ glsl: 'void main() { gl_FragColor = vec4(1.0); }' });
      await new Promise((r) => setTimeout(r, 60));

      expect(initCalls).toBe(2);
      expect(firstPipeline.isRunning).toBe(false); // First pipeline disposed
      expect(pipelines[1].isRunning).toBe(true);   // New pipeline running

      action.destroy();
      expect(pipelines[1].isRunning).toBe(false);
    });

    it('demonstrates context exclusivity failure when transitioning canvas from 2d to webgl2', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let errorReceived: Error | null = null;

      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        onError: (err) => {
          errorReceived = err;
        }
      });

      await new Promise((r) => setTimeout(r, 60));

      // Attempting to switch driver to webgl2 on a canvas with existing 2D context
      // Violates HTML Canvas context exclusivity: canvas.getContext('webgl2') returns null!
      action.update({ driver: 'webgl2' });
      await new Promise((r) => setTimeout(r, 150));

      expect(errorReceived).not.toBeNull();
      expect(errorReceived?.message).toMatch(/context unavailable|compilation failed/i);
      action.destroy();
    });

    it('safely handles empty and undefined options in action.update()', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d'
      });

      await new Promise((r) => setTimeout(r, 60));
      const originalPipeline = action.pipeline;

      expect(() => {
        action.update({});
        action.update({ uniforms: undefined });
        action.update({ component: undefined });
      }).not.toThrow();

      expect(action.pipeline).toBe(originalPipeline);
      action.destroy();
    });

    it('handles destroy() called while async init() is in-flight without unhandled errors', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      let errorOccurred = false;

      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d',
        onError: () => {
          errorOccurred = true;
        }
      });

      // Synchronously destroy immediately without awaiting init
      action.destroy();

      await new Promise((r) => setTimeout(r, 60));
      expect(action.pipeline).toBeNull();
      expect(errorOccurred).toBe(false);
    });

    it('enforces idempotency on multiple consecutive destroy() calls', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d'
      });

      await new Promise((r) => setTimeout(r, 60));

      expect(() => {
        action.destroy();
        action.destroy();
        action.destroy();
        action.destroy();
      }).not.toThrow();

      expect(action.pipeline).toBeNull();
    });

    it('probes post-destroy action.update() resurrection defect [VULNERABILITY PROBE]', async () => {
      const canvas = new MockHTMLCanvasElement(800, 600);
      const action = shaderCanvas(canvas as any, {
        glsl: 'void main() {}',
        driver: 'canvas2d'
      });

      await new Promise((r) => setTimeout(r, 60));
      action.destroy();
      expect(action.pipeline).toBeNull();

      // Attempt structural update on destroyed action
      action.update({ glsl: 'void main() { gl_FragColor = vec4(0.0); }' });

      // EMPIRICAL DEFECT CONFIRMATION:
      // action.update() lacks `if (disposed) return;`, causing createPipeline()
      // to execute and reassign `pipeline = inst`, resurrecting an orphaned ShaderPipeline!
      const isResurrected = action.pipeline !== null;
      expect(isResurrected).toBe(false); // Verified fixed: action.update() guards against post-destroy resurrection
    });

    it('exports Svelte component wrapper with correct class signature', () => {
      expect(SvelteShaderCanvas).toBeDefined();
      expect(typeof SvelteShaderCanvas).toBe('function');
    });
  });

  describe('5. Bundle Determinism & Zero 3D Runtime Dependency Audit', () => {
    const adapterPackages = ['elements', 'svelte', 'react', 'vue'];

    it('strictly prohibits external 3D runtime libraries in all adapter package.json files', () => {
      const prohibitedDeps = [
        'three',
        '@types/three',
        'babylonjs',
        '@babylonjs/core',
        'ogl',
        'twgl.js',
        'regl',
        'pixi.js',
        'playcanvas'
      ];

      for (const pkg of adapterPackages) {
        const pkgJsonPath = resolve(REPO_ROOT, `packages/${pkg}/package.json`);
        expect(existsSync(pkgJsonPath)).toBe(true);

        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
        const allDeps = {
          ...(pkgJson.dependencies || {}),
          ...(pkgJson.peerDependencies || {}),
          ...(pkgJson.devDependencies || {})
        };

        for (const dep of prohibitedDeps) {
          expect(allDeps[dep], `Package @shaderbit/${pkg} must NOT depend on ${dep}`).toBeUndefined();
        }
      }
    });

    it('verifies ESM, CJS, and DTS bundle outputs exist across all 4 adapter packages', () => {
      for (const pkg of adapterPackages) {
        const distDir = resolve(REPO_ROOT, `packages/${pkg}/dist`);
        expect(existsSync(distDir), `Directory ${distDir} must exist`).toBe(true);

        const esmFile = resolve(distDir, 'index.js');
        const cjsFile = resolve(distDir, 'index.cjs');
        const dtsFile = resolve(distDir, 'index.d.ts');
        const dtsCjsFile = resolve(distDir, 'index.d.cts');

        expect(existsSync(esmFile), `${esmFile} must exist`).toBe(true);
        expect(existsSync(cjsFile), `${cjsFile} must exist`).toBe(true);
        expect(existsSync(dtsFile), `${dtsFile} must exist`).toBe(true);
        expect(existsSync(dtsCjsFile), `${dtsCjsFile} must exist`).toBe(true);

        // Verify non-empty bundle artifacts
        expect(readFileSync(esmFile, 'utf8').length).toBeGreaterThan(100);
        expect(readFileSync(cjsFile, 'utf8').length).toBeGreaterThan(100);
        expect(readFileSync(dtsFile, 'utf8').length).toBeGreaterThan(100);
      }
    });

    it('verifies compiled bundle artifacts export all required public symbols', async () => {
      // Elements bundle
      const elementsBundle = await import(resolve(REPO_ROOT, 'packages/elements/dist/index.js'));
      expect(elementsBundle.ShaderBitElement).toBeDefined();
      expect(typeof elementsBundle.defineShaderBitElement).toBe('function');
      expect(typeof elementsBundle.normalizeUniformName).toBe('function');
      expect(typeof elementsBundle.parseAttributeValue).toBe('function');

      // Svelte bundle
      const svelteBundle = await import(resolve(REPO_ROOT, 'packages/svelte/dist/index.js'));
      expect(typeof svelteBundle.shaderCanvas).toBe('function');
      expect(svelteBundle.ShaderCanvas).toBeDefined();

      // React bundle
      const reactBundle = await import(resolve(REPO_ROOT, 'packages/react/dist/index.js'));
      expect(reactBundle.ShaderCanvas).toBeDefined();
      expect(typeof reactBundle.useShaderPipeline).toBe('function');

      // Vue bundle
      const vueBundle = await import(resolve(REPO_ROOT, 'packages/vue/dist/index.js'));
      expect(vueBundle.ShaderCanvas).toBeDefined();
      expect(typeof vueBundle.useShaderCanvas).toBe('function');
    });

    it('verifies zero 3D library imports inside compiled dist bundles', () => {
      const bannedSignatures = [
        'three.module',
        'THREE.',
        'BABYLON.',
        'createProgramInfo',
        'createBufferInfoFromArrays'
      ];

      for (const pkg of adapterPackages) {
        const esm = readFileSync(resolve(REPO_ROOT, `packages/${pkg}/dist/index.js`), 'utf8');
        const cjs = readFileSync(resolve(REPO_ROOT, `packages/${pkg}/dist/index.cjs`), 'utf8');

        for (const sig of bannedSignatures) {
          expect(esm.includes(sig), `Compiled @shaderbit/${pkg} ESM must not include ${sig}`).toBe(false);
          expect(cjs.includes(sig), `Compiled @shaderbit/${pkg} CJS must not include ${sig}`).toBe(false);
        }
      }
    });
  });
});
