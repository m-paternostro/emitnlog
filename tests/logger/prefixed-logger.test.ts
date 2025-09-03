import { describe, expect, jest, test } from '@jest/globals';

import type { IsEqual } from 'type-fest';

import { createLogger } from '../../src/logger/emitter/index.ts';
import { shouldEmitEntry } from '../../src/logger/implementation/index.ts';
import type { Logger, LogLevel, PrefixedLogger } from '../../src/logger/index.ts';
import {
  appendPrefix,
  inspectPrefixedLogger,
  isPrefixedLogger,
  OFF_LOGGER,
  resetPrefix,
  withPrefix,
} from '../../src/logger/index.ts';
import { createTestLogger } from '../jester.setup.ts';

// Mock the shouldEmitEntry to track calls
jest.mock('../../src/logger/implementation/level-utils.ts', () => ({
  shouldEmitEntry: jest.fn().mockImplementation((level, messageLevel) => {
    // Default implementation to allow testing level filtering
    const levels = ['trace', 'debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
    const levelIndex = levels.indexOf(String(level));
    const messageLevelIndex = levels.indexOf(String(messageLevel));
    return levelIndex <= messageLevelIndex;
  }),
}));

describe('emitnlog.logger.prefixed-logger', () => {
  test('should return OFF_LOGGER when logger is OFF_LOGGER', () => {
    const prefixedLogger = withPrefix(OFF_LOGGER, 'test');
    expect(prefixedLogger).toBe(OFF_LOGGER);
  });

  describe('type system validation', () => {
    test('withPrefix should return the correct types', () => {
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
      expect(emptyPrefix).not.toBe(logger);
      assertPrefix(emptyPrefix, '', true);
      assertPrefix(emptyPrefix, 'test', false);

      const testPrefix = withPrefix(logger, 'test1');
      expect(testPrefix).not.toBe(logger);
      assertPrefix(testPrefix, 'test1', true);
      assertPrefix(testPrefix, '', false);
      assertPrefix(testPrefix, 'test', false);

      const combinedPrefix = withPrefix(testPrefix, 'test2');
      expect(combinedPrefix).not.toBe(logger);
      expect(combinedPrefix).not.toBe(testPrefix);
      assertPrefix(combinedPrefix, 'test1.test2', true);
      assertPrefix(combinedPrefix, '', false);
      assertPrefix(combinedPrefix, 'test1', false);
      assertPrefix(combinedPrefix, 'test2', false);

      const prefix1 = withPrefix(emptyPrefix, 'prefix1');
      expect(prefix1).not.toBe(emptyPrefix);
      assertPrefix(prefix1, '.prefix1', true);
      assertPrefix(prefix1, '', false);
      assertPrefix(prefix1, 'prefix1', false);

      const prefix2 = withPrefix(OFF_LOGGER, 'off');
      expect(prefix2).toBe(OFF_LOGGER);
      assertPrefix(prefix2, 'off', true);
      assertPrefix(prefix2, '', false);
    });

    test('withPrefix should handle custom separators in types', () => {
      const assertPrefixWithSeparator = <A extends string, S extends string, E extends string>(
        actual: PrefixedLogger<A, S>,
        expectedPrefix: E,
        expectedSeparator: S,
        _testPrefix: IsEqual<A, E>,
        _testSeparator: IsEqual<S, S>,
      ): void => {
        expect(actual).toBeDefined();
        expect(expectedPrefix).toBe(expectedPrefix);
        expect(expectedSeparator).toBe(expectedSeparator);
      };

      const logger: Logger = createTestLogger();

      const slashLogger = withPrefix(logger, 'API', { prefixSeparator: '/' });
      assertPrefixWithSeparator(slashLogger, 'API', '/', true, true);

      const nestedSlashLogger = withPrefix(slashLogger, 'v1');
      assertPrefixWithSeparator(nestedSlashLogger, 'API/v1', '/', true, true);
    });

    test('withPrefix should handle fallback prefix in types', () => {
      const assertFallbackPrefix = <A extends string, E extends string>(
        actual: PrefixedLogger<A>,
        expected: E,
        _test: IsEqual<A, E>,
      ): void => {
        expect(actual).toBeDefined();
        expect(expected).toBe(expected);
      };

      const logger: Logger = createTestLogger();

      const fallbackLogger = withPrefix(logger, 'Service', { fallbackPrefix: 'APP' });
      assertFallbackPrefix(fallbackLogger, 'APP.Service', true);

      // Fallback should be ignored when applied to already prefixed logger
      const existingPrefixed = withPrefix(logger, 'DB');
      const noFallbackLogger = withPrefix(existingPrefixed, 'Users', { fallbackPrefix: 'IGNORED' });
      assertFallbackPrefix(noFallbackLogger, 'DB.Users', true);
    });

    test('appendPrefix should return the correct types', () => {
      const assertAppendedPrefix = <A extends string, S extends string, E extends string>(
        actual: PrefixedLogger<A, S>,
        expected: E,
        _test: IsEqual<A, E>,
      ): void => {
        expect(actual).toBeDefined();
        expect(expected).toBe(expected);
      };

      const logger: Logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');

      const userLogger = appendPrefix(dbLogger, 'User');
      assertAppendedPrefix(userLogger, 'DB.User', true);

      const profileLogger = appendPrefix(userLogger, 'Profile');
      assertAppendedPrefix(profileLogger, 'DB.User.Profile', true);

      // Test with custom separator
      const apiLogger = withPrefix(logger, 'API', { prefixSeparator: '/' });
      const v1Logger = appendPrefix(apiLogger, 'v1');
      assertAppendedPrefix(v1Logger, 'API/v1', true);
    });

    test('resetPrefix should return the correct types', () => {
      const assertResetPrefix = <A extends string, S extends string, E extends string>(
        actual: PrefixedLogger<A, S>,
        expected: E,
        _test: IsEqual<A, E>,
      ): void => {
        expect(actual).toBeDefined();
        expect(expected).toBe(expected);
      };

      const logger: Logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');
      const userLogger = appendPrefix(dbLogger, 'User');

      // Reset should ignore existing prefix
      const apiLogger = resetPrefix(userLogger, 'API');
      assertResetPrefix(apiLogger, 'API', true);

      // Reset with custom separator
      const customLogger = resetPrefix(userLogger, 'Custom', { prefixSeparator: '/' });
      assertResetPrefix(customLogger, 'Custom', true);
    });
  });

  describe('appendPrefix', () => {
    test('should append prefix to existing prefixed logger', () => {
      const logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');
      const userLogger = appendPrefix(dbLogger, 'User');

      userLogger.info('User operation');
      expect(logger).toHaveLoggedWith('info', 'DB.User: User operation');
    });

    test('should preserve custom separators when appending', () => {
      const logger = createTestLogger();
      const apiLogger = withPrefix(logger, 'API', { prefixSeparator: '/' });
      const v1Logger = appendPrefix(apiLogger, 'v1');
      const usersLogger = appendPrefix(v1Logger, 'users');

      usersLogger.info('Processing request');
      expect(logger).toHaveLoggedWith('info', 'API/v1/users: Processing request');
    });

    test('should preserve custom message separators when appending', () => {
      const logger = createTestLogger();
      const sysLogger = withPrefix(logger, 'SYS', { messageSeparator: ' | ' });
      const authLogger = appendPrefix(sysLogger, 'Auth');

      authLogger.info('Authentication successful');
      expect(logger).toHaveLoggedWith('info', 'SYS.Auth | Authentication successful');
    });

    test('should create multiple levels of nesting', () => {
      const logger = createTestLogger();
      const serviceLogger = withPrefix(logger, 'UserService');
      const repositoryLogger = appendPrefix(serviceLogger, 'Repository');
      const cacheLogger = appendPrefix(repositoryLogger, 'Cache');

      cacheLogger.debug('Cache hit');
      expect(logger).toHaveLoggedWith('debug', 'UserService.Repository.Cache: Cache hit');
    });

    test('should maintain level synchronization', () => {
      let level: LogLevel = 'info';
      const logger = createTestLogger(() => level);
      const dbLogger = withPrefix(logger, 'DB');
      const userLogger = appendPrefix(dbLogger, 'User');

      expect(userLogger.level).toBe(logger.level);

      level = 'warning';
      expect(logger.level).toBe('warning');
      expect(dbLogger.level).toBe('warning');

      level = 'error';
      expect(userLogger.level).toBe('error');
      expect(dbLogger.level).toBe('error');
    });
  });

  describe('resetPrefix', () => {
    test('should reset prefix ignoring existing prefix', () => {
      const logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');
      const userLogger = appendPrefix(dbLogger, 'User');

      const apiLogger = resetPrefix(userLogger, 'API');

      apiLogger.info('API operation');
      expect(logger).toHaveLoggedWith('info', 'API: API operation');
    });

    test('should work with non-prefixed loggers', () => {
      const logger = createTestLogger();
      const apiLogger = resetPrefix(logger, 'API');

      apiLogger.info('API operation');
      expect(logger).toHaveLoggedWith('info', 'API: API operation');
    });

    test('should support custom separators', () => {
      const logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');

      const apiLogger = resetPrefix(dbLogger, 'API', { prefixSeparator: '/', messageSeparator: ' >> ' });
      const v1Logger = appendPrefix(apiLogger, 'v1');

      v1Logger.info('Request processed');
      expect(logger).toHaveLoggedWith('info', 'API/v1 >> Request processed');
    });
  });

  describe('isPrefixedLogger', () => {
    test('should correctly identify prefixed loggers', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test');

      expect(isPrefixedLogger(logger)).toBe(false);
      expect(isPrefixedLogger(prefixedLogger)).toBe(true);
      expect(isPrefixedLogger(OFF_LOGGER)).toBe(false);
      expect(isPrefixedLogger(null)).toBe(false);
      expect(isPrefixedLogger(undefined)).toBe(false);
    });

    test('should identify appended and reset loggers', () => {
      const logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');
      const userLogger = appendPrefix(dbLogger, 'User');
      const apiLogger = resetPrefix(userLogger, 'API');

      expect(isPrefixedLogger(dbLogger)).toBe(true);
      expect(isPrefixedLogger(userLogger)).toBe(true);
      expect(isPrefixedLogger(apiLogger)).toBe(true);
    });

    test('should handle edge cases', () => {
      const logger = createTestLogger();
      const emptyPrefixLogger = withPrefix(logger, '');

      expect(isPrefixedLogger(emptyPrefixLogger)).toBe(true);
    });
  });

  describe('inspectPrefixedLogger', () => {
    test('should return undefined for non-prefixed loggers', () => {
      const logger = createTestLogger();

      expect(inspectPrefixedLogger(logger)).toBeUndefined();
      expect(inspectPrefixedLogger(OFF_LOGGER)).toBeUndefined();
    });

    test('should return correct data for prefixed loggers', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test');

      const data = inspectPrefixedLogger(prefixedLogger);
      expect(data).toBeDefined();
      expect(data!.rootLogger).toBe(logger);
      expect(data!.prefix).toBe('test');
      expect(data!.separator).toBe('.');
      expect(data!.messageSeparator).toBe(': ');
    });

    test('should return correct data for nested prefixed loggers', () => {
      const logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');
      const userLogger = appendPrefix(dbLogger, 'User');

      const data = inspectPrefixedLogger(userLogger);
      expect(data).toBeDefined();
      expect(data!.rootLogger).toBe(logger);
      expect(data!.prefix).toBe('DB.User');
      expect(data!.separator).toBe('.');
      expect(data!.messageSeparator).toBe(': ');
    });

    test('should return correct data for custom separators', () => {
      const logger = createTestLogger();
      const apiLogger = withPrefix(logger, 'API', { prefixSeparator: '/', messageSeparator: ' >> ' });
      const v1Logger = appendPrefix(apiLogger, 'v1');

      const data = inspectPrefixedLogger(v1Logger);
      expect(data).toBeDefined();
      expect(data!.rootLogger).toBe(logger);
      expect(data!.prefix).toBe('API/v1');
      expect(data!.separator).toBe('/');
      expect(data!.messageSeparator).toBe(' >> ');
    });

    test('should return correct data for reset loggers', () => {
      const logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');
      const userLogger = appendPrefix(dbLogger, 'User');
      const apiLogger = resetPrefix(userLogger, 'API', { messageSeparator: ' | ' });

      const data = inspectPrefixedLogger(apiLogger);
      expect(data).toBeDefined();
      expect(data!.rootLogger).toBe(logger);
      expect(data!.prefix).toBe('API');
      expect(data!.separator).toBe('.');
      expect(data!.messageSeparator).toBe(' | ');
    });
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
      const prefixedLogger = withPrefix(logger, 'test', { messageSeparator: '-' });

      prefixedLogger.info('Hello, world!');
      expect(logger).toHaveLoggedWith('info', 'test-Hello, world!');

      prefixedLogger.debug('Debug message');
      expect(logger).toHaveLoggedWith('debug', 'test-Debug message');

      prefixedLogger.warning('Warning message');
      expect(logger).toHaveLoggedWith('warning', 'test-Warning message');
    });

    test('should prepend prefix and message separator to template literal logging methods', () => {
      const logger = createTestLogger();
      const prefixedLogger = withPrefix(logger, 'test', { messageSeparator: '-' });

      prefixedLogger.i`Value is ${42}`;
      expect(logger).toHaveLoggedWith('info', 'test-Value is 42');

      const testObj = { name: 'test' };
      prefixedLogger.d`Objects: ${testObj}`;
      expect(logger).not.toHaveLoggedWith('debug', 'test-Objects: [object Object]');
    });

    test('should handle lazy message functions when using basic methods', () => {
      const emittedLines: string[] = [];
      const logger = createLogger('info', (level, message) => {
        emittedLines.push(`[${level}] ${message}`);
      });

      const prefixedLogger = withPrefix(logger, 'test');

      let count = 0;
      const expensiveOperation = () => {
        count++;
        return 'result';
      };

      expect(emittedLines).toEqual([]);
      expect(count).toBe(0);
      //
      prefixedLogger.info(() => `Computed: ${expensiveOperation()}`);
      prefixedLogger.debug(() => `Computed: ${expensiveOperation()}`);
      prefixedLogger.warning(() => `Computed: ${expensiveOperation()}`);
      //
      expect(emittedLines).toEqual(['[info] test: Computed: result', '[warning] test: Computed: result']);
      expect(count).toBe(2);
    });

    test('should handle lazy message functions when using template methods', () => {
      const emittedLines: string[] = [];
      const logger = createLogger('info', (level, message) => {
        emittedLines.push(`[${level}] ${message}`);
      });

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
      const logger = createLogger('info', (level, message) => {
        emittedLines.push(`[${level}] ${message}`);
      });

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
      const logger = createTestLogger('info');
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
      const logger = createTestLogger('warning');
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
      const logger = createLogger('info', (level, message, args) => {
        emittedLines.push(`[${level}] ${message}`);
        emittedArgs.push(args);
      });

      const prefixedLogger = withPrefix(logger, 'test');
      prefixedLogger.args({ id: 123 }, 42).info('User logged in');
      expect(emittedLines[0]).toBe('[info] test: User logged in');
      expect(emittedArgs[0]).toEqual([{ id: 123 }, 42]);
    });

    test('should support nested prefixes with different levels', () => {
      let level: LogLevel | 'off' = 'debug';
      const logger = createTestLogger(() => level);
      expect(logger.level).toBe('debug');

      const appLogger = withPrefix(logger, 'app');
      expect(appLogger).not.toBe(logger);
      expect(appLogger.level).toBe('debug');

      level = 'critical';
      expect(logger.level).toBe('critical');
      expect(appLogger.level).toBe('critical');

      const userLogger = withPrefix(appLogger, '.user');
      expect(userLogger).not.toBe(logger);
      expect(userLogger).not.toBe(appLogger);
      expect(userLogger.level).toBe('critical');

      level = 'notice';
      expect(logger.level).toBe('notice');
      expect(appLogger.level).toBe('notice');
      expect(userLogger.level).toBe('notice');

      level = 'error';
      expect(logger.level).toBe('error');
      expect(appLogger.level).toBe('error');
      expect(userLogger.level).toBe('error');

      level = 'warning';
      expect(logger.level).toBe('warning');
      expect(appLogger.level).toBe('warning');
      expect(userLogger.level).toBe('warning');

      level = 'off';
      expect(logger.level).toBe('off');
      expect(appLogger.level).toBe('off');
      expect(userLogger.level).toBe('off');
    });

    test('should support nested prefixes with basic methods', () => {
      const emittedLines: string[] = [];
      const logger = createLogger('info', (level, message) => {
        emittedLines.push(`[${level}] ${message}`);
      });

      const appLogger = withPrefix(logger, 'app');

      appLogger.notice('started');
      expect(emittedLines[0]).toBe('[notice] app: started');

      const userLogger = withPrefix(appLogger, 'user');

      userLogger.warning('Profile updated!');
      expect(emittedLines[1]).toBe('[warning] app.user: Profile updated!');

      userLogger.info('Profile updated');
      expect(emittedLines[2]).toBe('[info] app.user: Profile updated');

      appLogger.emergency('done');
      expect(emittedLines[3]).toBe('[emergency] app: done');
    });

    test('should support nested prefixes with template methods', () => {
      const emittedLines: string[] = [];
      const logger = createLogger('info', (level, message) => {
        emittedLines.push(`[${level}] ${message}`);
      });

      const appLogger = withPrefix(logger, 'app');

      appLogger.n`started`;
      expect(emittedLines[0]).toBe('[notice] app: started');

      const userLogger = withPrefix(appLogger, 'user');

      userLogger.w`Profile updated!`;
      expect(emittedLines[1]).toBe('[warning] app.user: Profile updated!');

      userLogger.i`Profile updated`;
      expect(emittedLines[2]).toBe('[info] app.user: Profile updated');

      appLogger.em`done`;
      expect(emittedLines[3]).toBe('[emergency] app: done');
    });

    test('should support nested prefixes with different separators', () => {
      const emittedLines: string[] = [];
      const logger = createLogger('info', (level, message) => {
        emittedLines.push(`[${level}] ${message}`);
      });

      const appLogger = withPrefix(logger, 'app', { messageSeparator: '--' });

      appLogger.n`started`;
      expect(emittedLines[0]).toBe('[notice] app--started');

      const userLogger = withPrefix(appLogger, 'user', { messageSeparator: ' ~ ' });

      userLogger.w`Profile updated!`;
      expect(emittedLines[1]).toBe('[warning] app.user--Profile updated!');

      userLogger.i`Profile updated`;
      expect(emittedLines[2]).toBe('[info] app.user--Profile updated');

      appLogger.em`done`;
      expect(emittedLines[3]).toBe('[emergency] app--done');
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
      const logger = createTestLogger('trace');
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

  describe('empty prefix handling', () => {
    test('should not append separator when empty prefix is added to existing prefixed logger', () => {
      const logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');

      // Adding empty prefix should not append separator
      const emptyPrefixLogger = withPrefix(dbLogger, '');

      emptyPrefixLogger.info('Test message');
      expect(logger).toHaveLoggedWith('info', 'DB: Test message');

      // Verify inspection data
      const data = inspectPrefixedLogger(emptyPrefixLogger);
      expect(data!.prefix).toBe('DB');
      expect(data!.separator).toBe('.');
    });

    test('should not append separator when empty prefix is used with fallback prefix', () => {
      const logger = createTestLogger();

      // Empty prefix with fallback should not append separator
      const fallbackLogger = withPrefix(logger, '', { fallbackPrefix: 'FALLBACK' });

      fallbackLogger.info('Test message');
      expect(logger).toHaveLoggedWith('info', 'FALLBACK: Test message');

      // Verify inspection data
      const data = inspectPrefixedLogger(fallbackLogger);
      expect(data!.prefix).toBe('FALLBACK');
    });

    test('should handle empty prefix with custom separators', () => {
      const logger = createTestLogger();
      const apiLogger = withPrefix(logger, 'API', { prefixSeparator: '/', messageSeparator: ' >> ' });

      // Adding empty prefix should not append custom separator
      const emptyPrefixLogger = withPrefix(apiLogger, '');

      emptyPrefixLogger.info('Test message');
      expect(logger).toHaveLoggedWith('info', 'API >> Test message');

      // Verify inspection data
      const data = inspectPrefixedLogger(emptyPrefixLogger);
      expect(data!.prefix).toBe('API');
      expect(data!.separator).toBe('/');
      expect(data!.messageSeparator).toBe(' >> ');
    });

    test('should handle empty prefix in nested chains without breaking structure', () => {
      const logger = createTestLogger();
      const serviceLogger = withPrefix(logger, 'Service');
      const emptyLogger = withPrefix(serviceLogger, '');
      const userLogger = withPrefix(emptyLogger, 'User');

      // Chain should maintain structure: Service -> Service -> Service.User
      userLogger.info('User operation');
      expect(logger).toHaveLoggedWith('info', 'Service.User: User operation');

      // Verify each logger in the chain
      const emptyData = inspectPrefixedLogger(emptyLogger);
      expect(emptyData!.prefix).toBe('Service');

      const userData = inspectPrefixedLogger(userLogger);
      expect(userData!.prefix).toBe('Service.User');
    });

    test('should handle multiple consecutive empty prefixes', () => {
      const logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');
      const empty1 = withPrefix(dbLogger, '');
      const empty2 = withPrefix(empty1, '');
      const empty3 = withPrefix(empty2, '');
      const userLogger = withPrefix(empty3, 'User');

      // Multiple empty prefixes should not change the prefix chain
      userLogger.info('User operation');
      expect(logger).toHaveLoggedWith('info', 'DB.User: User operation');

      // All empty prefix loggers should have the same prefix as the original
      const empty1Data = inspectPrefixedLogger(empty1);
      const empty2Data = inspectPrefixedLogger(empty2);
      const empty3Data = inspectPrefixedLogger(empty3);

      expect(empty1Data!.prefix).toBe('DB');
      expect(empty2Data!.prefix).toBe('DB');
      expect(empty3Data!.prefix).toBe('DB');
    });

    test('should handle appendPrefix with empty string', () => {
      const logger = createTestLogger();
      const dbLogger = withPrefix(logger, 'DB');

      // appendPrefix with empty string should not change prefix
      const emptyAppendLogger = appendPrefix(dbLogger, '');

      emptyAppendLogger.info('Test message');
      expect(logger).toHaveLoggedWith('info', 'DB: Test message');

      // Verify inspection data
      const data = inspectPrefixedLogger(emptyAppendLogger);
      expect(data!.prefix).toBe('DB');
    });

    test('should handle resetPrefix with empty string', () => {
      const logger = createTestLogger();
      const complexLogger = withPrefix(logger, 'Complex');
      const nestedLogger = appendPrefix(complexLogger, 'Nested');

      // resetPrefix with empty string should create logger with empty prefix
      const resetEmptyLogger = resetPrefix(nestedLogger, '');

      resetEmptyLogger.info('Test message');
      expect(logger).toHaveLoggedWith('info', ': Test message');

      // Verify inspection data
      const data = inspectPrefixedLogger(resetEmptyLogger);
      expect(data!.prefix).toBe('');
      expect(data!.rootLogger).toBe(logger);
    });

    test('should handle empty prefix with fallback prefix and custom separators', () => {
      const logger = createTestLogger();

      // Empty prefix with fallback and custom separators
      const fallbackLogger = withPrefix(logger, '', {
        fallbackPrefix: 'APP',
        prefixSeparator: '/',
        messageSeparator: ' | ',
      });

      fallbackLogger.info('Test message');
      expect(logger).toHaveLoggedWith('info', 'APP | Test message');

      // Adding non-empty prefix should use custom separator
      const serviceLogger = appendPrefix(fallbackLogger, 'Service');
      serviceLogger.info('Service message');
      expect(logger).toHaveLoggedWith('info', 'APP/Service | Service message');
    });

    test('should maintain type safety with empty prefixes', () => {
      const assertType = <T extends string>(value: PrefixedLogger<T>, expectedType: T): void => {
        expect(value).toBeDefined();
        expect(expectedType).toBe(expectedType);
      };

      const logger: Logger = createTestLogger();

      // Empty prefix on fresh logger
      const emptyLogger = withPrefix(logger, '');
      assertType(emptyLogger, '');

      // Empty prefix on existing prefixed logger
      const dbLogger = withPrefix(logger, 'DB');
      const emptyOnPrefixed = withPrefix(dbLogger, '');
      assertType(emptyOnPrefixed, 'DB');

      // Empty prefix with fallback
      const fallbackLogger = withPrefix(logger, '', { fallbackPrefix: 'FALLBACK' });
      assertType(fallbackLogger, 'FALLBACK');

      // Empty appendPrefix
      const emptyAppend = appendPrefix(dbLogger, '');
      assertType(emptyAppend, 'DB');

      // Empty resetPrefix
      const emptyReset = resetPrefix(dbLogger, '');
      assertType(emptyReset, '');
    });
  });

  describe('integration tests', () => {
    test('should work with complex prefix hierarchies', () => {
      const logger = createTestLogger();

      // Create a complex hierarchy
      const appLogger = withPrefix(logger, 'APP');
      const serviceLogger = appendPrefix(appLogger, 'UserService');
      const repoLogger = appendPrefix(serviceLogger, 'Repository');
      const cacheLogger = appendPrefix(repoLogger, 'Cache');

      // Reset to a different context
      const apiLogger = resetPrefix(cacheLogger, 'API');
      const v1Logger = appendPrefix(apiLogger, 'v1');
      const authLogger = appendPrefix(v1Logger, 'auth');

      // Test logging
      cacheLogger.info('Cache operation');
      authLogger.warning('Auth warning');

      expect(logger).toHaveLoggedWith('info', 'APP.UserService.Repository.Cache: Cache operation');
      expect(logger).toHaveLoggedWith('warning', 'API.v1.auth: Auth warning');

      // Test inspection
      const cacheData = inspectPrefixedLogger(cacheLogger);
      const authData = inspectPrefixedLogger(authLogger);

      expect(cacheData!.prefix).toBe('APP.UserService.Repository.Cache');
      expect(authData!.prefix).toBe('API.v1.auth');
      expect(cacheData!.rootLogger).toBe(logger);
      expect(authData!.rootLogger).toBe(logger);
    });

    test('should handle long prefix chains with type validation', () => {
      let level: LogLevel | 'off' = 'info';
      const logger = createTestLogger(() => level);

      // Helper function to validate types at compile time
      const validateType = <T extends string>(prefixedLogger: PrefixedLogger<T>, expectedPrefix: T): void => {
        expect(prefixedLogger).toBeDefined();

        // Log a message to validate runtime behavior
        prefixedLogger.info(`Message from ${expectedPrefix}`);
        expect(logger).toHaveLoggedWith('info', `${expectedPrefix}: Message from ${expectedPrefix}`);

        // Validate inspection data
        const data = inspectPrefixedLogger(prefixedLogger);
        expect(data).toBeDefined();
        expect(data!.prefix).toBe(expectedPrefix);
        expect(data!.rootLogger).toBe(logger);
      };

      // Start with withPrefix
      const level0 = withPrefix(logger, 'L0');
      validateType(level0, 'L0');

      // Build a chain using appendPrefix
      const level1 = appendPrefix(level0, 'L1');
      validateType(level1, 'L0.L1');

      const level2 = appendPrefix(level1, 'L2');
      validateType(level2, 'L0.L1.L2');

      const level3 = appendPrefix(level2, 'L3');
      validateType(level3, 'L0.L1.L2.L3');

      const level4 = appendPrefix(level3, 'L4');
      validateType(level4, 'L0.L1.L2.L3.L4');

      const level5 = appendPrefix(level4, 'L5');
      validateType(level5, 'L0.L1.L2.L3.L4.L5');

      const level6 = appendPrefix(level5, 'L6');
      validateType(level6, 'L0.L1.L2.L3.L4.L5.L6');

      const level7 = appendPrefix(level6, 'L7');
      validateType(level7, 'L0.L1.L2.L3.L4.L5.L6.L7');

      const level8 = appendPrefix(level7, 'L8');
      validateType(level8, 'L0.L1.L2.L3.L4.L5.L6.L7.L8');

      const level9 = appendPrefix(level8, 'L9');
      validateType(level9, 'L0.L1.L2.L3.L4.L5.L6.L7.L8.L9');

      const level10 = appendPrefix(level9, 'L10');
      validateType(level10, 'L0.L1.L2.L3.L4.L5.L6.L7.L8.L9.L10');

      const level11 = appendPrefix(level10, 'L11');
      validateType(level11, 'L0.L1.L2.L3.L4.L5.L6.L7.L8.L9.L10.L11');

      const level12 = appendPrefix(level11, 'L12');
      validateType(level12, 'L0.L1.L2.L3.L4.L5.L6.L7.L8.L9.L10.L11.L12');

      const level13 = appendPrefix(level12, 'L13');
      validateType(level13, 'L0.L1.L2.L3.L4.L5.L6.L7.L8.L9.L10.L11.L12.L13');

      const level14 = appendPrefix(level13, 'L14');
      validateType(level14, 'L0.L1.L2.L3.L4.L5.L6.L7.L8.L9.L10.L11.L12.L13.L14');

      // Test that all loggers share the same level
      expect(level14.level).toBe(logger.level);
      level = 'warning';
      expect(logger.level).toBe('warning');
      expect(level0.level).toBe('warning');
      expect(level7.level).toBe('warning');

      // Test different log levels with the deepest logger
      level14.debug('This should not appear');
      level14.warning('This should appear');
      level14.error('This should also appear');

      expect(logger).not.toHaveLoggedWith('debug', 'This should not appear');
      expect(logger).toHaveLoggedWith(
        'warning',
        'L0.L1.L2.L3.L4.L5.L6.L7.L8.L9.L10.L11.L12.L13.L14: This should appear',
      );
      expect(logger).toHaveLoggedWith(
        'error',
        'L0.L1.L2.L3.L4.L5.L6.L7.L8.L9.L10.L11.L12.L13.L14: This should also appear',
      );

      level = 'info';

      // Test template literals
      const value = 42;
      level14.i`Template literal with value: ${value}`;
      expect(logger).toHaveLoggedWith(
        'info',
        'L0.L1.L2.L3.L4.L5.L6.L7.L8.L9.L10.L11.L12.L13.L14: Template literal with value: 42',
      );
    });

    test('should handle long prefix chains with custom separators', () => {
      const logger = createTestLogger();

      // Start with custom separators
      const root = withPrefix(logger, 'ROOT', { prefixSeparator: '/', messageSeparator: ' >> ' });

      // Build a chain with custom separators
      let current: PrefixedLogger = root;
      const expectedPrefixes = ['ROOT'];

      for (let i = 1; i <= 10; i++) {
        current = appendPrefix(current, `LEVEL${i}`);
        expectedPrefixes.push(`LEVEL${i}`);

        const expectedPrefix = expectedPrefixes.join('/');
        current.info(`Message from level ${i}`);
        expect(logger).toHaveLoggedWith('info', `${expectedPrefix} >> Message from level ${i}`);

        // Validate inspection
        const data = inspectPrefixedLogger(current);
        expect(data!.prefix).toBe(expectedPrefix);
        expect(data!.separator).toBe('/');
        expect(data!.messageSeparator).toBe(' >> ');
      }

      // Final validation
      const finalData = inspectPrefixedLogger(current);
      expect(finalData!.prefix).toBe('ROOT/LEVEL1/LEVEL2/LEVEL3/LEVEL4/LEVEL5/LEVEL6/LEVEL7/LEVEL8/LEVEL9/LEVEL10');
    });

    test('should handle mixed withPrefix and resetPrefix in long chains', () => {
      const logger = createTestLogger();

      // Build initial chain
      let current: PrefixedLogger = withPrefix(logger, 'INITIAL');
      current = appendPrefix(current, 'CHAIN');
      current = appendPrefix(current, 'DEEP');

      // Reset and build new chain
      current = resetPrefix(current, 'RESET');

      // Continue building
      for (let i = 1; i <= 8; i++) {
        current = appendPrefix(current, `R${i}`);

        const data = inspectPrefixedLogger(current);
        expect(data!.rootLogger).toBe(logger);

        // Test logging
        current.info(`Reset chain level ${i}`);
        //const expectedPrefix = `RESET${'.R'.repeat(i).replace(/\.R/g, '.R')}${i > 1 ? '' : '1'}`;
        const actualExpectedPrefix =
          i === 1 ? 'RESET.R1' : `RESET.${Array.from({ length: i }, (_, idx) => `R${idx + 1}`).join('.')}`;

        expect(logger).toHaveLoggedWith('info', `${actualExpectedPrefix}: Reset chain level ${i}`);
      }

      // Validate final state
      const finalData = inspectPrefixedLogger(current);
      expect(finalData!.prefix).toBe('RESET.R1.R2.R3.R4.R5.R6.R7.R8');
      expect(finalData!.rootLogger).toBe(logger);
    });

    test('should handle mixed separator configurations', () => {
      const logger = createTestLogger();

      // Start with slash separators
      const apiLogger = withPrefix(logger, 'API', { prefixSeparator: '/', messageSeparator: ' -> ' });
      const v1Logger = appendPrefix(apiLogger, 'v1');

      // Reset with dot separators
      const serviceLogger = resetPrefix(v1Logger, 'Service', { prefixSeparator: '.', messageSeparator: ': ' });
      const userLogger = appendPrefix(serviceLogger, 'User');

      v1Logger.info('API call');
      userLogger.info('User operation');

      expect(logger).toHaveLoggedWith('info', 'API/v1 -> API call');
      expect(logger).toHaveLoggedWith('info', 'Service.User: User operation');
    });

    test('should maintain type safety across all operations', () => {
      const assertType = <T extends string>(value: PrefixedLogger<T>, expectedType: T): void => {
        expect(value).toBeDefined();
        expect(expectedType).toBe(expectedType);
      };

      const logger: Logger = createTestLogger();

      const app = withPrefix(logger, 'APP');
      assertType(app, 'APP');

      const service = appendPrefix(app, 'Service');
      assertType(service, 'APP.Service');

      const user = appendPrefix(service, 'User');
      assertType(user, 'APP.Service.User');

      const api = resetPrefix(user, 'API');
      assertType(api, 'API');

      const v1 = appendPrefix(api, 'v1');
      assertType(v1, 'API.v1');

      // Test with custom separators
      const custom = withPrefix(logger, 'Custom', { prefixSeparator: '/' });
      assertType(custom, 'Custom');

      const nested = appendPrefix(custom, 'Nested');
      assertType(nested, 'Custom/Nested');
    });
  });
});
