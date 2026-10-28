export interface PointerNormalizerOptions {
  origin?: 'bottom-left' | 'top-left'; // default: 'bottom-left'
  damping?: number; // 0.0 (maximum smoothing) to 1.0 (instant, no damping), default 1.0
  aspectCorrection?: boolean;
  onPointerUpdate?: (x: number, y: number, state?: PointerState) => void;
  onPointerLeave?: () => void;
}

export interface PointerState {
  coords: [number, number]; // [x, y] in [0, 1]
  aspectCoords: [number, number]; // [x * aspect, y]
  smoothed: [number, number]; // dampened [x, y]
  velocity: [number, number]; // [vx, vy]
  speed: number; // magnitude
  displacement: [number, number]; // [dx, dy]
  isInside: boolean;
  isDown: boolean;
}

export class PointerNormalizer {
  private target: HTMLElement | HTMLCanvasElement;
  private options: PointerNormalizerOptions;
  private mouse: [number, number] = [0.5, 0.5];
  private smoothedMouse: [number, number] = [0.5, 0.5];
  private displacement: [number, number] = [0, 0];
  private velocity: [number, number] = [0, 0];
  private speed = 0;
  private isPointerInside = false;
  private isPointerDown = false;
  private listening = false;
  private callback: ((x: number, y: number) => void) | null = null;

  constructor(
    target: HTMLElement | HTMLCanvasElement,
    callbackOrOptions?: ((x: number, y: number) => void) | PointerNormalizerOptions,
    options?: PointerNormalizerOptions
  ) {
    this.target = target;
    if (typeof callbackOrOptions === 'function') {
      this.callback = callbackOrOptions;
      this.options = options || {};
    } else if (callbackOrOptions) {
      this.options = callbackOrOptions;
      if (callbackOrOptions.onPointerUpdate) {
        this.callback = (x, y) => callbackOrOptions.onPointerUpdate!(x, y, this.getState());
      }
    } else {
      this.options = {};
    }

    // Attach listeners on construction for immediate event handling
    this.start();
  }

  public handlePointerMove = (e: any): void => {
    if (!this.target || typeof (this.target as any).getBoundingClientRect !== 'function') return;
    const rect = this.target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && Array.isArray(e.touches)) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    // Boundary check: NaN or Infinity fallback to neutral center
    if (!isFinite(clientX) || !isFinite(clientY) || isNaN(clientX) || isNaN(clientY)) {
      this.mouse = [0.5, 0.5];
      this.smoothedMouse = [0.5, 0.5];
      return;
    }

    const normX = (clientX - rect.left) / rect.width;
    const clampedX = Math.max(0.0, Math.min(1.0, normX));

    let clampedY: number;
    if (this.options.origin === 'top-left') {
      const normY = (clientY - rect.top) / rect.height;
      clampedY = Math.max(0.0, Math.min(1.0, normY));
    } else {
      // Default WebGL Cartesian UV convention: Y=0 at bottom, Y=1 at top
      const rawY = 1.0 - (clientY - rect.top) / rect.height;
      clampedY = Math.max(0.0, Math.min(1.0, rawY));
    }

    this.mouse = [clampedX, clampedY];
    this.isPointerInside = true;

    if ((this.options.damping ?? 1.0) >= 1.0) {
      this.smoothedMouse = [clampedX, clampedY];
    }

    this.callback?.(clampedX, clampedY);
  };

  public handlePointerLeave = (): void => {
    this.isPointerInside = false;
    this.options.onPointerLeave?.();
  };

  public handlePointerDown = (): void => {
    this.isPointerDown = true;
  };

  public handlePointerUp = (): void => {
    this.isPointerDown = false;
  };

  public handleTouchMove = (e: any): void => {
    const touches = e.touches;
    if (!touches || touches.length === 0) return;
    this.handlePointerMove(touches[0]);
  };

  public handleTouchStart = (e: any): void => {
    this.isPointerDown = true;
    this.handleTouchMove(e);
  };

  public handleTouchEnd = (): void => {
    this.isPointerInside = false;
    this.isPointerDown = false;
    this.options.onPointerLeave?.();
  };

  public handleTouchCancel = (): void => {
    this.isPointerInside = false;
    this.isPointerDown = false;
    this.mouse = [0.5, 0.5];
    this.smoothedMouse = [0.5, 0.5];
    this.options.onPointerLeave?.();
    this.callback?.(0.5, 0.5);
  };

  public update(dt = 0.016): void {
    const damping = this.options.damping ?? 1.0;
    if (damping < 1.0 && dt > 0) {
      const lambda = (1.0 - damping) * 25.0;
      const factor = Math.min(1.0, Math.max(0.0, 1.0 - Math.exp(-lambda * dt)));

      const dx = this.mouse[0] - this.smoothedMouse[0];
      const dy = this.mouse[1] - this.smoothedMouse[1];

      this.displacement = [dx, dy];
      this.speed = Math.hypot(dx, dy) / dt;
      this.velocity = [dx / dt, dy / dt];

      this.smoothedMouse[0] += dx * factor;
      this.smoothedMouse[1] += dy * factor;
    } else {
      const dx = this.mouse[0] - this.smoothedMouse[0];
      const dy = this.mouse[1] - this.smoothedMouse[1];
      this.displacement = [dx, dy];
      this.speed = dt > 0 ? Math.hypot(dx, dy) / dt : 0;
      this.velocity = dt > 0 ? [dx / dt, dy / dt] : [0, 0];
      this.smoothedMouse[0] = this.mouse[0];
      this.smoothedMouse[1] = this.mouse[1];
    }
  }

  start(): void {
    if (this.listening || !this.target || typeof (this.target as any).addEventListener !== 'function') return;
    this.listening = true;

    const t = this.target;
    t.addEventListener('pointermove', this.handlePointerMove);
    t.addEventListener('pointerleave', this.handlePointerLeave);
    t.addEventListener('pointerdown', this.handlePointerDown);
    t.addEventListener('pointerup', this.handlePointerUp);

    t.addEventListener('mousemove', this.handlePointerMove);
    t.addEventListener('mouseleave', this.handlePointerLeave);
    t.addEventListener('mousedown', this.handlePointerDown);
    t.addEventListener('mouseup', this.handlePointerUp);

    t.addEventListener('touchmove', this.handleTouchMove);
    t.addEventListener('touchstart', this.handleTouchStart);
    t.addEventListener('touchend', this.handleTouchEnd);
    t.addEventListener('touchcancel', this.handleTouchCancel);
  }

  stop(): void {
    if (!this.listening || !this.target || typeof (this.target as any).removeEventListener !== 'function') return;
    this.listening = false;

    const t = this.target;
    t.removeEventListener('pointermove', this.handlePointerMove);
    t.removeEventListener('pointerleave', this.handlePointerLeave);
    t.removeEventListener('pointerdown', this.handlePointerDown);
    t.removeEventListener('pointerup', this.handlePointerUp);

    t.removeEventListener('mousemove', this.handlePointerMove);
    t.removeEventListener('mouseleave', this.handlePointerLeave);
    t.removeEventListener('mousedown', this.handlePointerDown);
    t.removeEventListener('mouseup', this.handlePointerUp);

    t.removeEventListener('touchmove', this.handleTouchMove);
    t.removeEventListener('touchstart', this.handleTouchStart);
    t.removeEventListener('touchend', this.handleTouchEnd);
    t.removeEventListener('touchcancel', this.handleTouchCancel);
  }

  dispose(): void {
    this.stop();
  }

  getCoordinates(): [number, number] {
    return [this.mouse[0], this.mouse[1]];
  }

  getSmoothedCoordinates(): [number, number] {
    return [this.smoothedMouse[0], this.smoothedMouse[1]];
  }

  getAspectAdjustedCoordinates(): [number, number] {
    const width = (this.target as any).width || this.target.clientWidth || 800;
    const height = (this.target as any).height || this.target.clientHeight || 600;
    const aspect = width / Math.max(1, height);
    return [this.mouse[0] * aspect, this.mouse[1]];
  }

  getPixelCoordinates(dpr = 1): [number, number] {
    const width = (this.target as any).width || (this.target.clientWidth * dpr) || 800;
    const height = (this.target as any).height || (this.target.clientHeight * dpr) || 600;
    return [this.mouse[0] * width, this.mouse[1] * height];
  }

  getSpeed(): number {
    return this.speed;
  }

  getDisplacement(): [number, number] {
    return [this.displacement[0], this.displacement[1]];
  }

  getVelocity(): [number, number] {
    return [this.velocity[0], this.velocity[1]];
  }

  isInside(): boolean {
    return this.isPointerInside;
  }

  isDown(): boolean {
    return this.isPointerDown;
  }

  getState(): PointerState {
    return {
      coords: this.getCoordinates(),
      aspectCoords: this.getAspectAdjustedCoordinates(),
      smoothed: this.getSmoothedCoordinates(),
      velocity: this.getVelocity(),
      speed: this.getSpeed(),
      displacement: this.getDisplacement(),
      isInside: this.isInside(),
      isDown: this.isDown()
    };
  }
}
