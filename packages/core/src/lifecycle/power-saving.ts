export interface PowerSavingOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | Document | null;
  maxDelta?: number; // In seconds, default 0.1 (100ms)
  onPause?: () => void;
  onResume?: () => void;
  onRender?: (time: number, delta: number) => void;
  onVisibilityChange?: (visible: boolean) => void;
}

export class PowerSavingController {
  private target: HTMLElement | HTMLCanvasElement;
  private options: PowerSavingOptions;
  private observer: IntersectionObserver | null = null;
  private isVisible = true;
  private isIntersecting = true;
  private isRunning = false;
  private isResuming = false;
  private rafHandle: number | null = null;
  private lastTimestamp = 0;
  private onRenderCallback: ((time: number, delta: number) => void) | null = null;

  public frameCount = 0;
  public totalElapsedTime = 0; // In milliseconds

  constructor(
    target: HTMLElement | HTMLCanvasElement,
    callbackOrOptions?: ((timeOrVisible: any, delta?: any) => void) | PowerSavingOptions,
    options?: PowerSavingOptions
  ) {
    this.target = target;
    if (typeof callbackOrOptions === 'function') {
      this.onRenderCallback = callbackOrOptions;
      this.options = options || {};
    } else if (callbackOrOptions) {
      this.options = callbackOrOptions;
      if (callbackOrOptions.onRender) {
        this.onRenderCallback = callbackOrOptions.onRender;
      }
    } else {
      this.options = {};
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.setupObservers();
    this.scheduleFrame();
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafHandle !== null) {
      const caf =
        typeof cancelAnimationFrame !== 'undefined'
          ? cancelAnimationFrame
          : (globalThis as any).cancelAnimationFrame;
      if (typeof caf === 'function') {
        caf(this.rafHandle);
      }
      this.rafHandle = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', this.handleDocVisibility);
    }
  }

  dispose(): void {
    this.stop();
  }

  private setupObservers(): void {
    const IO =
      typeof IntersectionObserver !== 'undefined'
        ? IntersectionObserver
        : (globalThis as any).IntersectionObserver;

    if (
      typeof IO !== 'undefined' &&
      this.target &&
      (typeof (this.target as any).getBoundingClientRect === 'function' ||
        typeof (this.target as any).addEventListener === 'function')
    ) {
      try {
        this.observer = new IO(
          (entries: any[]) => {
            for (const entry of entries) {
              if (!entry.target || entry.target === this.target) {
                this.setIntersection(Boolean(entry.isIntersecting));
              }
            }
          },
          {
            threshold: this.options.threshold ?? 0.0,
            rootMargin: this.options.rootMargin,
            root: this.options.root ?? null
          }
        );
        this.observer?.observe(this.target as Element);
      } catch {
        // Fallback for non-compliant targets
      }
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', this.handleDocVisibility);
      const isHidden = document.hidden || document.visibilityState === 'hidden';
      this.isVisible = !isHidden;
    }
  }

  private handleDocVisibility = (): void => {
    if (typeof document !== 'undefined') {
      const visible = !document.hidden && document.visibilityState !== 'hidden';
      this.setVisibility(visible);
    }
  };

  private setIntersection(intersecting: boolean): void {
    const wasActive = this.shouldRender();
    this.isIntersecting = intersecting;
    const nowActive = this.shouldRender();
    this.handleActiveStateTransition(wasActive, nowActive);
  }

  private setVisibility(visible: boolean): void {
    const wasActive = this.shouldRender();
    this.isVisible = visible;
    const nowActive = this.shouldRender();
    this.handleActiveStateTransition(wasActive, nowActive);
  }

  private shouldRender(): boolean {
    return this.isRunning && this.isVisible && this.isIntersecting;
  }

  private handleActiveStateTransition(wasActive: boolean, nowActive: boolean): void {
    if (wasActive && !nowActive) {
      // Transitioning to Inactive (Pausing)
      if (this.rafHandle !== null) {
        const caf =
          typeof cancelAnimationFrame !== 'undefined'
            ? cancelAnimationFrame
            : (globalThis as any).cancelAnimationFrame;
        if (typeof caf === 'function') {
          caf(this.rafHandle);
        }
        this.rafHandle = null;
      }
      this.options.onPause?.();
      this.options.onVisibilityChange?.(false);
    } else if (!wasActive && nowActive) {
      // Transitioning to Active (Resuming)
      this.isResuming = true;
      this.options.onResume?.();
      this.options.onVisibilityChange?.(true);
      this.scheduleFrame();
    }
  }

  private scheduleFrame(): void {
    if (!this.shouldRender()) return;
    const raf =
      typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame
        : (globalThis as any).requestAnimationFrame;
    if (typeof raf !== 'function') return;

    this.rafHandle = raf((timestamp: number) => {
      this.rafHandle = null;
      if (!this.shouldRender()) return;

      // Clock Delta Jump Protection
      if (this.lastTimestamp === 0 || this.isResuming) {
        this.lastTimestamp = timestamp;
        this.isResuming = false;
      }

      const rawDelta = Math.max(0, timestamp - this.lastTimestamp);
      const maxDeltaMs = (this.options.maxDelta ?? 0.1) * 1000;
      const delta = Math.min(rawDelta, maxDeltaMs);
      this.lastTimestamp = timestamp;
      this.totalElapsedTime += delta;

      this.frameCount++;
      const timeInSeconds = this.totalElapsedTime / 1000.0;
      const deltaInSeconds = delta / 1000.0;

      if (this.onRenderCallback) {
        this.onRenderCallback(timeInSeconds, deltaInSeconds);
      }
      this.options.onRender?.(timeInSeconds, deltaInSeconds);

      this.scheduleFrame();
    });
  }

  public isRenderLoopActive(): boolean {
    return this.rafHandle !== null;
  }

  public get active(): boolean {
    return this.shouldRender();
  }

  public get visible(): boolean {
    return this.isVisible;
  }

  public get intersecting(): boolean {
    return this.isIntersecting;
  }
}
