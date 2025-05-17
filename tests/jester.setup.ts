import { expect, jest } from '@jest/globals';

import type { Logger, LogLevel } from '../src/logger/index.ts';
import { BaseLogger } from '../src/logger/index.ts';

/*
 * Utilities to make using Jester easier.
 */

/**
 * Flushes all promises in the microtask queue on tests that are using Jest `jest.useFakeTimers()`.
 *
 * @returns A promise that resolves when all promises in the microtask queue have been flushed.
 */
export const flushFakeTimePromises = () =>
  new Promise((resolve) => {
    const timers: { setImmediate: (fn: (cb: () => void) => void) => void } = jest.requireActual('timers');
    timers.setImmediate(resolve);
  });

/**
 * The type of the logger returned by `createTestLogger`.
 */
export type TestLogger = ReturnType<typeof createTestLogger>;

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
export const createTestLogger = (level: LogLevel = 'debug'): jest.Mocked<Logger> => {
  const logger = new (class extends BaseLogger {
    protected emitLine(): void {
      return;
    }
  })(level);

  jest.spyOn(logger, 'log');
  jest.spyOn(logger as unknown as { emitLine: jest.Mock }, 'emitLine');
  return logger as unknown as jest.Mocked<Logger>;
};

type CustomMatcherResult = { readonly pass: boolean; readonly message: () => string };

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
const toHaveLoggedWith = (
  logger: jest.Mocked<Logger>,
  level: LogLevel,
  expected: string | RegExp,
): CustomMatcherResult => {
  const calls = logger.log.mock.calls;
  if (!calls.length) {
    return {
      pass: false,
      message: () =>
        `Expected logger to have been called with level ${level} and message matching ${expected}, but no calls were made`,
    };
  }

  const matchingCall = calls.find(([callLevel, message]) => {
    const messageString = String(typeof message === 'function' ? message() : message);
    return (
      callLevel === level &&
      (typeof expected === 'string' ? messageString.includes(expected) : expected.test(messageString))
    );
  });

  if (matchingCall) {
    return {
      pass: true,
      message: () => `Expected logger to not have been called with level '${level}' and message matching '${expected}'`,
    };
  }

  const actualCalls = calls.map(([callLevel, message], index) => {
    const messageString = String(typeof message === 'function' ? message() : message);
    return `${index + 1}: [${callLevel}] ${messageString}`;
  });

  return {
    pass: false,
    message: () =>
      `Expected logger to have been called with level '${level}' and message matching '${expected}', but it was called with:\n${actualCalls.join('\n')}`,
  };
};

/**
 * Extends the expect object with custom matchers.
 */
expect.extend({ toHaveLoggedWith });

// no-dd-sa:typescript-best-practices/no-namespace
declare module 'expect' {
  interface AsymmetricMatchers {
    toHaveLoggedWith(level: LogLevel, expected: string | RegExp): void;
  }
  interface Matchers<R> {
    toHaveLoggedWith(level: LogLevel, expected: string | RegExp): R;
  }
}
