import { vi } from 'vitest';

export type WorkerMessageHandler = (event: MessageEvent) => void;

const ErrorEventClass = typeof ErrorEvent !== 'undefined'
  ? ErrorEvent
  : class MockErrorEvent extends Event {
      message: string;
      constructor(type: string, init?: { message?: string }) {
        super(type);
        this.message = init?.message ?? '';
      }
    };

export class MockWorker extends EventTarget {
  static instances: MockWorker[] = [];
  public scriptUrl: string | URL;
  public onmessage: WorkerMessageHandler | null = null;
  public onerror: ((event: any) => void) | null = null;
  public terminated = false;
  public receivedMessages: any[] = [];
  public sentMessages: any[] = [];

  // Automated responder behavior
  public autoRespond = true;

  constructor(scriptUrl: string | URL) {
    super();
    this.scriptUrl = scriptUrl;
    MockWorker.instances.push(this);
  }

  postMessage = vi.fn((message: any, transferList?: Transferable[]) => {
    if (this.terminated) {
      throw new Error('Cannot postMessage to a terminated Worker');
    }
    this.receivedMessages.push({ message, transferList });

    // Handle OffscreenCanvas pipeline protocol automatically in tests
    if (this.autoRespond && message && message.type) {
      this._handleProtocolMessage(message);
    }
  });

  terminate = vi.fn(() => {
    this.terminated = true;
  });

  // Emulate worker sending message back to main thread
  dispatchWorkerMessage(data: any) {
    const event = new MessageEvent('message', { data });
    this.sentMessages.push(data);
    if (this.onmessage) {
      this.onmessage(event);
    }
    this.dispatchEvent(event);
  }

  simulateWorkerCrash(errorMessage = 'Uncaught worker exception') {
    const errorEvent = new (ErrorEventClass as any)('error', { message: errorMessage });
    if (this.onerror) {
      this.onerror(errorEvent);
    }
    this.dispatchEvent(errorEvent);
  }

  private _handleProtocolMessage(message: any) {
    queueMicrotask(() => {
      switch (message.type) {
        case 'INIT':
          this.dispatchWorkerMessage({ type: 'READY', driver: 'webgl2' });
          break;
        case 'DESTROY':
          this.terminated = true;
          break;
      }
    });
  }

  static reset() {
    MockWorker.instances = [];
  }
}
