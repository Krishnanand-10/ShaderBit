import { describe, it, expect } from 'vitest';
import {
  MockHTMLCanvasElement,
  MockOffscreenCanvas,
  MockWebGL2RenderingContext,
  setupMockPageVisibility,
} from '../mocks/index';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = resolve(__dirname, '../..');

describe('Milestone 1 Iteration 2 Adversarial Hardening Probes', () => {
  describe('Strict Context Exclusivity (WHATWG Canvas Compliance)', () => {
    it('enforces all 6 pairwise context exclusions on MockHTMLCanvasElement', () => {
      // webgl2 first
      const c1 = new MockHTMLCanvasElement();
      expect(c1.getContext('webgl2')).not.toBeNull();
      expect(c1.getContext('2d')).toBeNull();
      expect(c1.getContext('webgpu')).toBeNull();

      // 2d first
      const c2 = new MockHTMLCanvasElement();
      expect(c2.getContext('2d')).not.toBeNull();
      expect(c2.getContext('webgl2')).toBeNull();
      expect(c2.getContext('webgpu')).toBeNull();

      // webgpu first
      const c3 = new MockHTMLCanvasElement();
      expect(c3.getContext('webgpu')).not.toBeNull();
      expect(c3.getContext('webgl2')).toBeNull();
      expect(c3.getContext('2d')).toBeNull();
    });

    it('enforces all 6 pairwise context exclusions on MockOffscreenCanvas', () => {
      // webgl2 first
      const oc1 = new MockOffscreenCanvas();
      expect(oc1.getContext('webgl2')).not.toBeNull();
      expect(oc1.getContext('2d')).toBeNull();
      expect(oc1.getContext('webgpu')).toBeNull();

      // 2d first
      const oc2 = new MockOffscreenCanvas();
      expect(oc2.getContext('2d')).not.toBeNull();
      expect(oc2.getContext('webgl2')).toBeNull();
      expect(oc2.getContext('webgpu')).toBeNull();

      // webgpu first
      const oc3 = new MockOffscreenCanvas();
      expect(oc3.getContext('webgpu')).not.toBeNull();
      expect(oc3.getContext('webgl2')).toBeNull();
      expect(oc3.getContext('2d')).toBeNull();
    });
  });

  describe('Strict WebGL isContextLost() Lifecycle State', () => {
    it('isContextLost reflects exact context state transitions', () => {
      const canvas = new MockHTMLCanvasElement();
      const gl = canvas.getContext('webgl2')!;

      // 1. Initially NOT lost
      expect(typeof gl.isContextLost).toBe('function');
      expect(gl.isContextLost()).toBe(false);

      // 2. Lost state
      gl.triggerContextLost();
      expect(gl.isContextLost()).toBe(true);

      // 3. Restored state
      gl.triggerContextRestored();
      expect(gl.isContextLost()).toBe(false);
    });

    it('MockOffscreenCanvas WebGL context also implements isContextLost() lifecycle', () => {
      const offscreen = new MockOffscreenCanvas();
      const gl = offscreen.getContext('webgl2')!;

      expect(typeof gl.isContextLost).toBe('function');
      expect(gl.isContextLost()).toBe(false);

      gl.triggerContextLost();
      expect(gl.isContextLost()).toBe(true);

      gl.triggerContextRestored();
      expect(gl.isContextLost()).toBe(false);
    });
  });

  describe('Vue 3 CJS and Page Visibility API Mock Isolation', () => {
    it('MockDocument provides required DOM methods and avoids crashing Vue 3 runtime-dom', () => {
      const vis = setupMockPageVisibility();
      const doc = globalThis.document as any;

      expect(doc).toBeDefined();
      expect(typeof doc.createElement).toBe('function');
      expect(typeof doc.querySelector).toBe('function');
      expect(typeof doc.querySelectorAll).toBe('function');
      expect(doc.head).toBeDefined();
      expect(doc.body).toBeDefined();

      const el = doc.createElement('div');
      expect(el.tagName).toBe('DIV');
      expect(el.style).toEqual({});
      expect(typeof el.setAttribute).toBe('function');
      expect(typeof el.appendChild).toBe('function');

      // Test page visibility events
      expect(doc.hidden).toBe(false);
      expect(doc.visibilityState).toBe('visible');

      vis.setVisibility('hidden');
      expect(doc.hidden).toBe(true);
      expect(doc.visibilityState).toBe('hidden');

      vis.setVisibility('visible');
      expect(doc.hidden).toBe(false);
      expect(doc.visibilityState).toBe('visible');
    });

    it('evaluates Vue 3 CJS loading in a child Node process after setupMockPageVisibility', () => {
      const out = execSync(
        `node --experimental-strip-types -e "
          import('./tests/mocks/visibility.ts').then(v => {
            v.setupMockPageVisibility();
            import('./packages/vue/dist/index.cjs').then(vueCjs => {
              console.log('SUCCESS', typeof vueCjs.ShaderCanvas, typeof vueCjs.useShaderCanvas);
            });
          });
        "`,
        { cwd: repoRoot, encoding: 'utf-8' }
      );
      expect(out.trim()).toContain('SUCCESS object function');
    });
  });

  describe('Svelte Dual Export Contract (@shaderbit/svelte)', () => {
    it('exports both shaderCanvas action and ShaderCanvas component wrapper', async () => {
      const svelte = await import(resolve(repoRoot, 'packages/svelte/dist/index.js'));
      expect(typeof svelte.shaderCanvas).toBe('function');
      expect(svelte.ShaderCanvas).toBeDefined();
      expect(typeof svelte.ShaderCanvas).toBe('function');
    });

    it('exports both contracts in CJS bundle', () => {
      const svelteCjs = require(resolve(repoRoot, 'packages/svelte/dist/index.cjs'));
      expect(typeof svelteCjs.shaderCanvas).toBe('function');
      expect(svelteCjs.ShaderCanvas).toBeDefined();
      expect(typeof svelteCjs.ShaderCanvas).toBe('function');
    });
  });
});
