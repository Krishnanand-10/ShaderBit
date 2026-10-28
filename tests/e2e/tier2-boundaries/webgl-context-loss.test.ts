/**
 * Tier 2 Boundary Test: WebGL Context Loss & Restoration
 * Tests webglcontextlost handling, event.preventDefault(), draw suspension, and restoration recovery.
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-kit.ts';
import {
  MockCanvasElement,
  MockWebGL2RenderingContext,
  setupMockEnvironment
} from '../harness/index.ts';
import type { MockEnvironment } from '../harness/index.ts';
import { WebGL2Driver } from '../tier1-features/core-drivers.test.ts';

export class ContextLossResilientPipeline {
  private driver: WebGL2Driver | null = null;
  public isContextLost = false;
  private canvas: MockCanvasElement;
  private glsl?: string;
  public restorationCount = 0;
  private preventDefaultCalled = false;

  constructor(canvas: MockCanvasElement, glsl?: string) {
    this.canvas = canvas;
    this.glsl = glsl;
    this.canvas.addEventListener('webglcontextlost', (e: any) => this.handleContextLost(e));
    this.canvas.addEventListener('webglcontextrestored', () => this.handleContextRestored());
  }

  async init(): Promise<void> {
    this.driver = new WebGL2Driver(this.canvas);
    await this.driver.init(this.glsl);
    this.isContextLost = false;
  }

  private handleContextLost(event: { preventDefault: () => void }): void {
    event.preventDefault();
    this.preventDefaultCalled = true;
    this.isContextLost = true;
    if (this.driver) {
      this.driver.dispose();
      this.driver = null;
    }
  }

  private handleContextRestored(): void {
    this.isContextLost = false;
    this.restorationCount++;
    this.driver = new WebGL2Driver(this.canvas);
    this.driver.init(this.glsl);
  }

  render(time: number, mouse: [number, number]): boolean {
    if (this.isContextLost || !this.driver) {
      return false; // Skip draw call during context loss
    }
    this.driver.render(time, mouse);
    return true;
  }

  getPreventDefaultCalled(): boolean {
    return this.preventDefaultCalled;
  }

  dispose(): void {
    if (this.driver) {
      this.driver.dispose();
      this.driver = null;
    }
  }
}

describe('Tier 2: WebGL Context Loss & Restoration', () => {
  let mockEnv: MockEnvironment;

  beforeEach(() => {
    mockEnv = setupMockEnvironment();
  });

  afterEach(() => {
    mockEnv.cleanup();
  });

  it('calls event.preventDefault() upon webglcontextlost to allow subsequent restoration', async () => {
    const canvas = new MockCanvasElement();
    const pipeline = new ContextLossResilientPipeline(canvas);
    await pipeline.init();

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    const loseExt = gl.getExtension('WEBGL_lose_context');
    expect(loseExt).toBeDefined();

    loseExt.loseContext();
    expect(pipeline.isContextLost).toBe(true);
    expect(pipeline.getPreventDefaultCalled()).toBe(true);

    pipeline.dispose();
  });

  it('halts and suppresses draw calls while context is lost', async () => {
    const canvas = new MockCanvasElement();
    const pipeline = new ContextLossResilientPipeline(canvas);
    await pipeline.init();

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    const loseExt = gl.getExtension('WEBGL_lose_context');

    // Normal render succeeds
    const okBefore = pipeline.render(1.0, [0.5, 0.5]);
    expect(okBefore).toBe(true);
    expect(gl.drawCallCount).toBe(1);

    // Lose context
    loseExt.loseContext();

    // Render during loss is safely skipped
    const okDuring = pipeline.render(1.1, [0.5, 0.5]);
    expect(okDuring).toBe(false);
    expect(gl.drawCallCount).toBe(1); // draw call count unchanged

    pipeline.dispose();
  });

  it('restores GPU pipeline and resumes rendering on webglcontextrestored', async () => {
    const canvas = new MockCanvasElement();
    const pipeline = new ContextLossResilientPipeline(canvas);
    await pipeline.init();

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    const loseExt = gl.getExtension('WEBGL_lose_context');

    loseExt.loseContext();
    expect(pipeline.isContextLost).toBe(true);

    // Trigger restoration
    loseExt.restoreContext();
    expect(pipeline.isContextLost).toBe(false);
    expect(pipeline.restorationCount).toBe(1);

    // Render after restore succeeds
    const okAfter = pipeline.render(2.0, [0.5, 0.5]);
    expect(okAfter).toBe(true);

    pipeline.dispose();
  });

  it('survives multiple successive context loss and restore cycles without leaking state', async () => {
    const canvas = new MockCanvasElement();
    const pipeline = new ContextLossResilientPipeline(canvas);
    await pipeline.init();

    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    const loseExt = gl.getExtension('WEBGL_lose_context');

    for (let i = 0; i < 5; i++) {
      loseExt.loseContext();
      expect(pipeline.isContextLost).toBe(true);
      loseExt.restoreContext();
      expect(pipeline.isContextLost).toBe(false);
      expect(pipeline.render(i, [0, 0])).toBe(true);
    }

    expect(pipeline.restorationCount).toBe(5);
    pipeline.dispose();
  });

  it('detects isContextLost() status accurately from WebGL context query', async () => {
    const canvas = new MockCanvasElement();
    const gl = canvas.getContext('webgl2') as MockWebGL2RenderingContext;
    expect(gl.isContextLost()).toBe(false);

    const loseExt = gl.getExtension('WEBGL_lose_context');
    loseExt.loseContext();
    expect(gl.isContextLost()).toBe(true);

    loseExt.restoreContext();
    expect(gl.isContextLost()).toBe(false);
  });
});
