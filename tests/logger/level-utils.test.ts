import { describe, expect, test } from '@jest/globals';

import { shouldEmitEntry, toLevelSeverity } from '../../src/logger/implementation/index.ts';
import type { LogLevel } from '../../src/logger/index.ts';

describe('emitnlog.logger.level-utils', () => {
  describe('toLevelWeight', () => {
    const levelSeverities: readonly [LogLevel, number][] = [
      ['trace', 8],
      ['debug', 7],
      ['info', 6],
      ['notice', 5],
      ['warning', 4],
      ['error', 3],
      ['critical', 2],
      ['alert', 1],
      ['emergency', 0],
    ] as const;

    test.each(levelSeverities)('should return %d for %s level', (level, expectedSeverity) => {
      expect(toLevelSeverity(level)).toBe(expectedSeverity);
    });

    test('should preserve the severity ordering', () => {
      const levels: readonly LogLevel[] = [
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
      const entryLevels: readonly LogLevel[] = [
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

    const allLevels: readonly LogLevel[] = [
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

    const levelFilteringTests: readonly [LogLevel, readonly LogLevel[], readonly LogLevel[]][] = [
      ['emergency', ['emergency'], ['alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug', 'trace']],
      ['alert', ['emergency', 'alert'], ['critical', 'error', 'warning', 'notice', 'info', 'debug', 'trace']],
      ['critical', ['emergency', 'alert', 'critical'], ['error', 'warning', 'notice', 'info', 'debug', 'trace']],
      ['error', ['emergency', 'alert', 'critical', 'error'], ['warning', 'notice', 'info', 'debug', 'trace']],
      ['warning', ['emergency', 'alert', 'critical', 'error', 'warning'], ['notice', 'info', 'debug', 'trace']],
      ['notice', ['emergency', 'alert', 'critical', 'error', 'warning', 'notice'], ['info', 'debug', 'trace']],
      ['info', ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info'], ['debug', 'trace']],
      ['debug', ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'], ['trace']],
      ['trace', allLevels, []],
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
