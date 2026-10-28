import type { IShaderDriver, ShaderUniformValue } from './types';

export class Canvas2DFallback implements IShaderDriver {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private ctx: CanvasRenderingContext2D | null = null;
  private fallbackFn?: (
    ctx: any,
    width: number,
    height: number,
    time: number,
    mouse: [number, number]
  ) => void;
  private uniforms = new Map<string, ShaderUniformValue | any>();

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    fallbackFn?: (
      ctx: any,
      width: number,
      height: number,
      time: number,
      mouse: [number, number]
    ) => void
  ) {
    this.canvas = canvas;
    this.fallbackFn = fallbackFn;
  }

  async init(): Promise<boolean> {
    try {
      const ctx = (this.canvas as any).getContext?.('2d') as CanvasRenderingContext2D | null;
      if (!ctx) return false;
      this.ctx = ctx;
      return true;
    } catch {
      return false;
    }
  }

  resize(width: number, height: number, dpr: number): void {
    const safeDpr = dpr <= 0 || !isFinite(dpr) ? 1 : dpr;
    const safeW = Math.max(0, width);
    const safeH = Math.max(0, height);
    this.canvas.width = Math.round(safeW * safeDpr);
    this.canvas.height = Math.round(safeH * safeDpr);
  }

  setUniform(name: string, value: ShaderUniformValue | any): void {
    this.uniforms.set(name, value);
  }

  render(time: number, mouse: [number, number], customFallback?: any): void {
    if (!this.ctx) return;

    try {
      const w = Math.max(0, this.canvas.width || 800);
      const h = Math.max(0, this.canvas.height || 600);
      if (w === 0 || h === 0) return;

      const fn = customFallback || this.fallbackFn;
      if (typeof fn === 'function') {
        try {
          fn(this.ctx, w, h, time, mouse);
          return;
        } catch {
          // If custom callback throws, fall through to default procedural gradient
        }
      }

      // Built-in animated procedural gradient
      try {
        const x0 = (0.5 + 0.3 * Math.sin(time * 0.5)) * w;
        const y0 = (0.5 + 0.3 * Math.cos(time * 0.5)) * h;
        const grad = this.ctx.createRadialGradient(
          x0,
          y0,
          0,
          w * 0.5,
          h * 0.5,
          Math.max(w, h) * 0.8
        );
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(0.5, '#ec4899');
        grad.addColorStop(1, '#0f172a');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, w, h);
      } catch {
        // Linear gradient fallback if radial fails
        try {
          const grad = this.ctx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#4a5568');
          grad.addColorStop(0.5, '#cbd5e1');
          grad.addColorStop(1, '#1e293b');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(0, 0, w, h);
        } catch {
          this.ctx.fillStyle = '#0f172a';
          this.ctx.fillRect(0, 0, w, h);
        }
      }
    } catch {
      // Ultimate zero-exception safety net
    }
  }

  dispose(): void {
    if (this.ctx && (this.ctx as any).drawOps) {
      (this.ctx as any).drawOps.length = 0;
    }
    this.ctx = null;
    this.uniforms.clear();
  }
}
