import { afterAll, beforeAll, describe, expect, it, jest, test } from '@jest/globals';

import type { LogLevel } from '../../src/logger/index.ts';
import { emitColorfulLine, emitLine, emitPlainLine, formatSupportsArgs } from '../../src/logger/index.ts';

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

  describe('formatSupportsArgs', () => {
    test('returns true for JSON formats', () => {
      expect(formatSupportsArgs('json')).toBe(true);
      expect(formatSupportsArgs('unformatted-json')).toBe(true);
    });

    test('returns false for non-JSON formats', () => {
      expect(formatSupportsArgs('plain')).toBe(false);
      expect(formatSupportsArgs('colorful')).toBe(false);
    });
  });

  describe('emitLine with JSON formats', () => {
    describe('json format', () => {
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
      ])('formats %s level messages correctly as JSON', (level, message) => {
        const result = emitLine(level, message, undefined, 'json');

        // Should be valid JSON
        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed.timestamp).toContain('Sun Jan 01 2023');
        expect(parsed.level).toBe(level);
        expect(parsed.message).toBe(message);
        expect(parsed.args).toBeUndefined();

        // Should be formatted (pretty-printed)
        expect(result).toContain('\n');
        expect(result).toContain('  ');
      });

      test('includes args when provided and not empty', () => {
        const args = [{ userId: 123 }, 'extra info'];
        const result = emitLine('info', 'Test with args', args, 'json');

        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed.args).toEqual(args);
        expect(parsed.timestamp).toContain('Sun Jan 01 2023');
        expect(parsed.level).toBe('info');
        expect(parsed.message).toBe('Test with args');
      });

      test('excludes args when array is empty', () => {
        const result = emitLine('info', 'Test without args', [], 'json');

        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed.args).toBeUndefined();
        expect(parsed.message).toBe('Test without args');
      });

      test('handles args serialization error gracefully', () => {
        // Create an object with circular reference
        const circular: Record<string, unknown> = { id: 'test' };
        circular.self = circular;

        const result = emitLine('error', 'Circular reference test', [circular], 'json');

        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed.args).toBeUndefined();
        expect(parsed.argsError).toBeDefined();
        expect(typeof parsed.argsError).toBe('string');
        expect(parsed.message).toBe('Circular reference test');
      });

      test('handles special characters in message', () => {
        const message = 'Message with "quotes" and \n newlines';
        const result = emitLine('info', message, undefined, 'json');

        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed.message).toBe(message);
      });
    });

    describe('unformatted-json format', () => {
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
      ])('formats %s level messages correctly as unformatted JSON', (level, message) => {
        const result = emitLine(level, message, undefined, 'unformatted-json');

        // Should be valid JSON
        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed.timestamp).toContain('Sun Jan 01 2023');
        expect(parsed.level).toBe(level);
        expect(parsed.message).toBe(message);
        expect(parsed.args).toBeUndefined();

        // Should NOT be formatted (compact)
        expect(result).not.toContain('\n');
        expect(result).not.toContain('  ');
      });

      test('includes args when provided and not empty', () => {
        const args = [{ userId: 123 }, 'extra info'];
        const result = emitLine('info', 'Test with args', args, 'unformatted-json');

        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed.args).toEqual(args);
        expect(parsed.timestamp).toContain('Sun Jan 01 2023');
        expect(parsed.level).toBe('info');
        expect(parsed.message).toBe('Test with args');

        // Should be compact
        expect(result).not.toContain('\n');
      });

      test('excludes args when array is empty', () => {
        const result = emitLine('info', 'Test without args', [], 'unformatted-json');

        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed.args).toBeUndefined();
        expect(parsed.message).toBe('Test without args');
      });

      test('handles args serialization error gracefully', () => {
        // Create an object with circular reference
        const circular: Record<string, unknown> = { id: 'test' };
        circular.self = circular;

        const result = emitLine('error', 'Circular reference test', [circular], 'unformatted-json');

        const parsed = JSON.parse(result) as Record<string, unknown>;
        expect(parsed.args).toBeUndefined();
        expect(parsed.argsError).toBeDefined();
        expect(typeof parsed.argsError).toBe('string');
        expect(parsed.message).toBe('Circular reference test');
      });
    });

    test('handles undefined args parameter', () => {
      const jsonResult = emitLine('info', 'Test message', undefined, 'json');
      const unformattedResult = emitLine('info', 'Test message', undefined, 'unformatted-json');

      const jsonParsed = JSON.parse(jsonResult) as Record<string, unknown>;
      const unformattedParsed = JSON.parse(unformattedResult) as Record<string, unknown>;

      expect(jsonParsed.args).toBeUndefined();
      expect(unformattedParsed.args).toBeUndefined();
    });
  });

  describe('emitPlainLine', () => {
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
      const result = emitPlainLine(level, message);

      expect(result).toMatch(/Sun Jan 01 2023.+\[.+\].+/);
      expect(result).toContain(`[${level.padEnd(9, ' ')}]`);
      expect(result).toContain(message);

      expect(result).toBe(emitLine(level, message, undefined, 'plain'));
    });

    test('handles empty messages', () => {
      const result = emitPlainLine('info', '');
      expect(result).toMatch(/Sun Jan 01 2023.+\[info     \] /);
    });

    test('handles messages with special characters', () => {
      const result = emitPlainLine('debug', 'Message with \n new line and "quotes"');
      expect(result).toContain('Message with \n new line and "quotes"');
      expect(result).toContain('[debug    ]');
    });

    test('handles extremely long messages', () => {
      const longMessage = 'a'.repeat(1000);
      const result = emitPlainLine('info', longMessage);
      expect(result).toContain(longMessage);
      expect(result).toContain('[info     ]');
    });

    test('handles messages with emoji', () => {
      const message = '😀 Smiley face emoji message 🚀';
      const result = emitPlainLine('info', message);
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
        const result = emitPlainLine(level, 'Test');
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

      expect(result).toBe(emitLine(level, message, undefined, 'colorful'));
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
