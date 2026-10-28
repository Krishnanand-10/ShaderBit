/**
 * Mock CanvasRenderingContext2D for software fallback testing.
 * Zero external dependencies.
 */

export class MockCanvasGradient {
  colorStops: Array<{ offset: number; color: string }> = [];

  addColorStop(offset: number, color: string): void {
    this.colorStops.push({ offset, color });
  }
}

export class MockCanvasRenderingContext2D {
  canvas: any;
  fillStyle: string | MockCanvasGradient = '#000000';
  strokeStyle: string | MockCanvasGradient = '#000000';
  lineWidth = 1;
  globalAlpha = 1.0;

  drawOps: Array<{ op: string; args: any[] }> = [];

  constructor(canvas: any) {
    this.canvas = canvas;
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.drawOps.push({ op: 'fillRect', args: [x, y, w, h] });
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.drawOps.push({ op: 'clearRect', args: [x, y, w, h] });
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): MockCanvasGradient {
    return new MockCanvasGradient();
  }

  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): MockCanvasGradient {
    return new MockCanvasGradient();
  }

  beginPath(): void {
    this.drawOps.push({ op: 'beginPath', args: [] });
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    this.drawOps.push({ op: 'arc', args: [x, y, radius, startAngle, endAngle] });
  }

  fill(): void {
    this.drawOps.push({ op: 'fill', args: [] });
  }

  stroke(): void {
    this.drawOps.push({ op: 'stroke', args: [] });
  }

  save(): void {
    this.drawOps.push({ op: 'save', args: [] });
  }

  restore(): void {
    this.drawOps.push({ op: 'restore', args: [] });
  }
}
