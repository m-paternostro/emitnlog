import { describe, expect, jest, test } from '@jest/globals';

import type { IsEqual } from 'type-fest';

import type { Logger, LogLevel, PrefixedLogger } from '../../src/logger/index.ts';
import { BaseLogger, OFF_LOGGER, shouldEmitEntry, withPrefix } from '../../src/logger/index.ts';
import { createTestLogger } from '../jester.setup.ts';

// Mock the shouldEmitEntry to track calls
jest.mock('../../src/logger/level-utils.ts', () => ({
  shouldEmitEntry: jest.fn().mockImplementation((level, messageLevel) => {
    // Default implementation to allow testing level filtering
    const levels = ['trace', 'debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
    const levelIndex = levels.indexOf(String(level));
    const messageLevelIndex = levels.indexOf(String(messageLevel));
    return levelIndex <= messageLevelIndex;
  }),
}));

describe('emitnlog.logger.prefixed-logger', () => {
  test('should return the original logger when prefix is empty', () => {
    const logger = createTestLogger();
    const prefixedLogger = withPrefix(logger, '');
    expect(prefixedLogger).toBe(logger);
  });

  test('should return OFF_LOGGER when logger is OFF_LOGGER', () => {
    const prefixedLogger = withPrefix(OFF_LOGGER, 'test');
    expect(prefixedLogger).toBe(OFF_LOGGER);
  });

  test('should return the correct type', () => {
    const assertPrefix = <A extends string, E extends string>(
      actual: PrefixedLogger<A>,
      expected: E,
      _test: IsEqual<A, E>,
    ): void => {
      expect(actual).toBeDefined();
      expect(expected).toBe(expected);
    };

    const logger: Logger = createTestLogger();

    const emptyPrefix = withPrefix(logger, '');
    expect(emptyPrefix).toBe(logger);
    assertPrefix(emptyPrefix, '', true);
    assertPrefix(emptyPrefix, 'test', false);

    const testPrefix = withPrefix(logger, 'test1');
    expect(testPrefix).not.toBe(logger);
    assertPrefix(testPrefix, 'test1', true);
    assertPrefix(testPrefix, '', false);
    assertPrefix(testPrefix, 'test', false);

    const combinedPrefix = withPrefix(testPrefix, '-test2');
    expect(combinedPrefix).not.toBe(logger);
    expect(combinedPrefix).not.toBe(testPrefix);
    assertPrefix(combinedPrefix, 'test1-test2', true);
    assertPrefix(combinedPrefix, '', false);
    assertPrefix(combinedPrefix, 'test1', false);
    assertPrefix(combinedPrefix, '-test2', false);

    const prefix1 = withPrefix(emptyPrefix, 'prefix1');
    expect(prefix1).not.toBe(emptyPrefix);
    assertPrefix(prefix1, 'prefix1', true);
    assertPrefix(prefix1, '', false);

    const prefix2 = withPrefix(OFF_LOGGER, 'off');
    expect(prefix2).toBe(OFF_LOGGER);
    assertPrefix(prefix2, 'off', true);
    assertPrefix(prefix2, '', false);
  });

  describe('logging methods', () => {
    test('should prepend prefix to standard logging methods', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test');

      prefixedLogger.info('Hello, world!');
      expect(logger).toHaveLoggedWith('info', 'test: Hello, world!');

      prefixedLogger.debug('Debug message');
      expect(logger).toHaveLoggedWith('debug', 'test: Debug message');

      prefixedLogger.warning('Warning message');
      expect(logger).toHaveLoggedWith('warning', 'test: Warning message');
    });

    test('should prepend prefix to template literal logging methods', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test');

      prefixedLogger.i`Value is ${42}`;
      expect(logger).toHaveLoggedWith('info', 'test: Value is 42');

      const testObj = { name: 'test' };
      prefixedLogger.d`Objects: ${testObj}`;
      expect(logger).not.toHaveLoggedWith('debug', 'test: Objects: [object Object]');
    });

    test('should prepend prefix and message separator to standard logging methods', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test', '-');

      prefixedLogger.info('Hello, world!');
      expect(logger).toHaveLoggedWith('info', 'test-Hello, world!');

      prefixedLogger.debug('Debug message');
      expect(logger).toHaveLoggedWith('debug', 'test-Debug message');

      prefixedLogger.warning('Warning message');
      expect(logger).toHaveLoggedWith('warning', 'test-Warning message');
    });

    test('should prepend prefix and message separator to template literal logging methods', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test', '-');

      prefixedLogger.i`Value is ${42}`;
      expect(logger).toHaveLoggedWith('info', 'test-Value is 42');

      const testObj = { name: 'test' };
      prefixedLogger.d`Objects: ${testObj}`;
      expect(logger).not.toHaveLoggedWith('debug', 'test-Objects: [object Object]');
    });

    test('should handle lazy message functions when using basic methods', () => {
      const emittedLines: string[] = [];
      const logger = new (class extends BaseLogger {
        protected emitLine(level: LogLevel, message: string): void {
          emittedLines.push(`[${level}] ${message}`);
        }
      })();

      const prefixedLogger = withPrefix(logger, 'test');

      let count = 0;
      const expensiveOperation = () => {
        count++;
        return 'result';
      };

      expect(emittedLines).toEqual([]);
      expect(count).toBe(0);
      //
      prefixedLogger.info(() => `Computed: ${String(expensiveOperation())}`);
      prefixedLogger.debug(() => `Computed: ${String(expensiveOperation())}`);
      prefixedLogger.warning(() => `Computed: ${String(expensiveOperation())}`);
      //
      expect(emittedLines).toEqual(['[info] test: Computed: result', '[warning] test: Computed: result']);
      expect(count).toBe(2);
    });

    test('should handle lazy message functions when using template methods', () => {
      const emittedLines: string[] = [];
      const logger = new (class extends BaseLogger {
        protected emitLine(level: LogLevel, message: string): void {
          emittedLines.push(`[${level}] ${message}`);
        }
      })();

      const prefixedLogger = withPrefix(logger, 'test');

      let count = 0;
      const expensiveOperation = () => {
        count++;
        return 'result';
      };

      expect(emittedLines).toEqual([]);
      expect(count).toBe(0);
      //
      prefixedLogger.i`Computed: ${expensiveOperation}`;
      prefixedLogger.d`Computed: ${expensiveOperation}`;
      prefixedLogger.w`Computed: ${expensiveOperation}`;
      //
      expect(emittedLines).toEqual(['[info] test: Computed: result', '[warning] test: Computed: result']);
      expect(count).toBe(2);
    });

    test('should handle lazy message stringification when using template methods', () => {
      const emittedLines: string[] = [];
      const logger = new (class extends BaseLogger {
        protected emitLine(level: LogLevel, message: string): void {
          emittedLines.push(`[${level}] ${message}`);
        }
      })();

      const prefixedLogger = withPrefix(logger, 'test');

      let count = 0;
      const expensiveStringification = {
        toString() {
          count++;
          return 'result';
        },
      };

      expect(emittedLines).toEqual([]);
      expect(count).toBe(0);
      //
      prefixedLogger.i`Computed: ${expensiveStringification}`;
      prefixedLogger.d`Computed: ${expensiveStringification}`;
      prefixedLogger.w`Computed: ${expensiveStringification}`;
      //
      expect(emittedLines).toEqual(['[info] test: Computed: result', '[warning] test: Computed: result']);
      expect(count).toBe(2);
    });

    test('should properly handle error objects', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test');
      const error = new Error('Something failed');

      prefixedLogger.error(error);

      // Should prefix the error message
      expect(logger).toHaveLoggedWith('error', 'test: Something failed');

      // The original error object should be passed as additional argument
      const logCall = logger.log.mock.calls.find(([level]) => level === 'error');
      expect(logCall?.[2]).toBe(error);
    });

    test('should properly handle error-like objects', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test');
      const errorObj = { error: 'Custom error data' };

      prefixedLogger.error(errorObj);

      // Should prefix the error message
      expect(logger).toHaveLoggedWith('error', 'test: Custom error data');

      // The original error object should be passed as additional argument
      const logCall = logger.log.mock.calls.find(([level]) => level === 'error');
      expect(logCall?.[2]).toBe(errorObj);
    });
  });

  describe('level filtering', () => {
    test('should check level before processing template literals', () => {
      const logger = createTestLogger();
      logger.level = 'info';
      const prefixedLogger = withPrefix(logger, 'test');

      // Reset the mock to clearly see if shouldEmitEntry is called
      (shouldEmitEntry as jest.Mock).mockClear();

      // This should be filtered out at the 'debug' level
      prefixedLogger.d`Debug message`;

      // Should check level before trying to process template
      expect(shouldEmitEntry).toHaveBeenCalledWith('info', 'debug');

      // The log method should not be called since level is above debug
      expect(logger.log).not.toHaveBeenCalledWith('debug', expect.anything());
    });

    test('should respect logger level for standard methods', () => {
      const logger = createTestLogger();
      logger.level = 'warning';
      const prefixedLogger = withPrefix(logger, 'test');

      prefixedLogger.info('Info message');
      prefixedLogger.debug('Debug message');
      prefixedLogger.warning('Warning message');
      prefixedLogger.error('Error message');

      // Only warning and error should be logged
      expect(logger.log).not.toHaveBeenCalledWith('info', expect.any(String));
      expect(logger.log).not.toHaveBeenCalledWith('debug', expect.any(String));
      expect(logger).toHaveLoggedWith('warning', 'test: Warning message');
      expect(logger).toHaveLoggedWith('error', 'test: Error message');
    });
  });

  describe('special cases', () => {
    test('should allow chaining with args', () => {
      const emittedLines: string[] = [];
      const emittedArgs: (readonly unknown[])[] = [];
      const logger = new (class extends BaseLogger {
        protected emitLine(level: LogLevel, message: string, args: readonly unknown[]): void {
          emittedLines.push(`[${level}] ${message}`);
          emittedArgs.push(args);
        }
      })();

      const prefixedLogger = withPrefix(logger, 'test');
      prefixedLogger.args({ id: 123 }, 42).info('User logged in');
      expect(emittedLines[0]).toBe('[info] test: User logged in');
      expect(emittedArgs[0]).toEqual([{ id: 123 }, 42]);
    });

    test('should support nested prefixes', () => {
      const baseLogger = createTestLogger();

      const appLogger = withPrefix(baseLogger, 'app');
      const userLogger = withPrefix(appLogger, '.user');

      userLogger.w`Profile updated!`;
      expect(baseLogger).toHaveLoggedWith('warning', 'app.user: Profile updated!');

      userLogger.info('Profile updated');
      expect(baseLogger).toHaveLoggedWith('info', 'app.user: Profile updated');
    });

    test('should support nested prefixes with different separators', () => {
      const baseLogger = createTestLogger();

      const appLogger = withPrefix(baseLogger, 'app', '--');
      const userLogger = withPrefix(appLogger, '.user', ' ~ ');

      userLogger.w`Profile updated!`;
      expect(baseLogger).toHaveLoggedWith('warning', 'app.user ~ Profile updated!');

      userLogger.info('Profile updated');
      expect(baseLogger).toHaveLoggedWith('info', 'app.user ~ Profile updated');
    });

    test('should handle the log method with dynamic level', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test');

      prefixedLogger.log('notice', 'Important notice');

      expect(logger).toHaveLoggedWith('notice', 'test: Important notice');
    });
  });

  describe('all log levels', () => {
    test('should prefix all log levels', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test');

      prefixedLogger.trace('Trace message');
      prefixedLogger.debug('Debug message');
      prefixedLogger.info('Info message');
      prefixedLogger.notice('Notice message');
      prefixedLogger.warning('Warning message');
      prefixedLogger.error('Error message');
      prefixedLogger.critical('Critical message');
      prefixedLogger.alert('Alert message');
      prefixedLogger.emergency('Emergency message');

      expect(logger).toHaveLoggedWith('trace', 'test: Trace message');
      expect(logger).toHaveLoggedWith('debug', 'test: Debug message');
      expect(logger).toHaveLoggedWith('info', 'test: Info message');
      expect(logger).toHaveLoggedWith('notice', 'test: Notice message');
      expect(logger).toHaveLoggedWith('warning', 'test: Warning message');
      expect(logger).toHaveLoggedWith('error', 'test: Error message');
      expect(logger).toHaveLoggedWith('critical', 'test: Critical message');
      expect(logger).toHaveLoggedWith('alert', 'test: Alert message');
      expect(logger).toHaveLoggedWith('emergency', 'test: Emergency message');
    });

    test('should prefix all short-form template methods', () => {
      const logger = createTestLogger('trace');
      const prefixedLogger = withPrefix(logger, 'test');

      prefixedLogger.t`Trace`;
      prefixedLogger.d`Debug`;
      prefixedLogger.i`Info`;
      prefixedLogger.n`Notice`;
      prefixedLogger.w`Warning`;
      prefixedLogger.e`Error`;
      prefixedLogger.c`Critical`;
      prefixedLogger.a`Alert`;
      prefixedLogger.em`Emergency`;

      expect(logger).toHaveLoggedWith('trace', 'test: Trace');
      expect(logger).toHaveLoggedWith('debug', 'test: Debug');
      expect(logger).toHaveLoggedWith('info', 'test: Info');
      expect(logger).toHaveLoggedWith('notice', 'test: Notice');
      expect(logger).toHaveLoggedWith('warning', 'test: Warning');
      expect(logger).toHaveLoggedWith('error', 'test: Error');
      expect(logger).toHaveLoggedWith('critical', 'test: Critical');
      expect(logger).toHaveLoggedWith('alert', 'test: Alert');
      expect(logger).toHaveLoggedWith('emergency', 'test: Emergency');
    });
  });
});
