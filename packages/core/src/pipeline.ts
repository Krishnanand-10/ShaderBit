import type { DriverType, IShaderDriver, ShaderUniformValue } from './drivers/types';
import { WebGL2Driver } from './drivers/webgl2';
import { WebGPUDriver } from './drivers/webgpu';
import { Canvas2DFallback } from './drivers/canvas2d';
import { PowerSavingController } from './lifecycle/power-saving';
import { PointerNormalizer } from './input/pointer';
import { OffscreenCanvasWorkerBridge } from './worker/bridge';

export interface ShaderPipelineOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  driver?: DriverType;
  glsl?: string;
  wgsl?: string;
  uniforms?: Record<string, ShaderUniformValue | any>;
  worker?: boolean;
  workerUrl?: string;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  autoResize?: boolean;
  dpr?: number;
  canvas2dFallback?: (
    ctx: any,
    width: number,
    height: number,
    time: number,
    mouse: [number, number]
  ) => void;
}

export class ShaderPipeline {
  private options: ShaderPipelineOptions;
  private running = false;
  private activeDriver: IShaderDriver | null = null;
  private activeDriverType: DriverType = 'canvas2d';
  private uniforms: Record<string, ShaderUniformValue | any> = {};
  private powerController: PowerSavingController | null = null;
  private pointerNormalizer: PointerNormalizer | null = null;
  private workerBridge: OffscreenCanvasWorkerBridge | null = null;
  private isWorkerMode = false;
  private isPaused = false;
  private contextLost = false;
  private preventDefaultCalled = false;
  private currentPointer: [number, number] = [0.5, 0.5];
  private accumulatedTime = 0;

  constructor(options: ShaderPipelineOptions) {
    this.options = options;
    if (options.uniforms) {
      this.uniforms = { ...options.uniforms };
    }

    if (
      this.options.canvas &&
      typeof (this.options.canvas as any).addEventListener === 'function'
    ) {
      const el = this.options.canvas as any;
      el.addEventListener('webglcontextlost', this.handleContextLost);
      el.addEventListener('webglcontextrestored', this.handleContextRestored);
    }
  }

  private handleContextLost = (e: any): void => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      this.preventDefaultCalled = true;
    }
    this.contextLost = true;
    if (this.activeDriver) {
      this.activeDriver.dispose();
      this.activeDriver = null;
    }
  };

  private handleContextRestored = async (): Promise<void> => {
    this.contextLost = false;
    const glDriver = new WebGL2Driver(this.options.canvas);
    await glDriver.init(this.options.glsl);
    this.activeDriver = glDriver;
    this.activeDriverType = 'webgl2';

    // Re-apply cached uniforms
    for (const [name, val] of Object.entries(this.uniforms)) {
      this.activeDriver.setUniform(name, val);
    }
  };

  async init(): Promise<void> {
    // 1. Worker mode offloading if requested
    if (this.options.worker) {
      if (
        OffscreenCanvasWorkerBridge.isSupported() &&
        OffscreenCanvasWorkerBridge.canTransfer(this.options.canvas)
      ) {
        this.workerBridge = new OffscreenCanvasWorkerBridge({
          canvas: this.options.canvas,
          workerUrl: this.options.workerUrl,
          dpr: this.options.dpr
        });

        const success = await this.workerBridge.init({
          glsl: this.options.glsl,
          wgsl: this.options.wgsl,
          uniforms: this.uniforms,
          driver: this.options.driver,
          dpr: this.options.dpr
        });

        if (success) {
          this.isWorkerMode = true;
          this.setupControllers();
          return;
        }

        // Clean up failed worker bridge before falling back to main thread
        this.workerBridge.destroy();
        this.workerBridge = null;
      }
    }

    // 2. Main-thread driver resolution hierarchy (WebGPU -> WebGL2 -> Canvas2D)
    const preference = this.options.driver || 'auto';

    if (preference === 'webgpu' || preference === 'auto') {
      try {
        const gpuDriver = new WebGPUDriver(this.options.canvas);
        if (await gpuDriver.init(this.options.glsl, this.options.wgsl)) {
          this.activeDriver = gpuDriver;
          this.activeDriverType = 'webgpu';
          this.setupControllers();
          return;
        }
      } catch (err) {
        if (preference === 'webgpu') throw err;
      }
    }

    if (preference === 'webgl2' || preference === 'auto') {
      try {
        const glDriver = new WebGL2Driver(this.options.canvas);
        if (await glDriver.init(this.options.glsl)) {
          this.activeDriver = glDriver;
          this.activeDriverType = 'webgl2';
          this.setupControllers();
          return;
        }
      } catch (err) {
        if (preference === 'webgl2') throw err;
      }
    }

    // Graceful software procedural fallback
    const fallback = new Canvas2DFallback(
      this.options.canvas,
      this.options.canvas2dFallback
    );
    await fallback.init();
    this.activeDriver = fallback;
    this.activeDriverType = 'canvas2d';
    this.setupControllers();
  }

  private setupControllers(): void {
    const isDOMTarget =
      this.options.canvas &&
      (typeof (this.options.canvas as any).getBoundingClientRect === 'function' ||
        typeof (this.options.canvas as any).addEventListener === 'function');

    if (isDOMTarget) {
      const target = this.options.canvas as any;

      if (!this.isWorkerMode) {
        // Main thread mode: PowerSavingController drives render loop
        this.powerController = new PowerSavingController(
          target,
          (time: number, delta = 0.016) => {
            this.accumulatedTime = time;
            if (this.pointerNormalizer) {
              this.pointerNormalizer.update(delta);
              this.currentPointer = this.pointerNormalizer.getCoordinates();
            }
            if (!this.isPaused && !this.contextLost) {
              this.render(time, this.currentPointer);
            }
          },
          {
            onVisibilityChange: (visible: boolean) => {
              this.isPaused = !visible;
            }
          }
        );

        this.pointerNormalizer = new PointerNormalizer(target, (x, y) => {
          this.currentPointer = [x, y];
          this.setUniform('u_mouse', { type: 'vec2', value: [x, y] });
        });
      } else {
        // Worker mode: PowerSavingController & PointerNormalizer synchronize to worker
        this.powerController = new PowerSavingController(target, {
          onVisibilityChange: (visible: boolean) => {
            this.isPaused = !visible;
            this.workerBridge?.updateVisibility(visible);
          }
        });

        this.pointerNormalizer = new PointerNormalizer(target, (x, y) => {
          this.currentPointer = [x, y];
          this.workerBridge?.updatePointer(x, y);
        });
      }
    }

    // Apply uniforms to active driver
    if (this.activeDriver) {
      for (const [name, val] of Object.entries(this.uniforms)) {
        this.activeDriver.setUniform(name, val);
      }
    }

    // Initial resize
    this.resize();
  }

  render(time?: number, mouse?: [number, number]): boolean {
    if (this.contextLost || !this.activeDriver) {
      return false;
    }
    const t = time ?? this.accumulatedTime;
    const m = mouse ?? this.currentPointer;
    this.activeDriver.render(t, m);
    return true;
  }

  downgradeToSoftwareFallback(): void {
    if (this.activeDriver) {
      this.activeDriver.dispose();
      this.activeDriver = null;
    }
    const fallback = new Canvas2DFallback(
      this.options.canvas,
      this.options.canvas2dFallback
    );
    fallback.init();
    this.activeDriver = fallback;
    this.activeDriverType = 'canvas2d';
  }

  setUniform(name: string, value: ShaderUniformValue | any): void {
    this.uniforms[name] = value;
    if (this.isWorkerMode && this.workerBridge) {
      this.workerBridge.setUniform(name, value);
    } else {
      this.activeDriver?.setUniform(name, value);
    }
  }

  setUniforms(uniforms: Record<string, ShaderUniformValue | any>): void {
    for (const [name, val] of Object.entries(uniforms)) {
      this.setUniform(name, val);
    }
  }

  resize(width?: number, height?: number): void {
    const rawDpr =
      this.options.dpr ??
      (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ??
      1;
    const safeDpr = rawDpr <= 0 || !isFinite(rawDpr) ? 1 : rawDpr;

    const w =
      width ??
      (this.options.canvas as any).clientWidth ??
      this.options.canvas.width ??
      800;
    const h =
      height ??
      (this.options.canvas as any).clientHeight ??
      this.options.canvas.height ??
      600;

    const safeW = Math.max(0, w);
    const safeH = Math.max(0, h);

    if (this.isWorkerMode && this.workerBridge) {
      this.workerBridge.resize(safeW, safeH, safeDpr);
    } else {
      this.activeDriver?.resize(safeW, safeH, safeDpr);
      this.setUniform('u_resolution', {
        type: 'vec2',
        value: [Math.round(safeW * safeDpr), Math.round(safeH * safeDpr)]
      });
      this.setUniform('u_dpr', { type: 'float', value: safeDpr });
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.powerController?.start();
    this.pointerNormalizer?.start();
  }

  stop(): void {
    this.running = false;
    this.powerController?.stop();
    this.pointerNormalizer?.stop();
  }

  dispose(): void {
    this.stop();
    if (
      this.options.canvas &&
      typeof (this.options.canvas as any).removeEventListener === 'function'
    ) {
      const el = this.options.canvas as any;
      el.removeEventListener('webglcontextlost', this.handleContextLost);
      el.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }
    this.powerController?.dispose();
    this.pointerNormalizer?.dispose();
    this.workerBridge?.destroy();
    this.workerBridge = null;
    this.activeDriver?.dispose();
    this.activeDriver = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get driver(): IShaderDriver | null {
    return this.activeDriver;
  }

  getActiveDriver(): string {
    return this.activeDriverType;
  }

  get isContextLost(): boolean {
    return this.contextLost;
  }

  getPreventDefaultCalled(): boolean {
    return this.preventDefaultCalled;
  }
}
