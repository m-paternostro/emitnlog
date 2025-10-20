import type { Mock, Mocked } from 'vitest';
import { expect, vi } from 'vitest';

import type * as timersModule from 'node:timers';

import type { Logger, LogLevel } from '../src/logger/index.ts';
import { asExtendedLogger, emitter, implementation } from '../src/logger/index.ts';

/**
 * Fails a test with a given message.
 *
 * @param message The message to fail the test with.
 */
export const fail = (message: string) => {
  expect(message).toBe(true);
};

/**
 * Flushes all promises in the microtask queue on tests that are using fake timers.
 *
 * @returns A promise that resolves when all promises in the microtask queue have been flushed.
 */
export const flushFakeTimePromises = async () => {
  const timers = await vi.importActual<typeof timersModule>('node:timers');
  await new Promise<void>((resolve) => {
    timers.setImmediate(resolve);
  });
};

/**
 * A logger that exposes the emitted log entries.
 *
 * @see {@link createMemoryLogger}
 */
export type MemoryLogger = Logger & emitter.MemoryStore;

/**
 * Creates a logger that accumulates the log entries.
 *
 * @example
 *
 * ```ts
 * const logger = createMemoryLogger();
 * logger.log('info', 'Hello, world!');
 * expect(logger.entries).toEqual([{ level: 'info', message: 'Hello, world!' }]);
 * logger.clear();
 * ```
 *
 * @param level
 * @returns
 */
export const createMemoryLogger = (
  level: LogLevel | 'off' | (() => LogLevel | 'off') = 'info',
): Logger & emitter.MemoryStore => {
  const sink = emitter.memorySink();
  const logger = emitter.createLogger(level, sink);
  return asExtendedLogger(logger, { entries: sink.entries, clear: () => sink.clear() });
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
  })(level);

  vi.spyOn(logger, 'log');
  vi.spyOn(logger as unknown as InternalTestLogger, 'emit');
  return logger as unknown as Mocked<Logger>;
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
const toHaveLoggedWith = (logger: Mocked<Logger>, level: LogLevel, expected: string | RegExp): CustomMatcherResult => {
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
      message: () => `Expected logger to not have been called with level '${level}' and message matching '${expected}'`,
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
};

/**
 * Extends the expect object with custom matchers.
 */
expect.extend({ toHaveLoggedWith });

// no-dd-sa:typescript-best-practices/no-namespace
declare module 'vitest' {
  interface AsymmetricMatchersContaining {
    toHaveLoggedWith(level: LogLevel, expected: string | RegExp): void;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveLoggedWith(level: LogLevel, expected: string | RegExp): T;
  }
}
