import { describe, expect, test } from 'vitest';

import {
  HIGHEST_SEVERITY_LOG_LEVEL,
  LOWEST_SEVERITY_LOG_LEVEL,
  shouldEmitEntry,
  toLevelSeverity,
} from '../../src/logger/implementation/index.ts';
import type { LogLevel } from '../../src/logger/index.ts';

describe('emitnlog.logger.level-utils', () => {
  // In order of increasing severity
  const LOG_LEVELS: readonly LogLevel[] = [
    'trace',
    'debug',
    'info',
    'notice',
    'warning',
    'error',
    'critical',
    'alert',
    'emergency',
  ] as const;

  describe('toLevelWeight', () => {
    test.each(LOG_LEVELS)('should return a numeric value for %s level', (level) => {
      const severity = toLevelSeverity(level);
      expect(typeof severity).toBe('number');
      expect(Number.isInteger(severity)).toBe(true);
      expect(severity).toBeGreaterThan(0);
    });

    test('should preserve the severity ordering', () => {
      for (let i = 0; i < LOG_LEVELS.length - 1; i++) {
        expect(toLevelSeverity(LOG_LEVELS[i])).toBeLessThan(toLevelSeverity(LOG_LEVELS[i + 1]));
      }
    });

    test('lowest level should be LOWEST_SEVERITY_LOG_LEVEL', () => {
      expect(toLevelSeverity('trace')).toBe(toLevelSeverity(LOWEST_SEVERITY_LOG_LEVEL));

      const lowest = LOG_LEVELS.reduce(
        (min, level) => (toLevelSeverity(level) < toLevelSeverity(min) ? level : min),
        LOG_LEVELS[0],
      );
      expect(lowest).toBe(LOWEST_SEVERITY_LOG_LEVEL);
    });

    test('highest level should be HIGHEST_SEVERITY_LOG_LEVEL', () => {
      expect(toLevelSeverity('emergency')).toBe(toLevelSeverity(HIGHEST_SEVERITY_LOG_LEVEL));

      const highest = LOG_LEVELS.reduce(
        (max, level) => (toLevelSeverity(level) > toLevelSeverity(max) ? level : max),
        LOG_LEVELS[0],
      );
      expect(highest).toBe(HIGHEST_SEVERITY_LOG_LEVEL);
    });
  });

  describe('shouldEmitEntry', () => {
    test('should return false when logger level is off', () => {
      const loggerLevel = 'off';
      LOG_LEVELS.forEach((entryLevel) => {
        expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
      });
    });

    const levelFilteringTests: readonly [LogLevel, readonly LogLevel[], readonly LogLevel[]][] = [
      ['emergency', ['emergency'], ['alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug', 'trace']],
      ['alert', ['emergency', 'alert'], ['critical', 'error', 'warning', 'notice', 'info', 'debug', 'trace']],
      ['critical', ['emergency', 'alert', 'critical'], ['error', 'warning', 'notice', 'info', 'debug', 'trace']],
      ['error', ['emergency', 'alert', 'critical', 'error'], ['warning', 'notice', 'info', 'debug', 'trace']],
      ['warning', ['emergency', 'alert', 'critical', 'error', 'warning'], ['notice', 'info', 'debug', 'trace']],
      ['notice', ['emergency', 'alert', 'critical', 'error', 'warning', 'notice'], ['info', 'debug', 'trace']],
      ['info', ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info'], ['debug', 'trace']],
      ['debug', ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'], ['trace']],
      ['trace', LOG_LEVELS, []],
    ];

    test.each(levelFilteringTests)(
      'when logger level is %s, should emit appropriate entries',
      (loggerLevel, emittedLevels, filteredLevels) => {
        emittedLevels.forEach((entryLevel) => {
          expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(true);
        });

        filteredLevels.forEach((entryLevel) => {
          expect(shouldEmitEntry(loggerLevel, entryLevel)).toBe(false);
        });
      },
    );
  });
});
