import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { LogLevel } from '../../src/logger/index.ts';
import { ConsoleErrorLogger, ConsoleLogger, OFF_LOGGER } from '../../src/logger/index.ts';
import { fromEnv } from '../../src/logger/node/environment-logger.ts';
import { FileLogger } from '../../src/logger/node/file-logger.ts';
import { createTestLogger } from '../jester.setup.ts';

// eslint-disable-next-line no-console
const originalConsoleWarn = console.warn;
// eslint-disable-next-line no-console
const originalConsoleLog = console.log;
// eslint-disable-next-line no-console
const originalConsoleError = console.error;

const mockConsoleWarn = jest.fn();
const mockConsoleLog = jest.fn();
const mockConsoleError = jest.fn();

// Mock the FileLogger since we don't want to create actual files in tests
jest.mock('../../src/logger/node/file-logger.ts', () => ({
  FileLogger: jest.fn().mockImplementation(() => createTestLogger()),
}));

describe('emitnlog.logger.environment-logger', () => {
  beforeEach(() => {
    // eslint-disable-next-line no-console
    console.warn = mockConsoleWarn;
    // eslint-disable-next-line no-console
    console.log = mockConsoleLog;
    // eslint-disable-next-line no-console
    console.error = mockConsoleError;

    mockConsoleWarn.mockClear();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    // Clear all environment variables
    delete process.env.EMITNLOG_LOGGER;
    delete process.env.EMITNLOG_LEVEL;
    delete process.env.EMITNLOG_FORMAT;

    // Clear FileLogger mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.warn = originalConsoleWarn;
    // eslint-disable-next-line no-console
    console.log = originalConsoleLog;
    // eslint-disable-next-line no-console
    console.error = originalConsoleError;
  });

  describe('fromEnv', () => {
    describe('default behavior', () => {
      test('should return OFF_LOGGER when no environment variables are set and no options provided', () => {
        const logger = fromEnv();
        expect(logger).toBe(OFF_LOGGER);
      });

      test('should return OFF_LOGGER when no environment variables are set and no fallbackLogger provided', () => {
        const logger = fromEnv({ level: 'info', format: 'plain' });
        expect(logger).toBe(OFF_LOGGER);
      });

      test('should use fallbackLogger when no EMITNLOG_LOGGER is set', () => {
        const fallbackLogger = createTestLogger();
        const returnedLogger = fromEnv({ fallbackLogger: () => fallbackLogger });
        expect(returnedLogger).toBe(fallbackLogger);
      });

      test('should pass level and format to fallbackLogger', () => {
        const fallbackLogger = createTestLogger();
        const fallbackLoggerSpy = jest.fn((..._args: unknown[]) => fallbackLogger);

        process.env.EMITNLOG_LEVEL = 'warning';
        process.env.EMITNLOG_FORMAT = 'json';

        fromEnv({ level: 'info', format: 'plain', fallbackLogger: fallbackLoggerSpy });

        expect(fallbackLoggerSpy).toHaveBeenCalledWith('warning', 'json');
      });

      test('should pass options level and format to fallbackLogger when env vars not set', () => {
        const fallbackLogger = createTestLogger();
        const fallbackLoggerSpy = jest.fn((..._args: unknown[]) => fallbackLogger);

        fromEnv({ level: 'error', format: 'colorful', fallbackLogger: fallbackLoggerSpy });

        expect(fallbackLoggerSpy).toHaveBeenCalledWith('error', 'colorful');
      });

      test('should return undefined from fallbackLogger and get OFF_LOGGER', () => {
        const logger = fromEnv({ fallbackLogger: () => undefined });
        expect(logger).toBe(OFF_LOGGER);
      });
    });

    describe('EMITNLOG_LOGGER environment variable', () => {
      test('should create ConsoleLogger when EMITNLOG_LOGGER is "console"', () => {
        process.env.EMITNLOG_LOGGER = 'console';
        const logger = fromEnv();
        expect(logger).toBeInstanceOf(ConsoleLogger);
      });

      test('should create ConsoleErrorLogger when EMITNLOG_LOGGER is "console-error"', () => {
        process.env.EMITNLOG_LOGGER = 'console-error';
        const logger = fromEnv();
        expect(logger).toBeInstanceOf(ConsoleErrorLogger);
      });

      test('should create FileLogger when EMITNLOG_LOGGER starts with "file:"', () => {
        process.env.EMITNLOG_LOGGER = 'file:/path/to/log.txt';
        fromEnv();
        expect(FileLogger).toHaveBeenCalledWith('/path/to/log.txt', undefined, undefined);
      });

      test('should create FileLogger with relative path', () => {
        process.env.EMITNLOG_LOGGER = 'file:logs/app.log';
        fromEnv();
        expect(FileLogger).toHaveBeenCalledWith('logs/app.log', undefined, undefined);
      });

      test('should create FileLogger with empty path', () => {
        process.env.EMITNLOG_LOGGER = 'file:';
        fromEnv();
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          `The value of the environment variable 'EMITNLOG_LOGGER' must provide a file path: 'file:'.\nConsult the emitnlog documentation for the list of valid loggers.`,
        );
      });

      test('should warn and return fallback for invalid EMITNLOG_LOGGER value', () => {
        process.env.EMITNLOG_LOGGER = 'invalid-logger';
        const fallbackLogger = createTestLogger();

        const logger = fromEnv({ fallbackLogger: () => fallbackLogger });

        expect(logger).toBe(fallbackLogger);
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          "The value of the environment variable 'EMITNLOG_LOGGER' is not a valid logger: 'invalid-logger'.\nConsult the emitnlog documentation for the list of valid loggers.",
        );
      });

      test('should warn and return OFF_LOGGER for invalid EMITNLOG_LOGGER value with no fallback', () => {
        process.env.EMITNLOG_LOGGER = 'invalid-logger';

        const logger = fromEnv();

        expect(logger).toBe(OFF_LOGGER);
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          "The value of the environment variable 'EMITNLOG_LOGGER' is not a valid logger: 'invalid-logger'.\nConsult the emitnlog documentation for the list of valid loggers.",
        );
      });
    });

    describe('EMITNLOG_LEVEL environment variable', () => {
      test('should use valid log levels from environment', () => {
        const levels: LogLevel[] = [
          'trace',
          'debug',
          'info',
          'notice',
          'warning',
          'error',
          'critical',
          'alert',
          'emergency',
        ];

        levels.forEach((level) => {
          process.env.EMITNLOG_LOGGER = 'console';
          process.env.EMITNLOG_LEVEL = level;

          const logger = fromEnv() as ConsoleLogger;
          expect(logger.level).toBe(level);

          // Clean up for next iteration
          delete process.env.EMITNLOG_LEVEL;
        });
      });

      test('should warn and use options level for invalid EMITNLOG_LEVEL', () => {
        process.env.EMITNLOG_LOGGER = 'console';
        process.env.EMITNLOG_LEVEL = 'invalid-level';

        const logger = fromEnv({ level: 'warning' }) as ConsoleLogger;

        expect(logger.level).toBe('warning');
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          "The value of the environment variable 'EMITNLOG_LEVEL' is not a valid level: 'invalid-level'.\nConsult the emitnlog documentation for the list of valid levels.",
        );
      });

      test('should warn and use undefined level for invalid EMITNLOG_LEVEL with no options', () => {
        process.env.EMITNLOG_LOGGER = 'console';
        process.env.EMITNLOG_LEVEL = 'invalid-level';

        const logger = fromEnv() as ConsoleLogger;

        expect(logger.level).toBe('info'); // Default level for ConsoleLogger
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          "The value of the environment variable 'EMITNLOG_LEVEL' is not a valid level: 'invalid-level'.\nConsult the emitnlog documentation for the list of valid levels.",
        );
      });

      test('should prefer environment level over options level', () => {
        process.env.EMITNLOG_LOGGER = 'console';
        process.env.EMITNLOG_LEVEL = 'error';

        const logger = fromEnv({ level: 'debug' }) as ConsoleLogger;

        expect(logger.level).toBe('error');
      });
    });

    describe('EMITNLOG_FORMAT environment variable', () => {
      test('should use valid formats from environment', () => {
        const formats = ['plain', 'colorful', 'json', 'unformatted-json'] as const;

        formats.forEach((format) => {
          process.env.EMITNLOG_LOGGER = 'console';
          process.env.EMITNLOG_FORMAT = format;

          fromEnv();

          // The format is passed to the constructor, we can't easily test it without
          // accessing private properties, but we can ensure no warnings were issued
          expect(mockConsoleWarn).not.toHaveBeenCalled();

          // Clean up for next iteration
          delete process.env.EMITNLOG_FORMAT;
          mockConsoleWarn.mockClear();
        });
      });

      test('should warn and use options format for invalid EMITNLOG_FORMAT', () => {
        process.env.EMITNLOG_LOGGER = 'console';
        process.env.EMITNLOG_FORMAT = 'invalid-format';

        fromEnv({ format: 'json' });

        expect(mockConsoleWarn).toHaveBeenCalledWith(
          "The value of the environment variable 'EMITNLOG_FORMAT' is not a valid format: 'invalid-format'.\nConsult the emitnlog documentation for the list of valid formats.",
        );
      });

      test('should warn and use undefined format for invalid EMITNLOG_FORMAT with no options', () => {
        process.env.EMITNLOG_LOGGER = 'console';
        process.env.EMITNLOG_FORMAT = 'invalid-format';

        fromEnv();

        expect(mockConsoleWarn).toHaveBeenCalledWith(
          "The value of the environment variable 'EMITNLOG_FORMAT' is not a valid format: 'invalid-format'.\nConsult the emitnlog documentation for the list of valid formats.",
        );
      });

      test('should prefer environment format over options format', () => {
        process.env.EMITNLOG_LOGGER = 'console';
        process.env.EMITNLOG_FORMAT = 'json';

        fromEnv({ format: 'plain' });

        // Should not warn since 'json' is valid
        expect(mockConsoleWarn).not.toHaveBeenCalled();
      });
    });

    describe('combined environment variables', () => {
      test('should use all environment variables together', () => {
        process.env.EMITNLOG_LOGGER = 'console-error';
        process.env.EMITNLOG_LEVEL = 'critical';
        process.env.EMITNLOG_FORMAT = 'colorful';

        const logger = fromEnv() as ConsoleErrorLogger;

        expect(logger).toBeInstanceOf(ConsoleErrorLogger);
        expect(logger.level).toBe('critical');
      });

      test('should create FileLogger with level and format', () => {
        process.env.EMITNLOG_LOGGER = 'file:test.log';
        process.env.EMITNLOG_LEVEL = 'warning';
        process.env.EMITNLOG_FORMAT = 'json';

        fromEnv();

        expect(FileLogger).toHaveBeenCalledWith('test.log', 'warning', 'json');
      });

      test('should handle mix of valid and invalid environment variables', () => {
        process.env.EMITNLOG_LOGGER = 'console';
        process.env.EMITNLOG_LEVEL = 'invalid-level';
        process.env.EMITNLOG_FORMAT = 'json';

        const logger = fromEnv({ level: 'debug' }) as ConsoleLogger;

        expect(logger).toBeInstanceOf(ConsoleLogger);
        expect(logger.level).toBe('debug'); // Falls back to options level
        expect(mockConsoleWarn).toHaveBeenCalledWith(
          "The value of the environment variable 'EMITNLOG_LEVEL' is not a valid level: 'invalid-level'.\nConsult the emitnlog documentation for the list of valid levels.",
        );
      });
    });

    describe('environment detection', () => {
      test('should work when process is undefined', () => {
        const originalProcess = global.process;
        (global as Record<string, unknown>).process = undefined;

        try {
          const logger = fromEnv();
          expect(logger).toBe(OFF_LOGGER);
        } finally {
          global.process = originalProcess;
        }
      });

      test('should work when process.env is undefined', () => {
        const originalEnv = process.env;
        (process as unknown as Record<string, unknown>).env = undefined;

        try {
          const logger = fromEnv();
          expect(logger).toBe(OFF_LOGGER);
        } finally {
          process.env = originalEnv;
        }
      });
    });

    describe('edge cases', () => {
      test('should handle empty string environment variables', () => {
        process.env.EMITNLOG_LOGGER = '';
        process.env.EMITNLOG_LEVEL = '';
        process.env.EMITNLOG_FORMAT = '';

        const logger = fromEnv();
        expect(logger).toBe(OFF_LOGGER);

        expect(mockConsoleWarn).toHaveBeenCalledTimes(0);
      });

      test('should handle whitespace-only environment variables', () => {
        process.env.EMITNLOG_LOGGER = '  ';
        process.env.EMITNLOG_LEVEL = '\t';
        process.env.EMITNLOG_FORMAT = '\n';

        const logger = fromEnv();
        expect(logger).toBe(OFF_LOGGER);

        expect(mockConsoleWarn).toHaveBeenCalledTimes(3);
      });

      test('should be case sensitive for environment variables', () => {
        process.env.EMITNLOG_LOGGER = 'CONSOLE'; // uppercase
        process.env.EMITNLOG_LEVEL = 'INFO'; // uppercase
        process.env.EMITNLOG_FORMAT = 'JSON'; // uppercase

        const logger = fromEnv();
        expect(logger).toBe(OFF_LOGGER);

        expect(mockConsoleWarn).toHaveBeenCalledTimes(3);
      });

      test('should handle file: prefix with complex paths', () => {
        const complexPaths = [
          'file:/absolute/path/with/spaces/log file.txt',
          'file:./relative/path/log.txt',
          'file:../parent/log.txt',
          'file:~/home/log.txt',
          'file:C:\\Windows\\Path\\log.txt',
        ];

        complexPaths.forEach((envValue) => {
          process.env.EMITNLOG_LOGGER = envValue;
          const expectedPath = envValue.slice(5); // Remove 'file:' prefix

          fromEnv();

          expect(FileLogger).toHaveBeenCalledWith(expectedPath, undefined, undefined);

          // Clean up for next iteration
          jest.clearAllMocks();
        });
      });
    });

    describe('options parameter', () => {
      test('should handle undefined options', () => {
        const logger = fromEnv(undefined);
        expect(logger).toBe(OFF_LOGGER);
      });

      test('should handle empty options object', () => {
        const logger = fromEnv({});
        expect(logger).toBe(OFF_LOGGER);
      });

      test('should use all provided options', () => {
        const fallbackLogger = createTestLogger();
        const fallbackLoggerSpy = jest.fn((..._args: unknown[]) => fallbackLogger);

        const logger = fromEnv({ level: 'alert', format: 'unformatted-json', fallbackLogger: fallbackLoggerSpy });

        expect(logger).toBe(fallbackLogger);
        expect(fallbackLoggerSpy).toHaveBeenCalledWith('alert', 'unformatted-json');
      });
    });
  });

  describe('integration tests', () => {
    test('should create working logger that can log messages', () => {
      process.env.EMITNLOG_LOGGER = 'console';
      process.env.EMITNLOG_LEVEL = 'info';

      const logger = fromEnv();

      logger.info('Test message');
      logger.warning('Warning message');
      logger.error('Error message');

      // ConsoleLogger uses console.log for all levels
      expect(mockConsoleLog).toHaveBeenCalledTimes(3);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test message'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Error message'));
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test('should create working console-error logger that uses console.error', () => {
      process.env.EMITNLOG_LOGGER = 'console-error';
      process.env.EMITNLOG_LEVEL = 'info';

      const logger = fromEnv();

      logger.info('Test message');
      logger.warning('Warning message');
      logger.error('Error message');

      // ConsoleErrorLogger uses console.error for all levels
      expect(mockConsoleError).toHaveBeenCalledTimes(3);
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Test message'));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Error message'));
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    test('should create FileLogger that can be used', () => {
      process.env.EMITNLOG_LOGGER = 'file:test.log';
      process.env.EMITNLOG_LEVEL = 'debug';
      process.env.EMITNLOG_FORMAT = 'json';

      const logger = fromEnv();

      expect(FileLogger).toHaveBeenCalledWith('test.log', 'debug', 'json');

      expect(() => {
        logger.debug('Debug message');
        logger.info('Info message');
      }).not.toThrow();
    });

    test('should respect logger level filtering', () => {
      process.env.EMITNLOG_LOGGER = 'console';
      process.env.EMITNLOG_LEVEL = 'warning';

      const logger = fromEnv();

      expect(logger.level).toBe('warning');

      logger.debug('This should be filtered out');
      logger.info('This should also be filtered out');
      logger.warning('This should appear');
      logger.error('This should also appear');

      // Only warning and error should be logged (debug and info are below warning level)
      expect(mockConsoleLog).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('This should appear'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('This should also appear'));

      // Verify debug and info messages were NOT logged by checking all call arguments
      const allCalls = mockConsoleLog.mock.calls.map((call) => String(call[0]));
      expect(allCalls.some((call) => call.includes('This should be filtered out'))).toBe(false);
      expect(allCalls.some((call) => call.includes('This should also be filtered out'))).toBe(false);
    });

    test('should handle complex real-world scenario', () => {
      // Simulate a real application setup
      process.env.EMITNLOG_LOGGER = 'file:logs/application.log';
      process.env.EMITNLOG_LEVEL = 'info';
      process.env.EMITNLOG_FORMAT = 'json';

      const fallbackLogger = createTestLogger();

      const logger = fromEnv({
        level: 'debug', // Should be overridden by env
        format: 'plain', // Should be overridden by env
        fallbackLogger: () => fallbackLogger, // Should not be used
      });

      expect(FileLogger).toHaveBeenCalledWith('logs/application.log', 'info', 'json');

      expect(logger).not.toBe(fallbackLogger);
      expect(logger).not.toBe(OFF_LOGGER);
    });
  });
});
