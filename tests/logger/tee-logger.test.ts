import { beforeEach, describe, expect, test } from '@jest/globals';

import type { LogLevel, LogMessage } from '../../src/logger/index.ts';
import { BaseLogger, OFF_LOGGER, tee } from '../../src/logger/index.ts';

describe('emitnlog.logger.tee', () => {
  // Custom test logger that extends BaseLogger and records emitted logs
  class TestLogger extends BaseLogger {
    public readonly emittedLines: {
      readonly level: LogLevel;
      readonly message: string;
      readonly args: readonly unknown[];
    }[] = [];

    protected emitLine(level: LogLevel, message: string, args: readonly unknown[]): void {
      this.emittedLines.push({ level, message, args });
    }

    public clear(): void {
      this.emittedLines.length = 0;
    }
  }

  describe('tee creation', () => {
    test('should return OFF_LOGGER when no loggers are provided', () => {
      const logger = tee();
      expect(logger).toBe(OFF_LOGGER);
    });

    test('should return the original logger when only one logger is provided', () => {
      const testLogger = new TestLogger();
      const logger = tee(testLogger);
      expect(logger).toBe(testLogger);
    });

    test('should create a new logger when multiple loggers are provided', () => {
      const logger1 = new TestLogger();
      const logger2 = new TestLogger();
      const teeLogger = tee(logger1, logger2);
      expect(teeLogger).not.toBe(logger1);
      expect(teeLogger).not.toBe(logger2);
    });
  });

  describe('level synchronization', () => {
    let logger1: TestLogger;
    let logger2: TestLogger;
    let logger3: TestLogger;
    let teeLogger: ReturnType<typeof tee>;

    beforeEach(() => {
      logger1 = new TestLogger('info');
      logger2 = new TestLogger('debug');
      logger3 = new TestLogger('warning');
      teeLogger = tee(logger1, logger2, logger3);
    });

    test('should initialize level from the first logger', () => {
      expect(teeLogger.level).toBe('info');
    });

    test('should update all loggers when level is changed', () => {
      teeLogger.level = 'error';

      expect(logger1.level).toBe('error');
      expect(logger2.level).toBe('error');
      expect(logger3.level).toBe('error');
    });

    test('should not automatically sync levels when individual loggers are changed', () => {
      logger1.level = 'emergency';

      expect(teeLogger.level).toBe('emergency'); // Reflects first logger's level
      expect(logger2.level).toBe('debug'); // Unchanged
      expect(logger3.level).toBe('warning'); // Unchanged
    });
  });

  describe('log forwarding', () => {
    let logger1: TestLogger;
    let logger2: TestLogger;
    let teeLogger: ReturnType<typeof tee>;

    beforeEach(() => {
      logger1 = new TestLogger('trace'); // Set to lowest level to catch all logs
      logger2 = new TestLogger('warning'); // Set to a higher level to test filtering
      teeLogger = tee(logger1, logger2);

      // Clear any initialization logs
      logger1.clear();
      logger2.clear();
    });

    test('should forward standard log method calls to all loggers', () => {
      teeLogger.info('Test info message');

      expect(logger1.emittedLines).toHaveLength(1);
      expect(logger1.emittedLines[0].level).toBe('info');
      expect(logger1.emittedLines[0].message).toBe('Test info message');

      // Logger2 is configured at 'warning' level so should not log 'info'
      expect(logger2.emittedLines).toHaveLength(0);

      // Now log at warning level which both should receive
      teeLogger.warning('Test warning message');

      expect(logger1.emittedLines).toHaveLength(2);
      expect(logger1.emittedLines[1].level).toBe('warning');
      expect(logger1.emittedLines[1].message).toBe('Test warning message');

      expect(logger2.emittedLines).toHaveLength(1);
      expect(logger2.emittedLines[0].level).toBe('warning');
      expect(logger2.emittedLines[0].message).toBe('Test warning message');
    });

    test('should forward template literal log method calls to all loggers', () => {
      const value = 'template value';
      teeLogger.w`Test warning with ${value}`;

      expect(logger1.emittedLines).toHaveLength(1);
      expect(logger1.emittedLines[0].level).toBe('warning');
      expect(logger1.emittedLines[0].message).toBe('Test warning with template value');

      expect(logger2.emittedLines).toHaveLength(1);
      expect(logger2.emittedLines[0].level).toBe('warning');
      expect(logger2.emittedLines[0].message).toBe('Test warning with template value');
    });

    test('should forward args method correctly', () => {
      const context = { userId: '123' };
      teeLogger.args(context).error('Error with context');

      expect(logger1.emittedLines).toHaveLength(1);
      expect(logger1.emittedLines[0].level).toBe('error');
      expect(logger1.emittedLines[0].message).toBe('Error with context');
      expect(logger1.emittedLines[0].args).toContainEqual(context);

      expect(logger2.emittedLines).toHaveLength(1);
      expect(logger2.emittedLines[0].level).toBe('error');
      expect(logger2.emittedLines[0].message).toBe('Error with context');
      expect(logger2.emittedLines[0].args).toContainEqual(context);
    });

    test('should forward Error objects correctly', () => {
      const error = new Error('Test error');
      teeLogger.error(error);

      expect(logger1.emittedLines).toHaveLength(1);
      expect(logger1.emittedLines[0].level).toBe('error');
      expect(logger1.emittedLines[0].message).toBe('Test error');
      expect(logger1.emittedLines[0].args).toContainEqual(error);

      expect(logger2.emittedLines).toHaveLength(1);
      expect(logger2.emittedLines[0].level).toBe('error');
      expect(logger2.emittedLines[0].message).toBe('Test error');
      expect(logger2.emittedLines[0].args).toContainEqual(error);
    });

    test('should forward lazy message functions correctly', () => {
      let functionCalled = false;
      const lazyMessage: LogMessage = () => {
        functionCalled = true;
        return 'Computed message';
      };

      teeLogger.critical(lazyMessage);

      expect(functionCalled).toBe(true);
      expect(logger1.emittedLines).toHaveLength(1);
      expect(logger1.emittedLines[0].level).toBe('critical');
      expect(logger1.emittedLines[0].message).toBe('Computed message');

      expect(logger2.emittedLines).toHaveLength(1);
      expect(logger2.emittedLines[0].level).toBe('critical');
      expect(logger2.emittedLines[0].message).toBe('Computed message');
    });

    test('should handle log method correctly', () => {
      teeLogger.log('emergency', 'System down');

      expect(logger1.emittedLines).toHaveLength(1);
      expect(logger1.emittedLines[0].level).toBe('emergency');
      expect(logger1.emittedLines[0].message).toBe('System down');

      expect(logger2.emittedLines).toHaveLength(1);
      expect(logger2.emittedLines[0].level).toBe('emergency');
      expect(logger2.emittedLines[0].message).toBe('System down');
    });

    test('should properly forward all log levels (trace through emergency)', () => {
      // Test all standard logging methods
      logger1.clear();
      logger2.clear();

      teeLogger.trace('Trace message');
      teeLogger.debug('Debug message');
      teeLogger.info('Info message');
      teeLogger.notice('Notice message');
      teeLogger.warning('Warning message');
      teeLogger.error('Error message');
      teeLogger.critical('Critical message');
      teeLogger.alert('Alert message');
      teeLogger.emergency('Emergency message');

      // Logger1 should receive all 9 log levels
      expect(logger1.emittedLines).toHaveLength(9);
      expect(logger1.emittedLines.map((l) => l.level)).toEqual([
        'trace',
        'debug',
        'info',
        'notice',
        'warning',
        'error',
        'critical',
        'alert',
        'emergency',
      ]);
      expect(logger1.emittedLines.map((l) => l.message)).toEqual([
        'Trace message',
        'Debug message',
        'Info message',
        'Notice message',
        'Warning message',
        'Error message',
        'Critical message',
        'Alert message',
        'Emergency message',
      ]);

      // Logger2 (warning level) should only receive higher severity levels
      expect(logger2.emittedLines).toHaveLength(5);
      expect(logger2.emittedLines.map((l) => l.level)).toEqual(['warning', 'error', 'critical', 'alert', 'emergency']);
    });

    test('should properly forward all template literal logging methods', () => {
      logger1.clear();
      logger2.clear();

      const value = 'dynamic value';

      teeLogger.t`Trace ${value}`;
      teeLogger.d`Debug ${value}`;
      teeLogger.i`Info ${value}`;
      teeLogger.n`Notice ${value}`;
      teeLogger.w`Warning ${value}`;
      teeLogger.e`Error ${value}`;
      teeLogger.c`Critical ${value}`;
      teeLogger.a`Alert ${value}`;
      teeLogger.em`Emergency ${value}`;

      // Logger1 should receive all 9 log levels
      expect(logger1.emittedLines).toHaveLength(9);
      expect(logger1.emittedLines.map((l) => l.level)).toEqual([
        'trace',
        'debug',
        'info',
        'notice',
        'warning',
        'error',
        'critical',
        'alert',
        'emergency',
      ]);

      // All messages should contain the dynamic value
      logger1.emittedLines.forEach((line) => {
        expect(line.message).toContain('dynamic value');
      });

      // Logger2 (warning level) should only receive higher severity levels
      expect(logger2.emittedLines).toHaveLength(5);
      expect(logger2.emittedLines.map((l) => l.level)).toEqual(['warning', 'error', 'critical', 'alert', 'emergency']);
    });

    test('should handle args with all logging methods', () => {
      logger1.clear();
      logger2.clear();

      const context = { traceId: '123', timestamp: Date.now() };

      // Test with all standard methods
      teeLogger.args(context).trace('Trace with context');
      teeLogger.args(context).debug('Debug with context');
      teeLogger.args(context).info('Info with context');
      teeLogger.args(context).notice('Notice with context');
      teeLogger.args(context).warning('Warning with context');
      teeLogger.args(context).error('Error with context');
      teeLogger.args(context).critical('Critical with context');
      teeLogger.args(context).alert('Alert with context');
      teeLogger.args(context).emergency('Emergency with context');

      // Verify args were passed correctly for all methods in logger1
      expect(logger1.emittedLines).toHaveLength(9);
      logger1.emittedLines.forEach((line) => {
        expect(line.args).toContainEqual(context);
      });

      // Test with template methods
      logger1.clear();
      logger2.clear();

      teeLogger.args(context).t`Trace template`;
      teeLogger.args(context).d`Debug template`;
      teeLogger.args(context).i`Info template`;
      teeLogger.args(context).n`Notice template`;
      teeLogger.args(context).w`Warning template`;
      teeLogger.args(context).e`Error template`;
      teeLogger.args(context).c`Critical template`;
      teeLogger.args(context).a`Alert template`;
      teeLogger.args(context).em`Emergency template`;

      // Verify args were passed correctly for all template methods
      expect(logger1.emittedLines).toHaveLength(9);
      logger1.emittedLines.forEach((line) => {
        expect(line.args).toContainEqual(context);
      });
    });

    test('should handle objects with error property correctly', () => {
      const errorObj = { error: new Error('Inner error message') };
      teeLogger.error(errorObj);

      expect(logger1.emittedLines).toHaveLength(1);
      expect(logger1.emittedLines[0].level).toBe('error');
      expect(logger1.emittedLines[0].message).toBe('Inner error message');
      expect(logger1.emittedLines[0].args).toContainEqual(errorObj);

      expect(logger2.emittedLines).toHaveLength(1);
      expect(logger2.emittedLines[0].level).toBe('error');
      expect(logger2.emittedLines[0].message).toBe('Inner error message');
      expect(logger2.emittedLines[0].args).toContainEqual(errorObj);
    });

    test('should ensure args are not shared between loggers', () => {
      // This test verifies that each logger gets a new args instance
      // and they don't affect each other
      const context = { id: 'test' };

      // Call args on the tee logger
      teeLogger.args(context);

      // Directly log to one of the underlying loggers, it shouldn't have the context
      logger1.info('Direct log');

      expect(logger1.emittedLines).toHaveLength(1);
      expect(logger1.emittedLines[0].message).toBe('Direct log');
      expect(logger1.emittedLines[0].args).not.toContainEqual(context);

      // Now log through the tee, it should have the context
      teeLogger.info('Tee log');

      expect(logger1.emittedLines).toHaveLength(2);
      expect(logger1.emittedLines[1].message).toBe('Tee log');
      expect(logger1.emittedLines[1].args).toContainEqual(context);
    });
  });
});
