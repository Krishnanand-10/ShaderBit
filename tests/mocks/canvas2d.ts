import { vi } from 'vitest';

export class MockCanvasGradient {
  colorStops: Array<{ offset: number; color: string }> = [];
  addColorStop = vi.fn((offset: number, color: string) => {
    this.colorStops.push({ offset, color });
  });
}

export class MockCanvasRenderingContext2D {
  canvas: any;
  fillStyle: string | MockCanvasGradient = '#000000';
  strokeStyle: string | MockCanvasGradient = '#000000';
  lineWidth: number = 1;
  globalAlpha: number = 1.0;

  // Track draw calls
  fillRectCalls: Array<{ x: number; y: number; width: number; height: number }> = [];
  calls: Array<{ method: string; args: any[] }> = [];

  constructor(canvas: any) {
    this.canvas = canvas;
  }

  fillRect = vi.fn((x: number, y: number, width: number, height: number) => {
    this.fillRectCalls.push({ x, y, width, height });
    this.calls.push({ method: 'fillRect', args: [x, y, width, height] });
  });

  clearRect = vi.fn((x: number, y: number, width: number, height: number) => {
    this.calls.push({ method: 'clearRect', args: [x, y, width, height] });
  });

  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  arc = vi.fn();
  fill = vi.fn();
  stroke = vi.fn();
  save = vi.fn();
  restore = vi.fn();
  scale = vi.fn();
  rotate = vi.fn();
  translate = vi.fn();

  createLinearGradient = vi.fn((x0: number, y0: number, x1: number, y1: number) => {
    return new MockCanvasGradient();
  });

  createRadialGradient = vi.fn((x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => {
    return new MockCanvasGradient();
  });

  getImageData = vi.fn((sx: number, sy: number, sw: number, sh: number) => ({
    data: new Uint8ClampedArray(sw * sh * 4),
    width: sw,
    height: sh,
  }));

  putImageData = vi.fn();
}

export function createMockCanvas2DContext(canvas: any): MockCanvasRenderingContext2D {
  return new MockCanvasRenderingContext2D(canvas);
}
