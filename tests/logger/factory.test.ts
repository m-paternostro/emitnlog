import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { LogLevel } from '../../src/logger/index.ts';
import {
  asExtendedLogger,
  createConsoleByLevelLogger,
  createConsoleErrorLogger,
  createConsoleLogLogger,
  toLogFormatter,
} from '../../src/logger/index.ts';
import { createMemoryLogger } from '../jester.setup.ts';

describe('emitnlog.logger.factory', () => {
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

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:30:45.123Z'));
  });

  describe('createConsoleLogLogger', () => {
    test('should create logger with default settings', () => {
      const logger = createConsoleLogLogger();

      expect(logger.level).toBe('info');
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      // Colorful format includes ANSI codes
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
    });

    test('should create logger with custom level', () => {
      const logger = createConsoleLogLogger('debug');

      expect(logger.level).toBe('debug');
      logger.debug('Debug message');
      logger.trace('Trace message'); // Should not be logged

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Debug message'));
    });

    test('should support plain format', () => {
      const logger = createConsoleLogLogger('info', 'plain');

      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith('2024-01-15T12:30:45.123Z [info     ] Test message');
    });

    test('should support json-compact format', () => {
      const logger = createConsoleLogLogger('info', 'json-compact');

      logger.info('Test message', 'arg1', 42);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"level":"info"'), 'arg1', 42);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"message":"Test message"'), 'arg1', 42);
    });

    test('should support json-pretty format', () => {
      const logger = createConsoleLogLogger('info', 'json-pretty');

      logger.info('Test message');

      const call = consoleLogSpy.mock.calls[0][0] as string;
      expect(call).toContain('"level": "info"');
      expect(call).toContain('"message": "Test message"');
      expect(call.split('\n').length).toBeGreaterThan(1); // Pretty formatted
    });

    test('should handle error logging', () => {
      const logger = createConsoleLogLogger('info', 'plain');
      const error = new Error('Test error');

      logger.error(error);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test error'), error);
    });

    test('should support all log methods', () => {
      const logger = createConsoleLogLogger('trace', 'plain');

      logger.trace('Trace');
      logger.debug('Debug');
      logger.info('Info');
      logger.notice('Notice');
      logger.warning('Warning');
      logger.error('Error');
      logger.critical('Critical');
      logger.alert('Alert');
      logger.emergency('Emergency');

      expect(consoleLogSpy).toHaveBeenCalledTimes(9);
    });
  });

  describe('createConsoleErrorLogger', () => {
    test('should create logger that outputs to console.error', () => {
      const logger = createConsoleErrorLogger();

      logger.info('Test message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('should use colorful format by default', () => {
      const logger = createConsoleErrorLogger();

      logger.error('Error message');

      const call = consoleErrorSpy.mock.calls[0][0] as string;
      // Should contain ANSI codes
      expect(call).toMatch(/\x1b\[\d+m/);
    });

    test('should support all formats', () => {
      const plainLogger = createConsoleErrorLogger('info', 'plain');
      const jsonLogger = createConsoleErrorLogger('info', 'json-compact');

      plainLogger.info('Plain');
      jsonLogger.info('JSON');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[info     ]'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"level":"info"'));
    });

    test('should respect log level', () => {
      const logger = createConsoleErrorLogger('warning');

      logger.info('Info'); // Should not be logged
      logger.warning('Warning'); // Should be logged

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Warning'));
    });
  });

  describe('createConsoleByLevelLogger', () => {
    test('should route logs based on severity', () => {
      const logger = createConsoleByLevelLogger('trace', 'plain');

      logger.debug('Debug');
      logger.info('Info');
      logger.warning('Warning');
      logger.error('Error');

      expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Debug'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Info'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Warning'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));
    });

    test('should use colorful format by default', () => {
      const logger = createConsoleByLevelLogger();

      logger.info('Test');

      const call = consoleLogSpy.mock.calls[0][0] as string;
      expect(call).toMatch(/\x1b\[\d+m/); // Contains ANSI codes
    });

    test('should respect level filtering', () => {
      const logger = createConsoleByLevelLogger('warning', 'plain');

      logger.info('Info'); // Should not be logged
      logger.warning('Warning'); // Should be logged
      logger.error('Error'); // Should be logged

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle all severity levels correctly', () => {
      const logger = createConsoleByLevelLogger('trace', 'plain');

      // Trace and Debug levels -> console.debug
      jest.clearAllMocks();
      logger.trace('Trace');
      logger.debug('Debug');

      // Both should go to console.debug
      const totalDebugCalls = consoleDebugSpy.mock.calls.length;
      expect(totalDebugCalls).toBe(2);

      // Info levels -> console.log
      jest.clearAllMocks();
      logger.info('Info');
      logger.notice('Notice');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);

      // Warning level -> console.warn
      jest.clearAllMocks();
      logger.warning('Warning');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      // Error levels -> console.error
      jest.clearAllMocks();
      logger.error('Error');
      logger.critical('Critical');
      logger.alert('Alert');
      logger.emergency('Emergency');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('toLogFormatter', () => {
    test('should return correct formatter for each format', () => {
      const plainFormatter = toLogFormatter('plain');
      const colorfulFormatter = toLogFormatter('colorful');
      const jsonCompactFormatter = toLogFormatter('json-compact');
      const jsonPrettyFormatter = toLogFormatter('json-pretty');

      const testLevel: LogLevel = 'info';
      const testMessage = 'Test';
      const testArgs: unknown[] = [];

      expect(plainFormatter(testLevel, testMessage, testArgs)).toContain('[info     ]');
      expect(colorfulFormatter(testLevel, testMessage, testArgs)).toMatch(/\x1b\[\d+m/);
      expect(jsonCompactFormatter(testLevel, testMessage, testArgs)).toContain('"level":"info"');
      expect(jsonPrettyFormatter(testLevel, testMessage, testArgs)).toContain('\n');
    });
  });

  describe('asExtendedLogger', () => {
    test('should add extensions to logger', () => {
      const baseLogger = createMemoryLogger();
      const extension = { customMethod: jest.fn(), customProperty: 'value' };

      const extendedLogger = asExtendedLogger(baseLogger, extension);

      expect(extendedLogger.customMethod).toBeDefined();
      expect(extendedLogger.customProperty).toBe('value');

      // Should still work as a logger
      extendedLogger.info('Test');
      expect(baseLogger.entries).toHaveLength(1);
    });

    test('should handle multiple extensions', () => {
      const baseLogger = createMemoryLogger();
      const ext1 = { method1: jest.fn() };
      const ext2 = { method2: jest.fn() };
      const ext3 = { property: 'value' };

      const extendedLogger = asExtendedLogger(baseLogger, ext1, ext2, ext3);

      expect(extendedLogger.method1).toBeDefined();
      expect(extendedLogger.method2).toBeDefined();
      expect(extendedLogger.property).toBe('value');
    });

    test('should handle pendingArgs correctly', () => {
      const baseLogger = createMemoryLogger();
      const extension = {};

      const extendedLogger = asExtendedLogger(baseLogger, extension);

      // Add args and then log
      extendedLogger.args('arg1', 42).info('Message');

      expect(baseLogger.entries).toHaveLength(1);
      expect(baseLogger.entries[0].message).toBe('Message');
      expect(baseLogger.entries[0].args).toEqual(['arg1', 42]);
    });

    test('should isolate pendingArgs between log calls', () => {
      const baseLogger = createMemoryLogger();
      const extension = {};

      const extendedLogger = asExtendedLogger(baseLogger, extension);

      // First log with args
      extendedLogger.args('arg1').info('First');

      // Second log without args - should not have arg1
      extendedLogger.info('Second');

      expect(baseLogger.entries).toHaveLength(2);
      expect(baseLogger.entries[0].args).toEqual(['arg1']);
      expect(baseLogger.entries[1].args).toEqual([]);
    });

    test('should accumulate multiple args calls', () => {
      const baseLogger = createMemoryLogger();
      const extension = {};

      const extendedLogger = asExtendedLogger(baseLogger, extension);

      extendedLogger.args('arg1').args('arg2', 'arg3').args({ key: 'value' }).info('Message');

      expect(baseLogger.entries).toHaveLength(1);
      expect(baseLogger.entries[0].args).toEqual(['arg1', 'arg2', 'arg3', { key: 'value' }]);
    });

    test('should handle pendingArgs with error methods', () => {
      const baseLogger = createMemoryLogger();
      const extension = {};

      const extendedLogger = asExtendedLogger(baseLogger, extension);
      const error = new Error('Test error');

      extendedLogger.args('context').error(error);

      expect(baseLogger.entries).toHaveLength(1);
      expect(baseLogger.entries[0].message).toBe('Test error');
      expect(baseLogger.entries[0].args).toEqual(['context', error]);
    });

    test('should handle pendingArgs with template literals', () => {
      const baseLogger = createMemoryLogger();
      const extension = {};

      const extendedLogger = asExtendedLogger(baseLogger, extension);

      extendedLogger.args('context').i`Template ${'value'}`;

      expect(baseLogger.entries).toHaveLength(1);
      expect(baseLogger.entries[0].message).toBe('Template value');
      expect(baseLogger.entries[0].args).toEqual(['context']);
    });

    test('should preserve level property', () => {
      const baseLogger = createMemoryLogger('warning');
      const extension = {};

      const extendedLogger = asExtendedLogger(baseLogger, extension);

      expect(extendedLogger.level).toBe('warning');
    });

    test('should preserve flush and close methods', () => {
      const baseLogger = createMemoryLogger();
      const extension = {};

      const extendedLogger = asExtendedLogger(baseLogger, extension);

      expect(extendedLogger.flush).toBeDefined();
      expect(extendedLogger.close).toBeDefined();

      extendedLogger.info('Test');
      expect(baseLogger.entries).toHaveLength(1);

      if (extendedLogger.flush) {
        void extendedLogger.flush();
      }
      expect(baseLogger.entries).toHaveLength(0);
    });

    test('should work with all log methods', () => {
      const baseLogger = createMemoryLogger('trace');
      const extension = {};

      const extendedLogger = asExtendedLogger(baseLogger, extension);

      extendedLogger.args('ctx').trace('Trace');
      extendedLogger.args('ctx').debug('Debug');
      extendedLogger.args('ctx').info('Info');
      extendedLogger.args('ctx').notice('Notice');
      extendedLogger.args('ctx').warning('Warning');
      extendedLogger.args('ctx').error('Error');
      extendedLogger.args('ctx').critical('Critical');
      extendedLogger.args('ctx').alert('Alert');
      extendedLogger.args('ctx').emergency('Emergency');
      extendedLogger.args('ctx').log('info', 'Log');

      expect(baseLogger.entries).toHaveLength(10);
      baseLogger.entries.forEach((entry) => {
        expect(entry.args).toContain('ctx');
      });
    });

    test('should work with template shorthand methods', () => {
      const baseLogger = createMemoryLogger('trace');
      const extension = {};

      const extendedLogger = asExtendedLogger(baseLogger, extension);

      extendedLogger.args('ctx').t`Trace`;
      extendedLogger.args('ctx').d`Debug`;
      extendedLogger.args('ctx').i`Info`;
      extendedLogger.args('ctx').n`Notice`;
      extendedLogger.args('ctx').w`Warning`;
      extendedLogger.args('ctx').e`Error`;
      extendedLogger.args('ctx').c`Critical`;
      extendedLogger.args('ctx').a`Alert`;
      extendedLogger.args('ctx').em`Emergency`;

      expect(baseLogger.entries).toHaveLength(9);
      baseLogger.entries.forEach((entry) => {
        expect(entry.args).toContain('ctx');
      });
    });

    test('should not share pendingArgs state between instances', () => {
      const baseLogger1 = createMemoryLogger();
      const baseLogger2 = createMemoryLogger();

      const extended1 = asExtendedLogger(baseLogger1, {});
      const extended2 = asExtendedLogger(baseLogger2, {});

      extended1.args('logger1').info('From logger 1');
      extended2.args('logger2').info('From logger 2');

      expect(baseLogger1.entries[0].args).toEqual(['logger1']);
      expect(baseLogger2.entries[0].args).toEqual(['logger2']);
    });
  });
});
