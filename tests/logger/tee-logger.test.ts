import { beforeEach, describe, expect, test } from '@jest/globals';

import type { Logger, LogLevel, LogMessage } from '../../src/logger/index.ts';
import { OFF_LOGGER, tee } from '../../src/logger/index.ts';
import type { MemoryLogger } from '../jester.setup.ts';
import { createMemoryLogger } from '../jester.setup.ts';

describe('emitnlog.logger.tee', () => {
  describe('tee creation', () => {
    test('should return OFF_LOGGER when no loggers are provided', () => {
      const logger = tee();
      expect(logger).toBe(OFF_LOGGER);
    });

    test('should return the original logger when only one logger is provided', () => {
      const testLogger = createMemoryLogger();
      const logger = tee(testLogger);
      expect(logger).toBe(testLogger);
    });

    test('should create a new logger when multiple loggers are provided', () => {
      const logger1 = createMemoryLogger();
      const logger2 = createMemoryLogger();
      const teeLogger = tee(logger1, logger2);
      expect(teeLogger).not.toBe(logger1);
      expect(teeLogger).not.toBe(logger2);
    });
  });

  describe('level synchronization', () => {
    let logger1: MemoryLogger;
    let logger2: MemoryLogger;
    let logger3: MemoryLogger;
    let logger3Level: LogLevel | 'off' = 'info';
    let teeLogger: Logger;

    beforeEach(() => {
      logger1 = createMemoryLogger('error');
      logger2 = createMemoryLogger('warning');
      logger3 = createMemoryLogger(() => logger3Level);
      teeLogger = tee(logger1, logger2, logger3);
    });

    test('should initialize level from the less severe logger', () => {
      expect(teeLogger.level).toBe('info');
    });

    test('should update as levels change', () => {
      logger3Level = 'debug';
      expect(teeLogger.level).toBe('debug');
      expect(logger1.level).toBe('error');
      expect(logger2.level).toBe('warning');
      expect(logger3.level).toBe('debug');

      logger3Level = 'critical';
      expect(teeLogger.level).toBe('warning');
      expect(logger1.level).toBe('error');
      expect(logger2.level).toBe('warning');
      expect(logger3.level).toBe('critical');

      logger3Level = 'off';
      expect(teeLogger.level).toBe('warning');
      expect(logger1.level).toBe('error');
      expect(logger2.level).toBe('warning');
      expect(logger3.level).toBe('off');
    });
  });

  describe('log forwarding', () => {
    let logger1: MemoryLogger;
    let logger2: MemoryLogger;
    let teeLogger: ReturnType<typeof tee>;

    beforeEach(() => {
      logger1 = createMemoryLogger('trace'); // Set to lowest level to catch all logs
      logger2 = createMemoryLogger('warning'); // Set to a higher level to test filtering
      teeLogger = tee(logger1, logger2);

      // Clear any initialization logs
      logger1.clear();
      logger2.clear();
    });

    test('should forward standard log method calls to all loggers', () => {
      teeLogger.info('Test info message');

      expect(logger1.entries).toHaveLength(1);
      expect(logger1.entries[0].level).toBe('info');
      expect(logger1.entries[0].message).toBe('Test info message');

      // Logger2 is configured at 'warning' level so should not log 'info'
      expect(logger2.entries).toHaveLength(0);

      // Now log at warning level which both should receive
      teeLogger.warning('Test warning message');

      expect(logger1.entries).toHaveLength(2);
      expect(logger1.entries[1].level).toBe('warning');
      expect(logger1.entries[1].message).toBe('Test warning message');

      expect(logger2.entries).toHaveLength(1);
      expect(logger2.entries[0].level).toBe('warning');
      expect(logger2.entries[0].message).toBe('Test warning message');
    });

    test('should forward template literal log method calls to all loggers', () => {
      const value = 'template value';
      teeLogger.w`Test warning with ${value}`;

      expect(logger1.entries).toHaveLength(1);
      expect(logger1.entries[0].level).toBe('warning');
      expect(logger1.entries[0].message).toBe('Test warning with template value');

      expect(logger2.entries).toHaveLength(1);
      expect(logger2.entries[0].level).toBe('warning');
      expect(logger2.entries[0].message).toBe('Test warning with template value');
    });

    test('should forward args method correctly', () => {
      const context = { userId: '123' };
      teeLogger.args(context).error('Error with context');

      expect(logger1.entries).toHaveLength(1);
      expect(logger1.entries[0].level).toBe('error');
      expect(logger1.entries[0].message).toBe('Error with context');
      expect(logger1.entries[0].args).toContainEqual(context);

      expect(logger2.entries).toHaveLength(1);
      expect(logger2.entries[0].level).toBe('error');
      expect(logger2.entries[0].message).toBe('Error with context');
      expect(logger2.entries[0].args).toContainEqual(context);
    });

    test('should forward Error objects correctly', () => {
      const error = new Error('Test error');
      teeLogger.error(error);

      expect(logger1.entries).toHaveLength(1);
      expect(logger1.entries[0].level).toBe('error');
      expect(logger1.entries[0].message).toBe('Test error');
      expect(logger1.entries[0].args).toContainEqual(error);

      expect(logger2.entries).toHaveLength(1);
      expect(logger2.entries[0].level).toBe('error');
      expect(logger2.entries[0].message).toBe('Test error');
      expect(logger2.entries[0].args).toContainEqual(error);
    });

    test('should forward lazy message functions correctly', () => {
      let functionCalled = false;
      const lazyMessage: LogMessage = () => {
        functionCalled = true;
        return 'Computed message';
      };

      teeLogger.critical(lazyMessage);

      expect(functionCalled).toBe(true);
      expect(logger1.entries).toHaveLength(1);
      expect(logger1.entries[0].level).toBe('critical');
      expect(logger1.entries[0].message).toBe('Computed message');

      expect(logger2.entries).toHaveLength(1);
      expect(logger2.entries[0].level).toBe('critical');
      expect(logger2.entries[0].message).toBe('Computed message');
    });

    test('should handle log method correctly', () => {
      teeLogger.log('emergency', 'System down');

      expect(logger1.entries).toHaveLength(1);
      expect(logger1.entries[0].level).toBe('emergency');
      expect(logger1.entries[0].message).toBe('System down');

      expect(logger2.entries).toHaveLength(1);
      expect(logger2.entries[0].level).toBe('emergency');
      expect(logger2.entries[0].message).toBe('System down');
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
      expect(logger1.entries).toHaveLength(9);
      expect(logger1.entries.map((l) => l.level)).toEqual([
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
      expect(logger1.entries.map((l) => l.message)).toEqual([
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
      expect(logger2.entries).toHaveLength(5);
      expect(logger2.entries.map((l) => l.level)).toEqual(['warning', 'error', 'critical', 'alert', 'emergency']);
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
      expect(logger1.entries).toHaveLength(9);
      expect(logger1.entries.map((l) => l.level)).toEqual([
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
      logger1.entries.forEach((line) => {
        expect(line.message).toContain('dynamic value');
      });

      // Logger2 (warning level) should only receive higher severity levels
      expect(logger2.entries).toHaveLength(5);
      expect(logger2.entries.map((l) => l.level)).toEqual(['warning', 'error', 'critical', 'alert', 'emergency']);
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
      expect(logger1.entries).toHaveLength(9);
      logger1.entries.forEach((line) => {
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
      expect(logger1.entries).toHaveLength(9);
      logger1.entries.forEach((entry) => {
        expect(entry.args).toContainEqual(context);
      });
    });

    test('should handle objects with error property correctly', () => {
      const errorObj = { error: new Error('Inner error message') };
      teeLogger.error(errorObj);

      expect(logger1.entries).toHaveLength(1);
      expect(logger1.entries[0].level).toBe('error');
      expect(logger1.entries[0].message).toBe('Inner error message');
      expect(logger1.entries[0].args).toContainEqual(errorObj);

      expect(logger2.entries).toHaveLength(1);
      expect(logger2.entries[0].level).toBe('error');
      expect(logger2.entries[0].message).toBe('Inner error message');
      expect(logger2.entries[0].args).toContainEqual(errorObj);
    });

    test('should ensure args are not shared between loggers', () => {
      // This test verifies that each logger gets a new args instance
      // and they don't affect each other
      const context = { id: 'test' };

      // Call args on the tee logger
      teeLogger.args(context);

      // Directly log to one of the underlying loggers, it shouldn't have the context
      logger1.info('Direct log');

      expect(logger1.entries).toHaveLength(1);
      expect(logger1.entries[0].message).toBe('Direct log');
      expect(logger1.entries[0]).not.toHaveProperty('args');

      // Now log through the tee, it should have the context
      teeLogger.info('Tee log');

      expect(logger1.entries).toHaveLength(2);
      expect(logger1.entries[1].message).toBe('Tee log');
      expect(logger1.entries[1].args).toContainEqual(context);
    });
  });
});
