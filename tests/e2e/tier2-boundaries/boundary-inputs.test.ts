/**
 * Tier 2 Boundary Test: Extreme Pointer & Touch Input Conditions
 * Tests astronomical coordinates, NaN/Infinity values, multi-touch cancellation, and empty touch events.
 */

import { describe, it, expect } from '../harness/test-kit.ts';
import { MockCanvasElement } from '../harness/index.ts';

export class RobustPointerNormalizer {
  private canvas: MockCanvasElement;
  private mouse: [number, number] = [0.5, 0.5];
  private isPointerInside = false;

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
    this.attach();
  }

  private attach(): void {
    this.canvas.addEventListener('pointermove', (e: any) => this.onMove(e.clientX, e.clientY));
    this.canvas.addEventListener('pointerleave', () => this.onLeave());
    this.canvas.addEventListener('touchmove', (e: any) => {
      if (e.touches && e.touches.length > 0) {
        this.onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    });
    this.canvas.addEventListener('touchcancel', () => this.onCancel());
    this.canvas.addEventListener('touchend', () => this.onCancel());
  }

  onMove(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (!isFinite(clientX) || !isFinite(clientY) || isNaN(clientX) || isNaN(clientY)) {
      this.mouse = [0.5, 0.5];
      return;
    }

    const uvX = (clientX - rect.left) / rect.width;
    const uvY = 1.0 - (clientY - rect.top) / rect.height;

    this.mouse = [
      Math.max(0.0, Math.min(1.0, uvX)),
      Math.max(0.0, Math.min(1.0, uvY))
    ];
    this.isPointerInside = true;
  }

  onLeave(): void {
    this.isPointerInside = false;
  }

  onCancel(): void {
    this.isPointerInside = false;
    this.mouse = [0.5, 0.5]; // Reset to neutral center
  }

  getCoordinates(): [number, number] {
    return [this.mouse[0], this.mouse[1]];
  }

  isInside(): boolean {
    return this.isPointerInside;
  }
}

describe('Tier 2: Extreme Pointer & Touch Input Conditions', () => {
  it('clamps extreme astronomical coordinates (-999999, +999999) strictly to [0.0, 1.0]', () => {
    const canvas = new MockCanvasElement();
    const normalizer = new RobustPointerNormalizer(canvas);

    canvas.dispatchEvent({ type: 'pointermove', clientX: -999999, clientY: -999999 });
    const [minX, maxY] = normalizer.getCoordinates();
    expect(minX).toBe(0.0);
    expect(maxY).toBe(1.0); // Top clamp

    canvas.dispatchEvent({ type: 'pointermove', clientX: 999999, clientY: 999999 });
    const [maxX, minY] = normalizer.getCoordinates();
    expect(maxX).toBe(1.0);
    expect(minY).toBe(0.0); // Bottom clamp
  });

  it('safely falls back to neutral center [0.5, 0.5] when coordinates are NaN or Infinity', () => {
    const canvas = new MockCanvasElement();
    const normalizer = new RobustPointerNormalizer(canvas);

    canvas.dispatchEvent({ type: 'pointermove', clientX: NaN, clientY: 300 });
    expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);

    canvas.dispatchEvent({ type: 'pointermove', clientX: Infinity, clientY: -Infinity });
    expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);
  });

  it('resets coordinates to neutral center [0.5, 0.5] on touchcancel event', () => {
    const canvas = new MockCanvasElement();
    const normalizer = new RobustPointerNormalizer(canvas);

    canvas.dispatchEvent({
      type: 'touchmove',
      touches: [{ clientX: 700, clientY: 100 }]
    });
    expect(normalizer.isInside()).toBe(true);

    // Cancel fired (e.g. system alert or incoming call)
    canvas.dispatchEvent({ type: 'touchcancel' });
    expect(normalizer.isInside()).toBe(false);
    expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);
  });

  it('handles empty touches array in touchmove without error', () => {
    const canvas = new MockCanvasElement();
    const normalizer = new RobustPointerNormalizer(canvas);

    expect(() => {
      canvas.dispatchEvent({ type: 'touchmove', touches: [] });
    }).not.toThrow();
  });

  it('ignores move events when canvas has zero area without throwing divide-by-zero', () => {
    const canvas = new MockCanvasElement();
    canvas.clientWidth = 0;
    canvas.clientHeight = 0;

    const normalizer = new RobustPointerNormalizer(canvas);
    canvas.dispatchEvent({ type: 'pointermove', clientX: 100, clientY: 100 });
    expect(normalizer.getCoordinates()).toEqual([0.5, 0.5]);
  });
});
