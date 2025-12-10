import type { Mock, Mocked } from 'vitest';
import { expect, vi } from 'vitest';

import type * as timersModule from 'node:timers';

import type { Logger, LogLevel } from '../src/logger/index.ts';
import { implementation } from '../src/logger/index.ts';

/**
 * Flushes all promises in the microtask queue on tests that are using Vitest `vi.useFakeTimers()`.
 *
 * @returns A promise that resolves when all promises in the microtask queue have been flushed.
 */
export const flushFakeTimePromises = async (): Promise<void> => {
  const timers = await vi.importActual<typeof timersModule>('node:timers');
  await new Promise<void>((resolve) => {
    timers.setImmediate(resolve);
  });
};

/**
 * The type of the logger returned by `createTestLogger`.
 */
export type TestLogger = ReturnType<typeof createTestLogger>;

type InternalTestLogger = Logger & { emit: Mock };

/**
 * Creates a logger that can be used to test log messages.
 *
 * @example
 *
 * ```ts
 * const logger: TestLogger = createTestLogger();
 * logger.log('info', 'Hello, world!');
 * expect(logger).toHaveLoggedWith('info', 'Hello, world!');
 * ```
 *
 * @returns A logger that can be used to test log messages.
 */
export const createTestLogger = (level: LogLevel | 'off' | (() => LogLevel | 'off') = 'debug'): Mocked<Logger> => {
  const logger = new (class extends implementation.BaseLogger {
    protected emit(): void {
      return;
    }

    public flush(): void {
      return;
    }

    public close(): Promise<void> {
      return Promise.resolve();
    }
  })(level);

  vi.spyOn(logger, 'log');
  vi.spyOn(logger as unknown as InternalTestLogger, 'emit');
  return logger as unknown as Mocked<Logger>;
};

/*
 * Extends the expect object with custom matchers.
 */

declare module 'vitest' {
  interface AsymmetricMatchersContaining {
    /**
     * Checks if a logger has logged a message with a given level and an expected substring or a string pattern.
     *
     * @example
     *
     * ```ts
     * const logger = createTestLogger();
     * logger.log('info', 'Hello, world!');
     * expect(logger).toHaveLoggedWith('info', 'Hello, world!');
     * ```
     *
     * @param logger The logger to check.
     * @param level The level of the message to check.
     * @param expected The expected substring or string pattern.
     */
    toHaveLoggedWith(level: LogLevel, expected: string | RegExp): void;

    /**
     * Recursively searches an object (including nested objects and arrays) to determine whether it contains a property
     * with the specified key and value at any depth within the object graph.
     *
     * This matcher:
     *
     * - Traverses objects and arrays recursively
     * - Detects cycles using a WeakSet to avoid infinite recursion
     * - Performs deep equality using Vitest/Jest's internal `this.equals`
     * - Returns `true` as soon as a matching key/value pair is found
     *
     * @example
     *
     * ```ts
     * const obj = { user: { profile: { foo: 'bar' } } };
     * expect(obj).toContainDeepKeyValue('foo', 'bar'); // passes
     * ```
     *
     * @example
     *
     * ```ts
     * const obj = { a: [{ x: 1 }, { y: 2 }, { foo: 'bar' }] };
     * expect(obj).toContainDeepKeyValue('foo', 'bar'); // passes
     * ```
     *
     * @example
     *
     * ```ts
     *  * expect({ foo: 'baz' }).toContainDeepKeyValue('foo', 'bar'); // fails
     * ```
     *
     * @function toContainDeepKeyValue
     * @param key The property name to search for anywhere within the object graph.
     * @param expectedValue The expected value for the property. Compared using Vitest/Jest's deep equality.
     * @throws {TypeError} If the received value is not an object or array.
     */
    toContainDeepKeyValue(key: string, value: unknown): void;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    /**
     * Checks if a logger has logged a message with a given level and an expected substring or a string pattern.
     *
     * @example
     *
     * ```ts
     * const logger = createTestLogger();
     * logger.log('info', 'Hello, world!');
     * expect(logger).toHaveLoggedWith('info', 'Hello, world!');
     * ```
     *
     * @param logger The logger to check.
     * @param level The level of the message to check.
     * @param expected The expected substring or string pattern.
     * @returns A custom matcher result.
     */
    toHaveLoggedWith(level: LogLevel, expected: string | RegExp): T;

    /**
     * Recursively searches an object (including nested objects and arrays) to determine whether it contains a property
     * with the specified key and value at any depth within the object graph.
     *
     * This matcher:
     *
     * - Traverses objects and arrays recursively
     * - Detects cycles using a WeakSet to avoid infinite recursion
     * - Performs deep equality using Vitest/Jest's internal `this.equals`
     * - Returns `true` as soon as a matching key/value pair is found
     *
     * @example
     *
     * ```ts
     * const obj = { user: { profile: { foo: 'bar' } } };
     * expect(obj).toContainDeepKeyValue('foo', 'bar'); // passes
     * ```
     *
     * @example
     *
     * ```ts
     * const obj = { a: [{ x: 1 }, { y: 2 }, { foo: 'bar' }] };
     * expect(obj).toContainDeepKeyValue('foo', 'bar'); // passes
     * ```
     *
     * @example
     *
     * ```ts
     *  * expect({ foo: 'baz' }).toContainDeepKeyValue('foo', 'bar'); // fails
     * ```
     *
     * @function toContainDeepKeyValue
     * @param key The property name to search for anywhere within the object graph.
     * @param expectedValue The expected value for the property. Compared using Vitest/Jest's deep equality.
     * @returns A custom matcher result.
     * @throws {TypeError} If the received value is not an object or array.
     */
    toContainDeepKeyValue(key: string, value: unknown): T;
  }
}

expect.extend({
  toHaveLoggedWith(logger: Mocked<Logger>, level: LogLevel, expected: string | RegExp) {
    const calls = (logger as unknown as InternalTestLogger).emit.mock.calls;
    if (!calls.length) {
      return {
        pass: false,
        message: () =>
          `Expected logger to have been called with level ${level} and message matching ${expected}, but no calls were made`,
      };
    }

    const matchingCall = calls.find(([callLevel, message]) => {
      const messageString = String(message);
      return (
        callLevel === level &&
        (typeof expected === 'string' ? messageString.includes(expected) : expected.test(messageString))
      );
    });

    if (matchingCall) {
      return {
        pass: true,
        message: () =>
          `Expected logger to not have been called with level '${level}' and message matching '${expected}'`,
      };
    }

    const actualCalls = calls.map(
      ([callLevel, message], index) => `${index + 1}: [${String(callLevel)}] ${String(message)}`,
    );

    return {
      pass: false,
      message: () =>
        `Expected logger to have been called with level '${level}' and message matching '${expected}', but it was called with:\n${actualCalls.join('\n')}`,
    };
  },

  toContainDeepKeyValue(received, key, expectedValue) {
    const seen = new WeakSet();

    const search = (node: unknown): boolean => {
      if (node && typeof node === 'object') {
        if (seen.has(node)) return false;
        seen.add(node);

        if (node instanceof Map) {
          for (const [k, v] of node.entries()) {
            if (k === key && this.equals(v, expectedValue)) {
              return true;
            }

            if (typeof v === 'object' && search(v)) {
              return true;
            }
          }
          return false;
        }

        if (node instanceof Set) {
          for (const v of node.values()) {
            if (typeof v === 'object' && search(v)) {
              return true;
            }
          }

          return false;
        }

        if (Array.isArray(node)) {
          for (const item of node) {
            if (typeof item === 'object' && search(item)) {
              return true;
            }
          }
          return false;
        }

        for (const [k, v] of Object.entries(node)) {
          if (k === key && this.equals(v, expectedValue)) {
            return true;
          }

          if (typeof v === 'object' && search(v)) {
            return true;
          }
        }
      }

      return false;
    };

    const pass = search(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected object NOT to contain key ${key}=${expectedValue} at any depth`
          : `Expected object to contain key ${key}=${expectedValue} at any depth`,
    };
  },
});
