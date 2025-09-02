import { describe, expect, test } from '@jest/globals';

import type { LogLevel } from '../../src/logger/index.ts';
import { shouldEmitEntry, toLevelSeverity } from '../../src/logger/index.ts';

describe('emitnlog.logger.level-utils', () => {
  describe('toLevelWeight', () => {
    test('should return 8 for trace level', () => {
      expect(toLevelSeverity('trace')).toBe(8);
    });

    test('should return 7 for debug level', () => {
      expect(toLevelSeverity('debug')).toBe(7);
    });

    test('should return 6 for info level', () => {
      expect(toLevelSeverity('info')).toBe(6);
    });

    test('should return 5 for notice level', () => {
      expect(toLevelSeverity('notice')).toBe(5);
    });

    test('should return 4 for warning level', () => {
      expect(toLevelSeverity('warning')).toBe(4);
    });

    test('should return 3 for error level', () => {
      expect(toLevelSeverity('error')).toBe(3);
    });

    test('should return 2 for critical level', () => {
      expect(toLevelSeverity('critical')).toBe(2);
    });

    test('should return 1 for alert level', () => {
      expect(toLevelSeverity('alert')).toBe(1);
    });

    test('should return 0 for emergency level', () => {
      expect(toLevelSeverity('emergency')).toBe(0);
    });

    test('should preserve the severity ordering', () => {
      const levels: LogLevel[] = [
        'emergency',
        'alert',
        'critical',
        'error',
        'warning',
        'notice',
        'info',
        'debug',
        'trace',
      ];

      // Verify that the weights are in ascending order
      // (lower weight = higher severity)
      for (let i = 0; i < levels.length - 1; i++) {
        expect(toLevelSeverity(levels[i])).toBeLessThan(toLevelSeverity(levels[i + 1]));
      }
    });
  });

  describe('shouldEmitEntry', () => {
    test('should return false when logger level is off', () => {
      const loggerLevel = 'off';
      const entryLevels: LogLevel[] = [
        'emergency',
        'alert',
        'critical',
        'error',
        'warning',
        'notice',
        'info',
        'debug',
        'trace',
      ];

      entryLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    test('when logger level is emergency, should only emit emergency entries', () => {
      const loggerLevel: LogLevel = 'emergency';

      expect(shouldEmitEntry(loggerLevel, 'emergency')).toBe(true);

      const filteredLevels: LogLevel[] = ['alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug', 'trace'];

      filteredLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    test('when logger level is alert, should emit alert and emergency entries', () => {
      const loggerLevel: LogLevel = 'alert';

      const emittedLevels: LogLevel[] = ['alert', 'emergency'];
      emittedLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(true);
      });

      const filteredLevels: LogLevel[] = ['critical', 'error', 'warning', 'notice', 'info', 'debug', 'trace'];

      filteredLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    test('when logger level is critical, should emit critical, alert, and emergency entries', () => {
      const loggerLevel: LogLevel = 'critical';

      const emittedLevels: LogLevel[] = ['critical', 'alert', 'emergency'];
      emittedLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(true);
      });

      const filteredLevels: LogLevel[] = ['error', 'warning', 'notice', 'info', 'debug', 'trace'];

      filteredLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    test('when logger level is error, should emit error and higher severity entries', () => {
      const loggerLevel: LogLevel = 'error';

      const emittedLevels: LogLevel[] = ['error', 'critical', 'alert', 'emergency'];
      emittedLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(true);
      });

      const filteredLevels: LogLevel[] = ['warning', 'notice', 'info', 'debug', 'trace'];

      filteredLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    test('when logger level is warning, should emit warning and higher severity entries', () => {
      const loggerLevel: LogLevel = 'warning';

      const emittedLevels: LogLevel[] = ['warning', 'error', 'critical', 'alert', 'emergency'];
      emittedLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(true);
      });

      const filteredLevels: LogLevel[] = ['notice', 'info', 'debug', 'trace'];

      filteredLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    test('when logger level is notice, should emit notice and higher severity entries', () => {
      const loggerLevel: LogLevel = 'notice';

      const emittedLevels: LogLevel[] = ['notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
      emittedLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(true);
      });

      const filteredLevels: LogLevel[] = ['info', 'debug', 'trace'];

      filteredLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    test('when logger level is info, should emit info and higher severity entries', () => {
      const loggerLevel: LogLevel = 'info';

      const emittedLevels: LogLevel[] = ['info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
      emittedLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(true);
      });

      const filteredLevels: LogLevel[] = ['debug', 'trace'];

      filteredLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    test('when logger level is debug, should emit debug and higher severity entries', () => {
      const loggerLevel: LogLevel = 'debug';

      const emittedLevels: LogLevel[] = [
        'debug',
        'info',
        'notice',
        'warning',
        'error',
        'critical',
        'alert',
        'emergency',
      ];
      emittedLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(true);
      });

      const filteredLevels: LogLevel[] = ['trace'];

      filteredLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    test('when logger level is trace, should emit all entries', () => {
      const loggerLevel: LogLevel = 'trace';

      const emittedLevels: LogLevel[] = [
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

      emittedLevels.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(true);
      });
    });
  });
});
