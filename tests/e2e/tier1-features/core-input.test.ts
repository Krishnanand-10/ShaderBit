/**
 * Tier 1 Feature Test: Pointer & Touch Normalization
 * Tests normalized [0, 1] UV coordinate extraction, DPR scaling, touch event mapping, and boundary clamping.
 */

import { describe, it, expect } from '../harness/test-kit.ts';
import { MockCanvasElement } from '../harness/index.ts';

export class PointerNormalizer {
  private canvas: MockCanvasElement;
  private mouse: [number, number] = [0.5, 0.5];
  private isPointerInside = false;

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
    this.attachListeners();
  }

  private attachListeners(): void {
    this.canvas.addEventListener('pointermove', (e: any) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerleave', () => this.handlePointerLeave());
    this.canvas.addEventListener('touchmove', (e: any) => this.handleTouchMove(e));
    this.canvas.addEventListener('touchend', () => this.handleTouchEnd());
  }

  handlePointerMove(e: { clientX: number; clientY: number }): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const rawX = (e.clientX - rect.left) / rect.width;
    // WebGL convention: Y=0 at bottom, Y=1 at top
    const rawY = 1.0 - (e.clientY - rect.top) / rect.height;

    this.mouse = [
      Math.max(0.0, Math.min(1.0, rawX)),
      Math.max(0.0, Math.min(1.0, rawY))
    ];
    this.isPointerInside = true;
  }

  handlePointerLeave(): void {
    this.isPointerInside = false;
  }

  handleTouchMove(e: { touches?: Array<{ clientX: number; clientY: number }> }): void {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    this.handlePointerMove(touch);
  }

  handleTouchEnd(): void {
    this.isPointerInside = false;
  }

  getCoordinates(): [number, number] {
    return [this.mouse[0], this.mouse[1]];
  }

  getAspectAdjustedCoordinates(): [number, number] {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    return [this.mouse[0] * aspect, this.mouse[1]];
  }

  isInside(): boolean {
    return this.isPointerInside;
  }
}

describe('Tier 1: Pointer & Touch Normalization', () => {
  it('normalizes pointer coordinates to [0, 1] range relative to canvas bounding box', () => {
    const canvas = new MockCanvasElement();
    canvas.clientWidth = 800;
    canvas.clientHeight = 600;

    const normalizer = new PointerNormalizer(canvas);

    // Center click
    canvas.dispatchEvent({ type: 'pointermove', clientX: 400, clientY: 300 });
    const [cx, cy] = normalizer.getCoordinates();
    expect(cx).toBeCloseTo(0.5, 2);
    expect(cy).toBeCloseTo(0.5, 2);
    expect(normalizer.isInside()).toBe(true);

    // Top-left click (in screen coords, top is Y=0, so in WebGL UV top is Y=1)
    canvas.dispatchEvent({ type: 'pointermove', clientX: 0, clientY: 0 });
    const [tlx, tly] = normalizer.getCoordinates();
    expect(tlx).toBe(0.0);
    expect(tly).toBe(1.0);

    // Bottom-right click (in screen coords, bottom is Y=600, so in WebGL UV bottom is Y=0)
    canvas.dispatchEvent({ type: 'pointermove', clientX: 800, clientY: 600 });
    const [brx, bry] = normalizer.getCoordinates();
    expect(brx).toBe(1.0);
    expect(bry).toBe(0.0);
  });

  it('clamps coordinates strictly within [0.0, 1.0] when pointer moves outside bounds', () => {
    const canvas = new MockCanvasElement();
    canvas.clientWidth = 500;
    canvas.clientHeight = 500;

    const normalizer = new PointerNormalizer(canvas);

    // Far negative
    canvas.dispatchEvent({ type: 'pointermove', clientX: -200, clientY: -100 });
    const [negX, negY] = normalizer.getCoordinates();
    expect(negX).toBe(0.0);
    expect(negY).toBe(1.0); // clamped at top

    // Far positive
    canvas.dispatchEvent({ type: 'pointermove', clientX: 1200, clientY: 900 });
    const [posX, posY] = normalizer.getCoordinates();
    expect(posX).toBe(1.0);
    expect(posY).toBe(0.0); // clamped at bottom
  });

  it('tracks pointerleave event and updates inside state', () => {
    const canvas = new MockCanvasElement();
    const normalizer = new PointerNormalizer(canvas);

    canvas.dispatchEvent({ type: 'pointermove', clientX: 200, clientY: 200 });
    expect(normalizer.isInside()).toBe(true);

    canvas.dispatchEvent({ type: 'pointerleave' });
    expect(normalizer.isInside()).toBe(false);
  });

  it('normalizes single-touch events from touches[0] array', () => {
    const canvas = new MockCanvasElement();
    canvas.clientWidth = 400;
    canvas.clientHeight = 800;

    const normalizer = new PointerNormalizer(canvas);

    canvas.dispatchEvent({
      type: 'touchmove',
      touches: [
        { clientX: 100, clientY: 200 },
        { clientX: 300, clientY: 600 } // secondary finger should be ignored
      ]
    });

    const [tx, ty] = normalizer.getCoordinates();
    expect(tx).toBeCloseTo(0.25, 2);
    expect(ty).toBeCloseTo(0.75, 2);
    expect(normalizer.isInside()).toBe(true);

    canvas.dispatchEvent({ type: 'touchend' });
    expect(normalizer.isInside()).toBe(false);
  });

  it('computes aspect-ratio adjusted UV coordinates for non-square canvases', () => {
    const canvas = new MockCanvasElement();
    canvas.width = 1600;
    canvas.height = 800; // Aspect = 2.0
    canvas.clientWidth = 1600;
    canvas.clientHeight = 800;

    const normalizer = new PointerNormalizer(canvas);
    canvas.dispatchEvent({ type: 'pointermove', clientX: 800, clientY: 400 });

    const [adjX, adjY] = normalizer.getAspectAdjustedCoordinates();
    // Raw is (0.5, 0.5), adjusted X is 0.5 * 2.0 = 1.0
    expect(adjX).toBeCloseTo(1.0, 2);
    expect(adjY).toBeCloseTo(0.5, 2);
  });
});
