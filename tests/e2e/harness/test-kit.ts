/**
 * Universal BDD Test Kit for ShaderBit E2E Testing.
 * Compatible with Node.js 22 test runner (node:test) and Vitest.
 * Zero external dependencies.
 */

import * as nodeTest from 'node:test';
import * as assert from 'node:assert';

export interface SpyFunction<T extends (...args: any[]) => any = (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>;
  calls: Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: any }>;
  mockReturnValue: (val: any) => SpyFunction<T>;
  mockImplementation: (fn: T) => SpyFunction<T>;
  mockClear: () => void;
  mockReset: () => void;
}

export interface Matchers<T = any> {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  toBeNull(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(expected: any): void;
  toHaveLength(length: number): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeCloseTo(expected: number, precision?: number): void;
  toThrow(expected?: string | RegExp | Error): void;
  toReject(expected?: string | RegExp | Error): Promise<void>;
  toMatch(pattern: RegExp | string): void;
  not: Matchers<T>;
}

class Expectation<T = any> implements Matchers<T> {
  private isNot = false;
  private actual: T;

  constructor(actual: T, isNot = false) {
    this.actual = actual;
    this.isNot = isNot;
  }

  get not(): Matchers<T> {
    return new Expectation(this.actual, !this.isNot);
  }

  private check(condition: boolean, message: string) {
    const passed = this.isNot ? !condition : condition;
    if (!passed) {
      assert.fail(message);
    }
  }

  toBe(expected: any): void {
    if (this.isNot) {
      this.check(this.actual !== expected, `Expected ${this.actual} NOT to be ${expected}`);
    } else {
      this.check(this.actual === expected, `Expected ${this.actual} to be ${expected}`);
    }
  }

  toEqual(expected: any): void {
    try {
      assert.deepStrictEqual(this.actual, expected);
      if (this.isNot) {
        assert.fail(`Expected ${JSON.stringify(this.actual)} NOT to deep-equal ${JSON.stringify(expected)}`);
      }
    } catch (err) {
      if (!this.isNot) {
        throw err;
      }
    }
  }

  toBeDefined(): void {
    this.check(this.actual !== undefined, `Expected value to be defined, got undefined`);
  }

  toBeUndefined(): void {
    this.check(this.actual === undefined, `Expected value to be undefined, got ${this.actual}`);
  }

  toBeNull(): void {
    this.check(this.actual === null, `Expected value to be null, got ${this.actual}`);
  }

  toBeTruthy(): void {
    this.check(Boolean(this.actual), `Expected ${this.actual} to be truthy`);
  }

  toBeFalsy(): void {
    this.check(!this.actual, `Expected ${this.actual} to be falsy`);
  }

  toContain(expected: any): void {
    if (typeof this.actual === 'string') {
      this.check(this.actual.includes(expected), `Expected string "${this.actual}" to contain "${expected}"`);
    } else if (Array.isArray(this.actual) || this.actual instanceof Set) {
      const arr = Array.from(this.actual as any);
      const found = arr.includes(expected);
      this.check(found, `Expected collection to contain ${JSON.stringify(expected)}`);
    } else {
      assert.fail(`toContain requires string or collection, got ${typeof this.actual}`);
    }
  }

  toHaveLength(length: number): void {
    const actualLength = (this.actual as any)?.length ?? (this.actual as any)?.size;
    this.check(actualLength === length, `Expected length ${length}, got ${actualLength}`);
  }

  toBeGreaterThan(expected: number): void {
    this.check((this.actual as any) > expected, `Expected ${this.actual} > ${expected}`);
  }

  toBeGreaterThanOrEqual(expected: number): void {
    this.check((this.actual as any) >= expected, `Expected ${this.actual} >= ${expected}`);
  }

  toBeLessThan(expected: number): void {
    this.check((this.actual as any) < expected, `Expected ${this.actual} < ${expected}`);
  }

  toBeLessThanOrEqual(expected: number): void {
    this.check((this.actual as any) <= expected, `Expected ${this.actual} <= ${expected}`);
  }

  toBeCloseTo(expected: number, precision = 2): void {
    const diff = Math.abs((this.actual as any) - expected);
    const tolerance = Math.pow(10, -precision) / 2;
    this.check(diff < tolerance, `Expected ${this.actual} close to ${expected} (diff: ${diff}, tol: ${tolerance})`);
  }

  toThrow(expected?: string | RegExp | Error): void {
    if (typeof this.actual !== 'function') {
      assert.fail(`toThrow target must be a function, got ${typeof this.actual}`);
    }

    let threw = false;
    let thrownError: any = null;
    try {
      (this.actual as any)();
    } catch (e) {
      threw = true;
      thrownError = e;
    }

    if (this.isNot) {
      if (threw) {
        assert.fail(`Expected function NOT to throw, but it threw: ${thrownError?.message || thrownError}`);
      }
      return;
    }

    if (!threw) {
      assert.fail(`Expected function to throw, but it did not throw`);
    }

    if (expected) {
      const errorMsg = thrownError?.message || String(thrownError);
      if (typeof expected === 'string') {
        assert.ok(
          errorMsg.includes(expected),
          `Expected error message to include "${expected}", got: "${errorMsg}"`
        );
      } else if (expected instanceof RegExp) {
        assert.ok(
          expected.test(errorMsg),
          `Expected error message to match ${expected}, got: "${errorMsg}"`
        );
      }
    }
  }

  async toReject(expected?: string | RegExp | Error): Promise<void> {
    let threw = false;
    let thrownError: any = null;
    try {
      await (this.actual as any);
    } catch (e) {
      threw = true;
      thrownError = e;
    }

    if (this.isNot) {
      if (threw) {
        assert.fail(`Expected promise NOT to reject, but it rejected: ${thrownError?.message || thrownError}`);
      }
      return;
    }

    if (!threw) {
      assert.fail(`Expected promise to reject, but it resolved`);
    }

    if (expected) {
      const errorMsg = thrownError?.message || String(thrownError);
      if (typeof expected === 'string') {
        assert.ok(
          errorMsg.includes(expected),
          `Expected rejection error message to include "${expected}", got: "${errorMsg}"`
        );
      } else if (expected instanceof RegExp) {
        assert.ok(
          expected.test(errorMsg),
          `Expected rejection error message to match ${expected}, got: "${errorMsg}"`
        );
      }
    }
  }

  toMatch(pattern: RegExp | string): void {
    const str = String(this.actual);
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    this.check(regex.test(str), `Expected "${str}" to match ${regex}`);
  }
}

export function expect<T = any>(actual: T): Matchers<T> {
  return new Expectation(actual);
}

// vi mock utilities
export const vi = {
  fn: <T extends (...args: any[]) => any = (...args: any[]) => any>(impl?: T): SpyFunction<T> => {
    let currentImpl = impl;
    const calls: Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: any }> = [];

    const spy = function (...args: Parameters<T>): ReturnType<T> {
      try {
        const result = currentImpl ? currentImpl(...args) : undefined;
        calls.push({ args, result });
        return result;
      } catch (error) {
        calls.push({ args, error });
        throw error;
      }
    } as SpyFunction<T>;

    spy.calls = calls;
    spy.mockReturnValue = (val: any) => {
      currentImpl = ((() => val) as unknown) as T;
      return spy;
    };
    spy.mockImplementation = (fn: T) => {
      currentImpl = fn;
      return spy;
    };
    spy.mockClear = () => {
      calls.length = 0;
    };
    spy.mockReset = () => {
      calls.length = 0;
      currentImpl = undefined;
    };

    return spy;
  },

  spyOn: <T extends object, K extends keyof T>(obj: T, method: K): SpyFunction => {
    const original = obj[method] as any;
    const spy = vi.fn(original);
    obj[method] = spy as any;
    return spy;
  },

  clearAllMocks: () => {
    // no-op global cleanup hook
  }
};

export const describe = nodeTest.describe;
export const it = nodeTest.it;
export const test = nodeTest.it;
export const beforeEach = nodeTest.beforeEach;
export const afterEach = nodeTest.afterEach;
export const beforeAll = nodeTest.before;
export const afterAll = nodeTest.after;
