export class MockDocument extends EventTarget {
  hidden = false;
  visibilityState: DocumentVisibilityState = 'visible';

  createElement = (tag: string) => ({
    tagName: tag.toUpperCase(),
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: () => {},
    removeChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  querySelector = () => null;
  querySelectorAll = () => [];
  head = { appendChild: () => {} };
  body = { appendChild: () => {} };
}

export function setupMockPageVisibility() {
  let isHidden = false;

  let targetDoc: any = typeof document !== 'undefined' ? document : (globalThis as any).document;
  if (!targetDoc) {
    targetDoc = new MockDocument();
    (globalThis as any).document = targetDoc;
  }

  Object.defineProperty(targetDoc, 'hidden', {
    configurable: true,
    get: () => isHidden,
  });

  Object.defineProperty(targetDoc, 'visibilityState', {
    configurable: true,
    get: () => (isHidden ? 'hidden' : 'visible'),
  });

  return {
    setVisibility(state: 'visible' | 'hidden') {
      isHidden = state === 'hidden';
      targetDoc.dispatchEvent(new Event('visibilitychange'));
    },
    setVisibilityState(state: 'visible' | 'hidden') {
      isHidden = state === 'hidden';
      targetDoc.dispatchEvent(new Event('visibilitychange'));
    },
    reset() {
      isHidden = false;
    },
    cleanup() {
      isHidden = false;
    },
  };
}
