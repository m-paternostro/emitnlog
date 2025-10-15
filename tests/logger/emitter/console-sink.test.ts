import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { LogLevel } from '../../../src/logger/index.ts';
import { emitter } from '../../../src/logger/index.ts';

describe('emitnlog.logger.emitter.console-sink', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.debug>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  describe('consoleLogSink', () => {
    test('should log to console.log with default formatter', () => {
      const sink = emitter.consoleLogSink();

      sink.sink('info', 'Test message', []);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/.+info.+Test message/));
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should log to console.log with custom formatter', () => {
      const customFormatter = jest.fn(
        (level: LogLevel, message: string, _args?: readonly unknown[]) => `CUSTOM: ${level} - ${message}`,
      );
      const sink = emitter.consoleLogSink(customFormatter);

      sink.sink('warning', 'Warning message', []);

      expect(customFormatter).toHaveBeenCalledWith('warning', 'Warning message', []);
      expect(consoleLogSpy).toHaveBeenCalledWith('CUSTOM: warning - Warning message');
    });

    test('should include args in console.log call', () => {
      const sink = emitter.consoleLogSink();
      const args = ['arg1', 42, { key: 'value' }];

      sink.sink('debug', 'Debug message', args);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/.+debug.+Debug message/), 'arg1', 42, {
        key: 'value',
      });
    });

    test('should handle all log levels', () => {
      const sink = emitter.consoleLogSink();
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
        sink.sink(level, `${level} message`, []);
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(levels.length);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('should not have flush or close methods', () => {
      const sink = emitter.consoleLogSink();

      expect(sink.flush).toBeUndefined();
      expect(sink.close).toBeUndefined();
    });
  });

  describe('consoleErrorSink', () => {
    test('should log to console.error with default formatter', () => {
      const sink = emitter.consoleErrorSink();

      sink.sink('error', 'Error message', []);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/.+error.+Error message/));
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('should log to console.error with custom formatter', () => {
      const customFormatter = jest.fn<emitter.LogFormatter>(
        (level: LogLevel, message: string, _args?: readonly unknown[]) => `ERROR: ${level} - ${message}`,
      );
      const sink = emitter.consoleErrorSink(customFormatter);

      sink.sink('critical', 'Critical error', []);

      expect(customFormatter).toHaveBeenCalledWith('critical', 'Critical error', []);
      expect(consoleErrorSpy).toHaveBeenCalledWith('ERROR: critical - Critical error');
    });

    test('should include args in console.error call', () => {
      const sink = emitter.consoleErrorSink();
      const error = new Error('Test error');
      const args = [error, 'additional info'];

      sink.sink('error', 'Error occurred', args);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/.+error.+Error occurred/),
        error,
        'additional info',
      );
    });

    test('should use console.error for all levels', () => {
      const sink = emitter.consoleErrorSink();
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
        sink.sink(level, `${level} message`, []);
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(levels.length);
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('consoleByLevelSink', () => {
    test('should route to console.debug for trace and debug levels', () => {
      const sink = emitter.consoleByLevelSink();

      sink.sink('trace', 'Trace message', []);
      sink.sink('debug', 'Debug message', []);

      expect(consoleDebugSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should route to console.log for info and notice levels', () => {
      const sink = emitter.consoleByLevelSink();

      sink.sink('info', 'Info message', []);
      sink.sink('notice', 'Notice message', []);

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should route to console.warn for warning level', () => {
      const sink = emitter.consoleByLevelSink();

      sink.sink('warning', 'Warning message', []);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/.+warning.+Warning message/));
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('should route to console.error for error and above levels', () => {
      const sink = emitter.consoleByLevelSink();
      const errorLevels: LogLevel[] = ['error', 'critical', 'alert', 'emergency'];

      errorLevels.forEach((level) => {
        sink.sink(level, `${level} message`, []);
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(errorLevels.length);
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    test('should use custom formatter', () => {
      const customFormatter = jest.fn(
        (level: LogLevel, message: string, _args?: readonly unknown[]) => `[${level.toUpperCase()}] ${message}`,
      );
      const sink = emitter.consoleByLevelSink(customFormatter);

      sink.sink('info', 'Info message', []);
      sink.sink('warning', 'Warning message', []);
      sink.sink('error', 'Error message', []);

      expect(customFormatter).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Info message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARNING] Warning message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error message');
    });

    test('should include args in appropriate console method', () => {
      const sink = emitter.consoleByLevelSink();
      const args = ['arg1', 42];

      sink.sink('debug', 'Debug', args);
      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.any(String), 'arg1', 42);

      sink.sink('info', 'Info', args);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(String), 'arg1', 42);

      sink.sink('warning', 'Warning', args);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.any(String), 'arg1', 42);

      sink.sink('error', 'Error', args);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(String), 'arg1', 42);
    });

    test('should handle all log levels correctly', () => {
      const sink = emitter.consoleByLevelSink();

      // Test all levels with their expected console methods
      const levelMappings: [LogLevel, jest.SpiedFunction<typeof console.log>][] = [
        ['trace', consoleDebugSpy],
        ['debug', consoleDebugSpy],
        ['info', consoleLogSpy],
        ['notice', consoleLogSpy],
        ['warning', consoleWarnSpy],
        ['error', consoleErrorSpy],
        ['critical', consoleErrorSpy],
        ['alert', consoleErrorSpy],
        ['emergency', consoleErrorSpy],
      ];

      levelMappings.forEach(([level, spy]) => {
        jest.clearAllMocks();
        sink.sink(level, `${level} message`, []);
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
