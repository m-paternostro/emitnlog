import { afterAll, beforeAll, describe, expect, it, jest, test } from '@jest/globals';

import type { LogLevel } from '../../src/logger/index.ts';
import { emitColorfulLine, emitLine } from '../../src/logger/index.ts';

// Mock Date for consistent testing
const mockDate = new Date('2023-01-01T12:00:00Z');
const originalDate = global.Date;

describe('formatter', () => {
  beforeAll(() => {
    global.Date = jest.fn(() => mockDate) as unknown as typeof Date;
  });

  afterAll(() => {
    global.Date = originalDate;
  });

  describe('emitLine', () => {
    it.each<[LogLevel, string]>([
      ['trace', 'Test message'],
      ['debug', 'Debug info'],
      ['info', 'Information'],
      ['notice', 'Notice this'],
      ['warning', 'Warning message'],
      ['error', 'Error occurred'],
      ['critical', 'Critical issue'],
      ['alert', 'Alert condition'],
      ['emergency', 'Emergency situation'],
    ])('formats %s level messages correctly', (level, message) => {
      const result = emitLine(level, message);

      // Check that the timestamp, level, and message are present
      expect(result).toMatch(/Sun Jan 01 2023.+\[.+\].+/);
      expect(result).toContain(`[${level.padEnd(9, ' ')}]`);
      expect(result).toContain(message);
    });

    test('handles empty messages', () => {
      const result = emitLine('info', '');
      expect(result).toMatch(/Sun Jan 01 2023.+\[info     \] /);
    });

    test('handles messages with special characters', () => {
      const result = emitLine('debug', 'Message with \n new line and "quotes"');
      expect(result).toContain('Message with \n new line and "quotes"');
      expect(result).toContain('[debug    ]');
    });

    test('handles extremely long messages', () => {
      const longMessage = 'a'.repeat(1000);
      const result = emitLine('info', longMessage);
      expect(result).toContain(longMessage);
      expect(result).toContain('[info     ]');
    });

    test('handles messages with emoji', () => {
      const message = '😀 Smiley face emoji message 🚀';
      const result = emitLine('info', message);
      expect(result).toContain(message);
    });

    test('properly pads all log levels to 9 characters', () => {
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

      for (const level of levels) {
        const result = emitLine(level, 'Test');
        const paddedLevel = level.padEnd(9, ' ');
        expect(result).toContain(`[${paddedLevel}]`);
      }
    });
  });

  describe('emitColorfulLine', () => {
    it.each<[LogLevel, string, string]>([
      ['trace', 'Test message', '\x1b[2m'], // dim
      ['debug', 'Debug info', '\x1b[2m'], // dim
      ['info', 'Information', '\x1b[36m'], // cyan
      ['notice', 'Notice this', '\x1b[32m'], // green
      ['warning', 'Warning message', '\x1b[33m'], // yellow
      ['error', 'Error occurred', '\x1b[31m'], // red
      ['critical', 'Critical issue', '\x1b[35m'], // magenta
      ['alert', 'Alert condition', '\x1b[1;31m'], // boldRed
      ['emergency', 'Emergency situation', '\x1b[41;37m'], // redBackground
    ])('formats %s level messages with correct color', (level, message, colorCode) => {
      const result = emitColorfulLine(level, message);

      // Check timestamp is dimmed
      expect(result).toContain('\x1b[2mSun Jan 01 2023');

      // Check level has correct color
      const paddedLevel = level.padEnd(9, ' ');
      expect(result).toContain(`${colorCode}[${paddedLevel}]\x1b[0m`);

      // Check message is present
      expect(result).toContain(message);
    });

    test('handles empty messages', () => {
      const result = emitColorfulLine('info', '');
      expect(result).toContain('\x1b[2mSun Jan 01 2023');
      expect(result).toContain('\x1b[36m[info     ]\x1b[0m');
    });

    test('handles messages with special characters', () => {
      const result = emitColorfulLine('warning', 'Warning: \nMultiline\ntext with "quotes"');
      expect(result).toContain('Warning: \nMultiline\ntext with "quotes"');
      expect(result).toContain('\x1b[33m[warning  ]\x1b[0m');
    });

    test('handles extremely long messages', () => {
      const longMessage = 'a'.repeat(1000);
      const result = emitColorfulLine('error', longMessage);
      expect(result).toContain(longMessage);
      expect(result).toContain('\x1b[31m[error    ]\x1b[0m');
    });

    test('handles messages with emoji', () => {
      const message = '😀 Smiley face emoji message 🚀';
      const result = emitColorfulLine('info', message);
      expect(result).toContain(message);
      expect(result).toContain('\x1b[36m[info     ]\x1b[0m');
    });

    test('properly applies ANSI escape sequences for different log levels', () => {
      // Test trace (dim)
      expect(emitColorfulLine('trace', 'test')).toContain('\x1b[2m[trace    ]\x1b[0m');

      // Test info (cyan)
      expect(emitColorfulLine('info', 'test')).toContain('\x1b[36m[info     ]\x1b[0m');

      // Test emergency (red background)
      expect(emitColorfulLine('emergency', 'test')).toContain('\x1b[41;37m[emergency]\x1b[0m');
    });
  });

  describe('terminalFormatter', () => {
    // Using private methods indirectly through emitColorfulLine

    test('applies dim formatting to timestamps in all log levels', () => {
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

      for (const level of levels) {
        const result = emitColorfulLine(level, 'Test');
        // Check timestamp is always dimmed regardless of level
        expect(result).toContain('\x1b[2mSun Jan 01 2023');
      }
    });

    test('preserves whitespace in formatted messages', () => {
      const result = emitColorfulLine('info', '  Indented message with    spaces  ');
      expect(result).toContain('  Indented message with    spaces  ');
    });

    test('maintains ANSI color code structure with reset marker at the end', () => {
      // Check that all ANSI color codes end with reset marker \x1b[0m
      const result = emitColorfulLine('error', 'Error message');

      // Count the number of reset markers
      const resetMarkerCount = (result.match(/\x1b\[0m/g) || []).length;

      // Should have at least 2 reset markers (timestamp + level)
      expect(resetMarkerCount).toBeGreaterThanOrEqual(2);

      // Check proper ANSI sequence structure
      expect(result).toMatch(/\x1b\[\d+(;\d+)?m.*\x1b\[0m/);
    });
  });
});
