import { describe, expect, test } from 'vitest';

import type { Logger, LogLevel } from '../../src/logger/index.ts';
import { OFF_LOGGER, withEmitLevel, withLevel, withPrefix } from '../../src/logger/index.ts';
import type { MemoryLogger } from '../vitest.setup.ts';
import { createMemoryLogger, createTestLogger } from '../vitest.setup.ts';

describe('emitnlog.logger.with-utils', () => {
  describe('withEmitLevel', () => {
    describe('OFF_LOGGER handling', () => {
      test('should return OFF_LOGGER when logger is OFF_LOGGER', () => {
        const logger = withEmitLevel(OFF_LOGGER, 'error');
        expect(logger).toBe(OFF_LOGGER);
      });

      test('should not return OFF_LOGGER when level is off', () => {
        const baseLogger = createMemoryLogger();
        const logger = withEmitLevel(baseLogger, 'off');
        expect(logger).not.toBe(OFF_LOGGER);
      });

      test('should not return OFF_LOGGER when function returns off', () => {
        const baseLogger = createMemoryLogger();
        const logger = withEmitLevel(baseLogger, () => 'off');
        expect(logger).not.toBe(OFF_LOGGER);
      });
    });

    describe('fixed level emission', () => {
      test('should emit all entries at a fixed level', () => {
        const memoryLogger = createMemoryLogger('trace');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        errorLogger.info('info message');
        errorLogger.warning('warning message');

        expect(memoryLogger.entries).toHaveLength(2);
        expect(memoryLogger.entries[0].level).toBe('error');
        expect(memoryLogger.entries[0].message).toBe('info message');
        expect(memoryLogger.entries[1].level).toBe('error');
        expect(memoryLogger.entries[1].message).toBe('warning message');
      });

      test('should emit debug messages as info', () => {
        const memoryLogger = createMemoryLogger('debug');
        const infoLogger = withEmitLevel(memoryLogger, 'info');

        infoLogger.debug('debug message');

        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('info');
        expect(memoryLogger.entries[0].message).toBe('debug message');
      });

      test('should emit info messages as critical', () => {
        const memoryLogger = createMemoryLogger('info');
        const criticalLogger = withEmitLevel(memoryLogger, 'critical');

        criticalLogger.info('info message');

        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('critical');
        expect(memoryLogger.entries[0].message).toBe('info message');
      });
    });

    describe('level filtering preservation', () => {
      test('should respect original logger level filtering', () => {
        const memoryLogger = createMemoryLogger('info');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        errorLogger.debug('debug message'); // Should be filtered out by baseLogger.level
        errorLogger.info('info message'); // Should be emitted as error
        errorLogger.warning('warning message'); // Should be emitted as error

        expect(memoryLogger.entries).toHaveLength(2);
        expect(memoryLogger.entries[0].level).toBe('error');
        expect(memoryLogger.entries[0].message).toBe('info message');
        expect(memoryLogger.entries[1].level).toBe('error');
        expect(memoryLogger.entries[1].message).toBe('warning message');
      });

      test('should filter out messages below base logger level', () => {
        const memoryLogger = createMemoryLogger('warning');
        const criticalLogger = withEmitLevel(memoryLogger, 'critical');

        criticalLogger.trace('trace message');
        criticalLogger.debug('debug message');
        criticalLogger.info('info message');
        criticalLogger.warning('warning message');
        criticalLogger.error('error message');

        expect(memoryLogger.entries).toHaveLength(2);
        expect(memoryLogger.entries[0].level).toBe('critical');
        expect(memoryLogger.entries[0].message).toBe('warning message');
        expect(memoryLogger.entries[1].level).toBe('critical');
        expect(memoryLogger.entries[1].message).toBe('error message');
      });

      test('should maintain level synchronization', () => {
        let level: LogLevel = 'info';
        const memoryLogger = createMemoryLogger(() => level);
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        expect(errorLogger.level).toBe('info');

        level = 'warning';
        expect(errorLogger.level).toBe('warning');

        level = 'critical';
        expect(errorLogger.level).toBe('critical');
      });
    });

    describe('dynamic level mapping', () => {
      test('should map levels using a function', () => {
        const memoryLogger = createMemoryLogger('trace');
        const mappedLogger = withEmitLevel(memoryLogger, (level) => {
          if (level === 'trace' || level === 'debug') {
            return 'info';
          }
          return level;
        });

        mappedLogger.trace('trace message');
        mappedLogger.debug('debug message');
        mappedLogger.info('info message');
        mappedLogger.warning('warning message');

        expect(memoryLogger.entries).toHaveLength(4);
        expect(memoryLogger.entries[0].level).toBe('info');
        expect(memoryLogger.entries[0].message).toBe('trace message');
        expect(memoryLogger.entries[1].level).toBe('info');
        expect(memoryLogger.entries[1].message).toBe('debug message');
        expect(memoryLogger.entries[2].level).toBe('info');
        expect(memoryLogger.entries[2].message).toBe('info message');
        expect(memoryLogger.entries[3].level).toBe('warning');
        expect(memoryLogger.entries[3].message).toBe('warning message');
      });

      test('should handle function returning off for specific levels', () => {
        const memoryLogger = createMemoryLogger('trace');
        const filteredLogger = withEmitLevel(memoryLogger, (level: LogLevel) => {
          if (level === 'trace' || level === 'debug') {
            return 'off';
          }
          return level;
        });

        filteredLogger.trace('trace message'); // Filtered out by function
        filteredLogger.debug('debug message'); // Filtered out by function
        filteredLogger.info('info message'); // Should be emitted
        filteredLogger.warning('warning message'); // Should be emitted

        expect(memoryLogger.entries).toHaveLength(2);
        expect(memoryLogger.entries[0].level).toBe('info');
        expect(memoryLogger.entries[0].message).toBe('info message');
        expect(memoryLogger.entries[1].level).toBe('warning');
        expect(memoryLogger.entries[1].message).toBe('warning message');
      });

      test('should handle level mapping with filtering', () => {
        const memoryLogger = createMemoryLogger('info');
        const mappedLogger = withEmitLevel(memoryLogger, (level: LogLevel) => {
          if (level === 'info') {
            return 'warning';
          }
          return 'error';
        });

        mappedLogger.debug('debug message'); // Filtered out by base logger level
        mappedLogger.info('info message'); // Mapped to warning
        mappedLogger.warning('warning message'); // Mapped to error
        mappedLogger.error('error message'); // Mapped to error

        expect(memoryLogger.entries).toHaveLength(3);
        expect(memoryLogger.entries[0].level).toBe('warning');
        expect(memoryLogger.entries[0].message).toBe('info message');
        expect(memoryLogger.entries[1].level).toBe('error');
        expect(memoryLogger.entries[1].message).toBe('warning message');
        expect(memoryLogger.entries[2].level).toBe('error');
        expect(memoryLogger.entries[2].message).toBe('error message');
      });
    });

    describe('template literal logging', () => {
      test('should emit template literals at fixed level', () => {
        const memoryLogger = createMemoryLogger('trace');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        const value = 42;
        errorLogger.i`Value is ${value}`;
        errorLogger.d`Debug value: ${value}`;

        expect(memoryLogger.entries).toHaveLength(2);
        expect(memoryLogger.entries[0].level).toBe('error');
        expect(memoryLogger.entries[0].message).toBe('Value is 42');
        expect(memoryLogger.entries[1].level).toBe('error');
        expect(memoryLogger.entries[1].message).toBe('Debug value: 42');
      });

      test('should emit template literals with mapped levels', () => {
        const memoryLogger = createMemoryLogger('trace');
        const mappedLogger = withEmitLevel(memoryLogger, (level: LogLevel) => (level === 'info' ? 'warning' : level));

        const value = 'test';
        mappedLogger.i`Info: ${value}`;
        mappedLogger.e`Error: ${value}`;

        expect(memoryLogger.entries).toHaveLength(2);
        expect(memoryLogger.entries[0].level).toBe('warning');
        expect(memoryLogger.entries[0].message).toBe('Info: test');
        expect(memoryLogger.entries[1].level).toBe('error');
        expect(memoryLogger.entries[1].message).toBe('Error: test');
      });

      test('should handle lazy evaluation in template literals', () => {
        const memoryLogger = createMemoryLogger('info');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        let count = 0;
        const expensiveOperation = () => {
          count++;
          return 'result';
        };

        errorLogger.d`Debug: ${expensiveOperation}`; // Should not execute (filtered out)
        errorLogger.i`Info: ${expensiveOperation}`; // Should execute

        expect(count).toBe(1);
        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('error');
        expect(memoryLogger.entries[0].message).toBe('Info: result');
      });
    });

    describe('lazy message functions', () => {
      test('should handle lazy message functions with fixed level', () => {
        const memoryLogger = createMemoryLogger('info');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        let count = 0;
        const lazyMessage = () => {
          count++;
          return 'computed message';
        };

        errorLogger.debug(lazyMessage); // Should not execute (filtered out)
        errorLogger.info(lazyMessage); // Should execute

        expect(count).toBe(1);
        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('error');
        expect(memoryLogger.entries[0].message).toBe('computed message');
      });

      test('should handle lazy message functions with mapped levels', () => {
        const memoryLogger = createMemoryLogger('trace');
        const mappedLogger = withEmitLevel(memoryLogger, (level: LogLevel) => (level === 'debug' ? 'info' : level));

        let debugCount = 0;
        let infoCount = 0;

        mappedLogger.debug(() => {
          debugCount++;
          return 'debug message';
        });

        mappedLogger.info(() => {
          infoCount++;
          return 'info message';
        });

        expect(debugCount).toBe(1);
        expect(infoCount).toBe(1);
        expect(memoryLogger.entries).toHaveLength(2);
        expect(memoryLogger.entries[0].level).toBe('info');
        expect(memoryLogger.entries[0].message).toBe('debug message');
        expect(memoryLogger.entries[1].level).toBe('info');
        expect(memoryLogger.entries[1].message).toBe('info message');
      });
    });

    describe('args handling', () => {
      test('should forward args with fixed level', () => {
        const memoryLogger = createMemoryLogger('info');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        const context = { userId: '123' };
        errorLogger.args(context).info('User action');

        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('error');
        expect(memoryLogger.entries[0].message).toBe('User action');
        expect(memoryLogger.entries[0].args).toContainEqual(context);
      });

      test('should forward multiple args', () => {
        const memoryLogger = createMemoryLogger('trace');
        const criticalLogger = withEmitLevel(memoryLogger, 'critical');

        criticalLogger.args('arg1', 42, { key: 'value' }).info('Message');

        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('critical');
        expect(memoryLogger.entries[0].args).toEqual(['arg1', 42, { key: 'value' }]);
      });

      test('should handle args with mapped levels', () => {
        const memoryLogger = createMemoryLogger('trace');
        const mappedLogger = withEmitLevel(memoryLogger, (level: LogLevel) => (level === 'info' ? 'warning' : level));

        const context = { traceId: 'abc123' };
        mappedLogger.args(context).info('Operation complete');

        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('warning');
        expect(memoryLogger.entries[0].message).toBe('Operation complete');
        expect(memoryLogger.entries[0].args).toContainEqual(context);
      });
    });

    describe('error handling', () => {
      test('should handle Error objects with fixed level', () => {
        const memoryLogger = createMemoryLogger('trace');
        const criticalLogger = withEmitLevel(memoryLogger, 'critical');

        const error = new Error('Something failed');
        criticalLogger.error(error);

        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('critical');
        expect(memoryLogger.entries[0].message).toBe('Something failed');
        expect(memoryLogger.entries[0].args).toContainEqual(error);
      });

      test('should handle error-like objects', () => {
        const memoryLogger = createMemoryLogger('info');
        const emergencyLogger = withEmitLevel(memoryLogger, 'emergency');

        const errorObj = { error: 'Custom error data' };
        emergencyLogger.error(errorObj);

        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('emergency');
        expect(memoryLogger.entries[0].message).toBe('Custom error data');
        expect(memoryLogger.entries[0].args).toContainEqual(errorObj);
      });
    });

    describe('all log levels', () => {
      test('should emit all log levels at fixed level', () => {
        const memoryLogger = createMemoryLogger('trace');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        errorLogger.trace('Trace');
        errorLogger.debug('Debug');
        errorLogger.info('Info');
        errorLogger.notice('Notice');
        errorLogger.warning('Warning');
        errorLogger.error('Error');
        errorLogger.critical('Critical');
        errorLogger.alert('Alert');
        errorLogger.emergency('Emergency');

        expect(memoryLogger.entries).toHaveLength(9);
        memoryLogger.entries.forEach((entry) => {
          expect(entry.level).toBe('error');
        });
      });

      test('should emit all template literal methods at fixed level', () => {
        const memoryLogger = createMemoryLogger('trace');
        const warningLogger = withEmitLevel(memoryLogger, 'warning');

        warningLogger.t`Trace`;
        warningLogger.d`Debug`;
        warningLogger.i`Info`;
        warningLogger.n`Notice`;
        warningLogger.w`Warning`;
        warningLogger.e`Error`;
        warningLogger.c`Critical`;
        warningLogger.a`Alert`;
        warningLogger.em`Emergency`;

        expect(memoryLogger.entries).toHaveLength(9);
        memoryLogger.entries.forEach((entry) => {
          expect(entry.level).toBe('warning');
        });
      });
    });

    describe('log method', () => {
      test('should handle log method with fixed level', () => {
        const memoryLogger = createMemoryLogger('trace');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        errorLogger.log('info', 'Info message');
        errorLogger.log('warning', 'Warning message');

        expect(memoryLogger.entries).toHaveLength(2);
        expect(memoryLogger.entries[0].level).toBe('error');
        expect(memoryLogger.entries[0].message).toBe('Info message');
        expect(memoryLogger.entries[1].level).toBe('error');
        expect(memoryLogger.entries[1].message).toBe('Warning message');
      });

      test('should handle log method with mapped levels', () => {
        const memoryLogger = createMemoryLogger('trace');
        const mappedLogger = withEmitLevel(memoryLogger, (level: LogLevel) => {
          if (level === 'info') return 'notice';
          if (level === 'warning') return 'error';
          return level;
        });

        mappedLogger.log('info', 'Info message');
        mappedLogger.log('warning', 'Warning message');

        expect(memoryLogger.entries).toHaveLength(2);
        expect(memoryLogger.entries[0].level).toBe('notice');
        expect(memoryLogger.entries[0].message).toBe('Info message');
        expect(memoryLogger.entries[1].level).toBe('error');
        expect(memoryLogger.entries[1].message).toBe('Warning message');
      });
    });

    describe('integration tests', () => {
      test('should work with example from documentation - fixed level', () => {
        const baseLogger = createMemoryLogger('info');
        const errorLogger = withEmitLevel(baseLogger, 'error');

        errorLogger.d`debug`; // Not emitted (filtered out by baseLogger.level)
        errorLogger.i`info`; // Emitted as an error
        errorLogger.c`critical`; // Emitted as an error

        expect(baseLogger.entries).toHaveLength(2);
        expect(baseLogger.entries[0].level).toBe('error');
        expect(baseLogger.entries[0].message).toBe('info');
        expect(baseLogger.entries[1].level).toBe('error');
        expect(baseLogger.entries[1].message).toBe('critical');
      });

      test('should work with example from documentation - dynamic level', () => {
        const baseLogger = createMemoryLogger('trace');
        const infoLogger = withEmitLevel(baseLogger, (level: LogLevel) =>
          level === 'trace' || level === 'debug' ? 'info' : level,
        );

        infoLogger.d`debug`; // Emitted as an info
        infoLogger.i`info`; // Emitted as an info
        infoLogger.c`critical`; // Emitted as a critical

        expect(baseLogger.entries).toHaveLength(3);
        expect(baseLogger.entries[0].level).toBe('info');
        expect(baseLogger.entries[0].message).toBe('debug');
        expect(baseLogger.entries[1].level).toBe('info');
        expect(baseLogger.entries[1].message).toBe('info');
        expect(baseLogger.entries[2].level).toBe('critical');
        expect(baseLogger.entries[2].message).toBe('critical');
      });

      test('should work with dynamic logger level changes', () => {
        let level: LogLevel = 'debug';
        const baseLogger = createMemoryLogger(() => level);
        const errorLogger = withEmitLevel(baseLogger, 'error');

        expect(errorLogger.level).toBe('debug');

        errorLogger.debug('debug1');
        errorLogger.info('info1');

        expect(baseLogger.entries).toHaveLength(2);

        level = 'warning';
        expect(errorLogger.level).toBe('warning');

        errorLogger.debug('debug2'); // Filtered out
        errorLogger.info('info2'); // Filtered out
        errorLogger.warning('warning1');

        expect(baseLogger.entries).toHaveLength(3);
        expect(baseLogger.entries[2].level).toBe('error');
        expect(baseLogger.entries[2].message).toBe('warning1');
      });

      test('should handle complex scenarios with multiple transformations', () => {
        const baseLogger = createMemoryLogger('trace');

        // Map trace/debug to info, then emit everything as warning
        const step1 = withEmitLevel(baseLogger, (level: LogLevel) =>
          level === 'trace' || level === 'debug' ? 'info' : level,
        );
        const step2 = withEmitLevel(step1, 'warning');

        step2.trace('trace message');
        step2.info('info message');
        step2.error('error message');

        expect(baseLogger.entries).toHaveLength(3);
        // All should be emitted as warning by step2
        expect(baseLogger.entries[0].level).toBe('warning');
        expect(baseLogger.entries[1].level).toBe('warning');
        expect(baseLogger.entries[2].level).toBe('warning');
      });

      test('should maintain separate logger instances', () => {
        const baseLogger = createMemoryLogger('trace');
        const errorLogger = withEmitLevel(baseLogger, 'error');
        const warningLogger = withEmitLevel(baseLogger, 'warning');

        errorLogger.info('from error logger');
        warningLogger.info('from warning logger');

        expect(baseLogger.entries).toHaveLength(2);
        expect(baseLogger.entries[0].level).toBe('error');
        expect(baseLogger.entries[0].message).toBe('from error logger');
        expect(baseLogger.entries[1].level).toBe('warning');
        expect(baseLogger.entries[1].message).toBe('from warning logger');
      });
    });

    describe('edge cases', () => {
      test('should handle empty message', () => {
        const memoryLogger = createMemoryLogger('trace');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        errorLogger.info('');

        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('error');
        expect(memoryLogger.entries[0].message).toBe('');
      });

      test('should handle very long messages', () => {
        const memoryLogger = createMemoryLogger('trace');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        const longMessage = 'A'.repeat(10000);
        errorLogger.info(longMessage);

        expect(memoryLogger.entries).toHaveLength(1);
        expect(memoryLogger.entries[0].level).toBe('error');
        expect(memoryLogger.entries[0].message).toBe(longMessage);
      });

      test('should handle rapid successive calls', () => {
        const memoryLogger = createMemoryLogger('trace');
        const errorLogger = withEmitLevel(memoryLogger, 'error');

        for (let i = 0; i < 100; i++) {
          errorLogger.info(`Message ${i}`);
        }

        expect(memoryLogger.entries).toHaveLength(100);
        memoryLogger.entries.forEach((entry, index) => {
          expect(entry.level).toBe('error');
          expect(entry.message).toBe(`Message ${index}`);
        });
      });

      test('should handle mapper function that always returns the same level', () => {
        const memoryLogger = createMemoryLogger('trace');
        const constantLogger = withEmitLevel(memoryLogger, () => 'notice');

        constantLogger.trace('trace');
        constantLogger.error('error');
        constantLogger.emergency('emergency');

        expect(memoryLogger.entries).toHaveLength(3);
        memoryLogger.entries.forEach((entry) => {
          expect(entry.level).toBe('notice');
        });
      });
    });

    describe('type safety', () => {
      test('should maintain Logger type', () => {
        const baseLogger: Logger = createMemoryLogger();
        const errorLogger: Logger = withEmitLevel(baseLogger, 'error');

        // Type check - should compile without errors
        errorLogger.info('test');
        errorLogger.args('context').warning('test');
        errorLogger.i`template`;
        expect(errorLogger.level).toBeDefined();
      });

      test('should work with MemoryLogger type', () => {
        const baseLogger: MemoryLogger = createMemoryLogger();
        const errorLogger = withEmitLevel(baseLogger, 'error');

        errorLogger.info('test');

        // baseLogger should still have memory store methods
        expect(baseLogger.entries).toHaveLength(1);
        baseLogger.clear();
        expect(baseLogger.entries).toHaveLength(0);
      });

      test('should work with TestLogger type', () => {
        const baseLogger = createTestLogger();
        const errorLogger = withEmitLevel(baseLogger, 'error');

        errorLogger.info('test message');

        // baseLogger should still be mockable
        expect(baseLogger).toHaveLoggedWith('error', 'test message');
      });
    });

    describe('withPrefix', () => {
      test('should work with prefixed logger', () => {
        const baseLogger = createMemoryLogger();
        const prefixedLogger = withPrefix(baseLogger, 'prefix1');

        const errorLogger = withEmitLevel(prefixedLogger, 'error');
        errorLogger.info('test message 1');
        expect(baseLogger.entries[0].message).toBe('prefix1: test message 1');

        const prefixedErrorLogger = withPrefix(errorLogger, 'prefix2');
        prefixedErrorLogger.info('test message 2');
        expect(baseLogger.entries[0].message).toBe('prefix1: test message 1');
        expect(baseLogger.entries[1].message).toBe('prefix1.prefix2: test message 2');

        errorLogger.info('test message 3');
        expect(baseLogger.entries[0].message).toBe('prefix1: test message 1');
        expect(baseLogger.entries[1].message).toBe('prefix1.prefix2: test message 2');
        expect(baseLogger.entries[2].message).toBe('prefix1: test message 3');
      });
    });
  });

  describe('withLevel', () => {
    describe('OFF_LOGGER handling', () => {
      test('should return OFF_LOGGER when logger is OFF_LOGGER', () => {
        const logger = withLevel(OFF_LOGGER, 'error');
        expect(logger).toBe(OFF_LOGGER);
      });

      test('should not return OFF_LOGGER when level is off', () => {
        const baseLogger = createMemoryLogger();
        const logger = withLevel(baseLogger, 'off');
        expect(logger).not.toBe(OFF_LOGGER);
      });

      test('should not return OFF_LOGGER when level provider returns off', () => {
        const baseLogger = createMemoryLogger('trace');
        const logger = withLevel(baseLogger, () => 'off');

        logger.error('suppressed');

        expect(logger).not.toBe(OFF_LOGGER);
        expect(logger.level).toBe('off');
        expect(baseLogger.entries).toHaveLength(0);
      });
    });

    test('should filter entries using provided level before delegating', () => {
      const memoryLogger = createMemoryLogger('trace');
      const warningLogger = withLevel(memoryLogger, 'warning');

      warningLogger.info('info message');
      warningLogger.warning('warning message');
      warningLogger.error('error message');

      expect(memoryLogger.entries).toHaveLength(2);
      expect(memoryLogger.entries[0].level).toBe('warning');
      expect(memoryLogger.entries[0].message).toBe('warning message');
      expect(memoryLogger.entries[1].level).toBe('error');
      expect(memoryLogger.entries[1].message).toBe('error message');
    });

    test('should respect base logger filtering after delegation', () => {
      const memoryLogger = createMemoryLogger('error');
      const verboseLogger = withLevel(memoryLogger, 'trace');

      verboseLogger.info('info message'); // Filtered by base logger
      verboseLogger.error('error message');

      expect(memoryLogger.entries).toHaveLength(1);
      expect(memoryLogger.entries[0].level).toBe('error');
      expect(memoryLogger.entries[0].message).toBe('error message');
    });

    test('should reflect dynamic level provider changes', () => {
      let currentLevel: LogLevel | 'off' = 'info';
      const memoryLogger = createMemoryLogger('trace');
      const adjustableLogger = withLevel(memoryLogger, () => currentLevel);

      expect(adjustableLogger.level).toBe('info');

      adjustableLogger.info('info allowed');

      currentLevel = 'error';
      expect(adjustableLogger.level).toBe('error');

      adjustableLogger.info('info suppressed');
      adjustableLogger.error('error emitted');

      currentLevel = 'off';
      expect(adjustableLogger.level).toBe('off');

      adjustableLogger.error('off suppressed');

      expect(memoryLogger.entries).toHaveLength(2);
      expect(memoryLogger.entries[0]).toMatchObject({ level: 'info', message: 'info allowed' });
      expect(memoryLogger.entries[1]).toMatchObject({ level: 'error', message: 'error emitted' });
    });

    test('should forward original entry level and args', () => {
      const memoryLogger = createMemoryLogger('trace');
      const warningLogger = withLevel(memoryLogger, 'warning');
      const context = { requestId: 'abc' };

      warningLogger.args(context).error('problem', { retry: false });

      expect(memoryLogger.entries).toHaveLength(1);
      expect(memoryLogger.entries[0].level).toBe('error');
      expect(memoryLogger.entries[0].message).toBe('problem');
      expect(memoryLogger.entries[0].args?.[0]).toBe(context);
      expect(memoryLogger.entries[0].args?.[1]).toEqual({ retry: false });
    });

    describe('withPrefix', () => {
      test('should work with prefixed logger', () => {
        const baseLogger = createMemoryLogger();
        const prefixedLogger = withPrefix(baseLogger, 'prefix1');

        const errorLogger = withLevel(prefixedLogger, 'error');
        errorLogger.critical('test message 1');
        expect(baseLogger.entries[0].message).toBe('prefix1: test message 1');

        const prefixedErrorLogger = withPrefix(errorLogger, 'prefix2');
        prefixedErrorLogger.c`test message 2`;
        expect(baseLogger.entries[0].message).toBe('prefix1: test message 1');
        expect(baseLogger.entries[1].message).toBe('prefix1.prefix2: test message 2');

        errorLogger.em`test message 3`;
        expect(baseLogger.entries[0].message).toBe('prefix1: test message 1');
        expect(baseLogger.entries[1].message).toBe('prefix1.prefix2: test message 2');
        expect(baseLogger.entries[2].message).toBe('prefix1: test message 3');
      });
    });
  });
});
