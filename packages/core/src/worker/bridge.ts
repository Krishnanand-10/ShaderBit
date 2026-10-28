import type { DriverType, ShaderUniformValue } from '../drivers/types';
import { INLINE_WORKER_SCRIPT } from './inline-worker';

export interface WorkerBridgeOptions {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  workerUrl?: string;
  autoResize?: boolean;
  dpr?: number;
}

export interface WorkerInitOptions {
  glsl?: string;
  wgsl?: string;
  uniforms?: Record<string, ShaderUniformValue | any>;
  driver?: DriverType;
  dpr?: number;
}

export class OffscreenCanvasWorkerBridge {
  private options: WorkerBridgeOptions;
  private worker: Worker | null = null;
  private offscreen: OffscreenCanvas | null = null;
  private isInitialized = false;
  private blobUrl: string | null = null;
  private pendingMessages: Array<{ message: any; transfer?: Transferable[] }> = [];

  constructor(
    canvasOrOptions: HTMLCanvasElement | OffscreenCanvas | WorkerBridgeOptions,
    maybeOptions?: Partial<WorkerBridgeOptions>
  ) {
    if (
      canvasOrOptions &&
      typeof canvasOrOptions === 'object' &&
      'canvas' in canvasOrOptions &&
      (canvasOrOptions as any).canvas
    ) {
      this.options = canvasOrOptions as WorkerBridgeOptions;
    } else {
      this.options = {
        canvas: canvasOrOptions as HTMLCanvasElement | OffscreenCanvas,
        ...maybeOptions
      };
    }
  }

  static isSupported(): boolean {
    const hasWorker = typeof Worker !== 'undefined';
    const hasOffscreen = typeof OffscreenCanvas !== 'undefined';
    return hasWorker && hasOffscreen;
  }

  static canTransfer(canvas: unknown): boolean {
    if (!canvas || typeof canvas !== 'object') return false;
    if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
      return false;
    }
    return typeof (canvas as any).transferControlToOffscreen === 'function';
  }

  async init(shaderData: WorkerInitOptions = {}): Promise<boolean> {
    if (!OffscreenCanvasWorkerBridge.isSupported()) {
      return false;
    }

    const canvas = this.options.canvas;
    if (!OffscreenCanvasWorkerBridge.canTransfer(canvas)) {
      return false;
    }

    try {
      this.offscreen = (canvas as HTMLCanvasElement).transferControlToOffscreen();
    } catch {
      return false;
    }

    try {
      if (this.options.workerUrl) {
        this.worker = new Worker(this.options.workerUrl);
      } else if (typeof Blob !== 'undefined' && typeof URL?.createObjectURL === 'function') {
        const blob = new Blob([INLINE_WORKER_SCRIPT], { type: 'application/javascript' });
        this.blobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(this.blobUrl);
      } else {
        this.worker = new Worker('worker.js');
      }
    } catch {
      return false;
    }

    return new Promise((resolve) => {
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, 3000);

      this.worker!.onmessage = (event: MessageEvent) => {
        const type = event.data?.type;
        if (type === 'INIT_ACK' || type === 'READY') {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            this.isInitialized = true;
            this.flushPendingMessages();
            resolve(true);
          }
        } else if (type === 'ERROR') {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            resolve(false);
          }
        }
      };

      this.worker!.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve(false);
        }
      };

      const dpr =
        shaderData.dpr ??
        this.options.dpr ??
        (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ??
        1;
      const width = (canvas as HTMLCanvasElement).width || 800;
      const height = (canvas as HTMLCanvasElement).height || 600;

      this.worker!.postMessage(
        {
          type: 'INIT',
          canvas: this.offscreen,
          width,
          height,
          dpr,
          driver: shaderData.driver || 'webgl2',
          glsl: shaderData.glsl,
          wgsl: shaderData.wgsl,
          uniforms: shaderData.uniforms
        },
        [this.offscreen as any]
      );
    });
  }

  resize(width: number, height: number, dpr?: number): void {
    const resolvedDpr =
      dpr ??
      this.options.dpr ??
      (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ??
      1;
    this.send({ type: 'RESIZE', width, height, dpr: resolvedDpr });
  }

  updateUniform(name: string, value: any): void {
    this.send({ type: 'UNIFORM_UPDATE', name, value });
  }

  setUniform(name: string, value: ShaderUniformValue | any): void {
    this.updateUniform(name, value);
    this.send({ type: 'SET_UNIFORMS', uniforms: { [name]: value } });
  }

  setUniforms(uniforms: Record<string, ShaderUniformValue | any>): void {
    this.send({ type: 'SET_UNIFORMS', uniforms });
  }

  updatePointer(x: number, y: number): void {
    this.send({ type: 'POINTER_MOVE', x, y });
  }

  updateTime(time: number): void {
    this.send({ type: 'TIME', time });
  }

  pause(): void {
    this.send({ type: 'PAUSE' });
    this.send({ type: 'VISIBILITY', visible: false });
  }

  resume(): void {
    this.send({ type: 'RESUME' });
    this.send({ type: 'VISIBILITY', visible: true });
  }

  updateVisibility(visible: boolean): void {
    this.send({ type: 'VISIBILITY', visible });
    if (visible) {
      this.send({ type: 'RESUME' });
    } else {
      this.send({ type: 'PAUSE' });
    }
  }

  postMessage(type: string, payload: unknown): void {
    this.send({ type, payload });
  }

  destroy(): void {
    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'DESTROY' });
      } catch {
        // Safe tear down
      }
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
    if (this.blobUrl && typeof URL?.revokeObjectURL === 'function') {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    this.pendingMessages = [];
  }

  dispose(): void {
    this.destroy();
  }

  getWorker(): Worker | null {
    return this.worker;
  }

  get isReady(): boolean {
    return this.isInitialized;
  }

  private send(message: any, transfer?: Transferable[]): void {
    if (!this.isInitialized) {
      this.pendingMessages.push({ message, transfer });
      return;
    }
    if (!this.worker) return;
    this.worker.postMessage(message, transfer as any);
  }

  private flushPendingMessages(): void {
    if (!this.worker) return;
    for (const item of this.pendingMessages) {
      this.worker.postMessage(item.message, item.transfer as any);
    }
    this.pendingMessages = [];
  }
}

// Backward-compatible alias for PROJECT.md interface contract
export { OffscreenCanvasWorkerBridge as OffscreenWorkerBridge };
