import { createMockWebGL2Context, MockWebGL2RenderingContext } from './webgl2';
import { createMockGPUContext, MockGPUCanvasContext } from './webgpu';
import { createMockCanvas2DContext, MockCanvasRenderingContext2D } from './canvas2d';

export class MockDOMRect implements DOMRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  x: number;
  y: number;

  constructor(x = 0, y = 0, width = 800, height = 600) {
    this.x = x;
    this.y = y;
    this.left = x;
    this.top = y;
    this.width = width;
    this.height = height;
    this.right = x + width;
    this.bottom = y + height;
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      top: this.top,
      left: this.left,
      right: this.right,
      bottom: this.bottom,
      width: this.width,
      height: this.height,
    };
  }
}

export class MockOffscreenCanvas extends EventTarget {
  width: number;
  height: number;
  private _activeContextType: string | null = null;
  private _webgl2Ctx: MockWebGL2RenderingContext | null = null;
  private _gpuCtx: MockGPUCanvasContext | null = null;
  private _2dCtx: MockCanvasRenderingContext2D | null = null;

  constructor(width = 800, height = 600) {
    super();
    this.width = width;
    this.height = height;
  }

  getContext(contextId: 'webgl2', options?: any): MockWebGL2RenderingContext | null;
  getContext(contextId: 'webgpu', options?: any): MockGPUCanvasContext | null;
  getContext(contextId: '2d', options?: any): MockCanvasRenderingContext2D | null;
  getContext(contextId: string, options?: any): any {
    if (this._activeContextType !== null && this._activeContextType !== contextId) {
      return null;
    }

    if (contextId === 'webgl2') {
      if (!this._webgl2Ctx) {
        this._webgl2Ctx = createMockWebGL2Context(this as any);
        this._activeContextType = 'webgl2';
      }
      return this._webgl2Ctx;
    }
    if (contextId === 'webgpu') {
      if (!this._gpuCtx) {
        this._gpuCtx = createMockGPUContext(this as any);
        this._activeContextType = 'webgpu';
      }
      return this._gpuCtx;
    }
    if (contextId === '2d') {
      if (!this._2dCtx) {
        this._2dCtx = createMockCanvas2DContext(this as any);
        this._activeContextType = '2d';
      }
      return this._2dCtx;
    }
    return null;
  }
}

export class MockHTMLCanvasElement extends EventTarget {
  width: number = 800;
  height: number = 600;
  style: Record<string, string> = {};
  parentElement: any = null;
  private _rect: MockDOMRect = new MockDOMRect(0, 0, 800, 600);
  private _transferred: boolean = false;
  private _contextAcquired: boolean = false;
  private _activeContextType: string | null = null;
  private _webgl2Ctx: MockWebGL2RenderingContext | null = null;
  private _gpuCtx: MockGPUCanvasContext | null = null;
  private _2dCtx: MockCanvasRenderingContext2D | null = null;

  // Test Control Knobs
  public forceWebGLFailure: boolean = false;
  public forceWebGPUFailure: boolean = false;

  constructor(width = 800, height = 600) {
    super();
    this.width = width;
    this.height = height;
    this._rect = new MockDOMRect(0, 0, width, height);
  }

  setBoundingRect(rect: { x?: number; y?: number; width?: number; height?: number }) {
    this._rect = new MockDOMRect(
      rect.x ?? 0,
      rect.y ?? 0,
      rect.width ?? this.width,
      rect.height ?? this.height
    );
  }

  getBoundingClientRect(): DOMRect {
    return this._rect;
  }

  transferControlToOffscreen(): MockOffscreenCanvas {
    if (this._transferred) {
      throw new DOMException('Cannot transfer control from a canvas for more than one time.', 'InvalidStateError');
    }
    if (this._contextAcquired) {
      throw new DOMException('Cannot transfer control from a canvas that already has a rendering context.', 'InvalidStateError');
    }
    this._transferred = true;
    return new MockOffscreenCanvas(this.width, this.height);
  }

  getContext(contextId: 'webgl2', options?: any): MockWebGL2RenderingContext | null;
  getContext(contextId: 'webgpu', options?: any): MockGPUCanvasContext | null;
  getContext(contextId: '2d', options?: any): MockCanvasRenderingContext2D | null;
  getContext(contextId: string, options?: any): any {
    if (this._transferred) {
      throw new DOMException('Cannot get context from a canvas that has transferred control to an OffscreenCanvas.', 'InvalidStateError');
    }

    if (this._activeContextType !== null && this._activeContextType !== contextId) {
      return null;
    }

    if (contextId === 'webgl2') {
      if (this.forceWebGLFailure) return null;
      if (!this._webgl2Ctx) {
        this._webgl2Ctx = createMockWebGL2Context(this as any);
        this._contextAcquired = true;
        this._activeContextType = 'webgl2';
      }
      return this._webgl2Ctx;
    }

    if (contextId === 'webgpu') {
      if (this.forceWebGPUFailure) return null;
      if (!this._gpuCtx) {
        this._gpuCtx = createMockGPUContext(this as any);
        this._contextAcquired = true;
        this._activeContextType = 'webgpu';
      }
      return this._gpuCtx;
    }

    if (contextId === '2d') {
      if (!this._2dCtx) {
        this._2dCtx = createMockCanvas2DContext(this as any);
        this._contextAcquired = true;
        this._activeContextType = '2d';
      }
      return this._2dCtx;
    }

    return null;
  }
}
