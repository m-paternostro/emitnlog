import { beforeAll, describe, expect, test, vi } from 'vitest';

import type { LogLevel } from '../../../src/logger/index.ts';
import { emitter } from '../../../src/logger/index.ts';

describe('emitnlog.logger.emitter.formatter', () => {
  beforeAll(() => {
    // Mock Date to have consistent timestamps in tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:30:45.123Z'));
  });

  describe('basicFormatter', () => {
    test('should format with level and message', () => {
      const formatted = emitter.basicFormatter('info', 'Test message', []);
      expect(formatted).toBe('[info] Test message');
    });

    test('should ignore args in basic formatter', () => {
      const formatted = emitter.basicFormatter('error', 'Error occurred', ['arg1', 42]);
      expect(formatted).toBe('[error] Error occurred');
    });

    test('should handle all log levels', () => {
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
        const formatted = emitter.basicFormatter(level, 'Message', []);
        expect(formatted).toBe(`[${level}] Message`);
      });
    });

    test('should handle empty message', () => {
      const formatted = emitter.basicFormatter('info', '', []);
      expect(formatted).toBe('[info]');
    });

    test('should handle special characters in message', () => {
      const formatted = emitter.basicFormatter('info', 'Line 1\nLine 2\tTabbed', []);
      expect(formatted).toBe('[info] Line 1\nLine 2\tTabbed');
    });
  });

  describe('plainFormatter', () => {
    test('should format with timestamp, padded level, and message', () => {
      const formatted = emitter.plainFormatter('info', 'Test message', []);
      expect(formatted).toBe('2024-01-15T12:30:45.123Z [info     ] Test message');
    });

    test('should pad short levels correctly', () => {
      const formatted = emitter.plainFormatter('info', 'Message', []);
      expect(formatted).toContain('[info     ]');
    });

    test('should pad long levels correctly', () => {
      const formatted = emitter.plainFormatter('emergency', 'Message', []);
      expect(formatted).toContain('[emergency]');
    });

    test('should ignore args in plain formatter', () => {
      const formatted = emitter.plainFormatter('debug', 'Debug info', ['ignored', 'args']);
      expect(formatted).toBe('2024-01-15T12:30:45.123Z [debug    ] Debug info');
    });

    test('should handle all log levels with proper padding', () => {
      const expectedPadding: Record<LogLevel, string> = {
        trace: '[trace    ]',
        debug: '[debug    ]',
        info: '[info     ]',
        notice: '[notice   ]',
        warning: '[warning  ]',
        error: '[error    ]',
        critical: '[critical ]',
        alert: '[alert    ]',
        emergency: '[emergency]',
      };

      Object.entries(expectedPadding).forEach(([level, expected]) => {
        const formatted = emitter.plainFormatter(level as LogLevel, 'Message', []);
        expect(formatted).toContain(expected);
      });
    });
  });

  describe('colorfulFormatter', () => {
    test('should format with dimmed timestamp, decorated level, and message', () => {
      const formatted = emitter.colorfulFormatter('info', 'Test message', []);

      // Should contain ANSI codes for dimming and colors
      expect(formatted).toContain('[info     ]');
      expect(formatted).toContain('Test message');
      // Check for ANSI escape codes
      expect(formatted).toMatch(/\x1b\[\d+m/);
    });

    test('should apply different decorations for different levels', () => {
      const errorFormatted = emitter.colorfulFormatter('error', 'Error message', []);
      const infoFormatted = emitter.colorfulFormatter('info', 'Info message', []);

      // Different levels should have different ANSI codes
      expect(errorFormatted).not.toBe(infoFormatted);
      expect(errorFormatted).toContain('Error message');
      expect(infoFormatted).toContain('Info message');
    });

    test('should handle all log levels', () => {
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
        const formatted = emitter.colorfulFormatter(level, 'Message', []);
        expect(formatted).toContain('Message');
        expect(formatted).toContain(`[${level.padEnd(9, ' ')}]`);
      });
    });
  });

  describe('jsonCompactFormatter', () => {
    test('should format as compact JSON', () => {
      const formatted = emitter.jsonCompactFormatter('info', 'Test message', []);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual({ level: 'info', message: 'Test message', timestamp: expect.any(Number) });
    });

    test('should include args in JSON', () => {
      const args = ['string', 42, { key: 'value' }, true];
      const formatted = emitter.jsonCompactFormatter('error', 'Error occurred', args);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual({ level: 'error', message: 'Error occurred', args: args, timestamp: expect.any(Number) });
    });

    test('should produce single-line JSON', () => {
      const formatted = emitter.jsonCompactFormatter('info', 'Message', [{ nested: { deep: 'value' } }]);
      expect(formatted).not.toContain('\n');
      expect(formatted.startsWith('{')).toBe(true);
      expect(formatted.endsWith('}')).toBe(true);
    });

    test('should handle special characters in message', () => {
      const formatted = emitter.jsonCompactFormatter('info', 'Line\nwith\ttabs"quotes"', []);
      const parsed = JSON.parse(formatted) as { message: string };

      expect(parsed.message).toBe('Line\nwith\ttabs"quotes"');
    });

    test('should handle circular references in args', () => {
      interface CircularObject {
        name: string;
        self?: CircularObject;
      }
      const circular: CircularObject = { name: 'circular' };
      circular.self = circular;

      const formatted = emitter.jsonCompactFormatter('info', 'Circular ref', [circular]);
      const parsed = JSON.parse(formatted) as { level: string; message: string; args: unknown[] };

      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Circular ref');
      // The circular reference should be handled by stringify
      expect(JSON.stringify(parsed.args[0])).toContain('circular');
    });
  });

  describe('jsonPrettyFormatter', () => {
    test('should format as pretty-printed JSON', () => {
      const formatted = emitter.jsonPrettyFormatter('info', 'Test message', []);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual({ level: 'info', message: 'Test message', timestamp: expect.any(Number) });

      // Should contain newlines for pretty printing
      expect(formatted).toContain('\n');
      expect(formatted.split('\n').length).toBeGreaterThan(1);
    });

    test('should pretty-print nested objects in args', () => {
      const args = [{ nested: { deep: { value: 'test' } } }];
      const formatted = emitter.jsonPrettyFormatter('debug', 'Debug info', args);

      // Should be properly indented
      expect(formatted).toContain('\n');
      expect(formatted).toMatch(/^\{[\s\S]*\}$/);

      const parsed = JSON.parse(formatted) as { args: unknown[] };
      expect(parsed.args[0]).toEqual(args[0]);
    });

    test('should handle arrays in args with pretty printing', () => {
      const args = [[1, 2, 3, { nested: 'value' }]];
      const formatted = emitter.jsonPrettyFormatter('info', 'Array test', args);

      const parsed = JSON.parse(formatted) as { args: unknown[] };
      expect(parsed.args[0]).toEqual(args[0]);

      // Should have multiple lines due to pretty printing
      expect(formatted.split('\n').length).toBeGreaterThan(3);
    });
  });

  describe('plainArgAppendingFormatter', () => {
    test('should append args to base formatter output', () => {
      const baseFormatter = emitter.basicFormatter;
      const formatter = emitter.plainArgAppendingFormatter(baseFormatter);

      const formatted = formatter('info', 'Message', ['arg1', 42]);

      expect(formatted).toContain('[info] Message');
      expect(formatted).toContain('[arg0] arg1');
      expect(formatted).toContain('[arg1] 42');
    });

    test('should not append when no args', () => {
      const baseFormatter = emitter.basicFormatter;
      const formatter = emitter.plainArgAppendingFormatter(baseFormatter);

      const formatted = formatter('info', 'Message', []);

      expect(formatted).toBe('[info] Message');
    });

    test('should use custom delimiter', () => {
      const baseFormatter = emitter.basicFormatter;
      const formatter = emitter.plainArgAppendingFormatter(baseFormatter, ' | ');

      const formatted = formatter('info', 'Message', ['arg1']);

      expect(formatted).toBe('[info] Message | [arg0] arg1');
    });

    test('should pad arg indices correctly for multiple args', () => {
      const baseFormatter = emitter.basicFormatter;
      const formatter = emitter.plainArgAppendingFormatter(baseFormatter);

      // Test with 10+ args to check padding
      const args = Array.from({ length: 12 }, (_, i) => `arg${i}`);
      const formatted = formatter('info', 'Message', args);

      expect(formatted).toContain('[arg00]');
      expect(formatted).toContain('[arg01]');
      expect(formatted).toContain('[arg09]');
      expect(formatted).toContain('[arg10]');
      expect(formatted).toContain('[arg11]');
    });

    test('should handle complex objects in args', () => {
      const baseFormatter = emitter.basicFormatter;
      const formatter = emitter.plainArgAppendingFormatter(baseFormatter);

      const complexObj = { nested: { deep: { value: 'test', array: [1, 2, 3] } } };

      const formatted = formatter('info', 'Message', [complexObj]);

      expect(formatted).toContain('[arg0]');
      expect(formatted).toContain('nested');
      expect(formatted).toContain('deep');
      expect(formatted).toContain('value');
      expect(formatted).toContain('test');
    });

    test('should handle errors in args with stack traces', () => {
      const baseFormatter = emitter.basicFormatter;
      const formatter = emitter.plainArgAppendingFormatter(baseFormatter);

      const error = new Error('Test error');
      const formatted = formatter('error', 'Error occurred', [error]);

      expect(formatted).toContain('[arg0]');
      expect(formatted).toContain('Test error');
      // Stack trace should be included due to includeStack: true
      if (error.stack) {
        expect(formatted).toContain('Error:');
      }
    });

    test('should work with different base formatters', () => {
      const plainBase = emitter.plainFormatter;
      const formatter = emitter.plainArgAppendingFormatter(plainBase);

      const formatted = formatter('info', 'Message', ['test']);

      expect(formatted).toContain('[info     ]');
      expect(formatted).toContain('Message');
      expect(formatted).toContain('[arg0] test');
    });

    test('should handle empty base formatter output', () => {
      const emptyFormatter: typeof emitter.basicFormatter = () => '';
      const formatter = emitter.plainArgAppendingFormatter(emptyFormatter);

      const formatted = formatter('info', 'Message', ['arg1']);

      expect(formatted).toBe('[arg0] arg1');
    });

    test('should preserve newlines in args', () => {
      const baseFormatter = emitter.basicFormatter;
      const formatter = emitter.plainArgAppendingFormatter(baseFormatter);

      const multilineString = 'Line 1\nLine 2\nLine 3';
      const formatted = formatter('info', 'Message', [multilineString]);

      expect(formatted).toContain('[arg0]');
      expect(formatted).toContain(multilineString);
    });

    test('should handle 100+ args with proper padding', () => {
      const baseFormatter = emitter.basicFormatter;
      const formatter = emitter.plainArgAppendingFormatter(baseFormatter);

      const args = Array.from({ length: 105 }, (_, i) => i);
      const formatted = formatter('info', 'Message', args);

      expect(formatted).toContain('[arg000]');
      expect(formatted).toContain('[arg099]');
      expect(formatted).toContain('[arg100]');
      expect(formatted).toContain('[arg104]');
    });
  });
});
