import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createConsoleLogLogger } from '../../src/logger/index.ts';
import { jsonParse } from '../../src/utils/index.ts';

describe('emitnlog.logger.factory.createConsoleLogLogger', () => {
  let consoleLogSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('should write logs to console.log', () => {
    const logger = createConsoleLogLogger();

    logger.info('Test message');

    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleLogSpy.mock.calls[0][0]).toContain('Test message');
    expect(consoleLogSpy.mock.calls[0][0]).toContain('[info     ]');
    expect(consoleLogSpy.mock.calls[0][0]).toContain('\x1b[');
  });

  test('should pass additional arguments to console.log', () => {
    const logger = createConsoleLogLogger();
    const context = { userId: '123' };

    logger.info('User logged in', context);

    // Verify console.log was called with additional args
    expect(consoleLogSpy).toHaveBeenCalled();

    expect(consoleLogSpy.mock.calls[0]).toContain(context);
  });

  test('should respect log level filtering', () => {
    const logger = createConsoleLogLogger('warning');

    logger.info('This should not be logged');
    logger.warning('This should be logged');

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);

    expect(consoleLogSpy.mock.calls[0][0]).toContain('This should be logged');
  });

  test('should work with JSON format', () => {
    const logger = createConsoleLogLogger('info', 'json-pretty');

    logger.info('JSON test message');

    expect(consoleLogSpy).toHaveBeenCalled();

    const jsonOutput = consoleLogSpy.mock.calls[0][0] as string;
    expect(() => jsonParse(jsonOutput)).not.toThrow();

    const parsed = jsonParse<Record<string, unknown>>(jsonOutput);
    expect(parsed.message).toBe('JSON test message');
    expect(parsed.level).toBe('info');
    expect(parsed.timestamp).toBeDefined();
  });

  test('should work with unformatted JSON format', () => {
    const logger = createConsoleLogLogger('info', 'ndjson');

    logger.info('Unformatted JSON test message');

    // Verify console.log was called
    expect(consoleLogSpy).toHaveBeenCalled();

    // Check that the first argument is valid JSON and compact
    const jsonOutput = consoleLogSpy.mock.calls[0][0] as string;
    expect(() => jsonParse(jsonOutput)).not.toThrow();
    expect(jsonOutput).not.toContain('\n'); // Should be compact

    const parsed = jsonParse<Record<string, unknown>>(jsonOutput);
    expect(parsed.message).toBe('Unformatted JSON test message');
    expect(parsed.level).toBe('info');
    expect(parsed.timestamp).toBeDefined();
  });

  test('should pass additional arguments correctly with JSON format', () => {
    const logger = createConsoleLogLogger('info', 'json-pretty');
    const context = { userId: '123', action: 'login' };
    const additionalInfo = 'extra data';

    logger.info('User action', context, additionalInfo);

    // Verify console.log was called with multiple arguments
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleLogSpy.mock.calls[0].length).toBeGreaterThan(1);

    // First argument should be JSON formatted line
    const jsonOutput = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = jsonParse<Record<string, unknown>>(jsonOutput);
    expect(parsed.message).toBe('User action');
    expect(parsed.level).toBe('info');

    // Additional arguments should be passed as separate parameters to console.log
    expect(consoleLogSpy.mock.calls[0][1]).toEqual(context);
    expect(consoleLogSpy.mock.calls[0][2]).toBe(additionalInfo);
  });

  test('should pass additional arguments correctly with plain format', () => {
    const logger = createConsoleLogLogger('info', 'plain');
    const context = { userId: '123', action: 'login' };
    const additionalInfo = 'extra data';

    logger.info('User action', context, additionalInfo);

    // Verify console.log was called with multiple arguments
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleLogSpy.mock.calls[0].length).toBeGreaterThan(1);

    // First argument should be plain formatted line
    const plainOutput = consoleLogSpy.mock.calls[0][0] as string;
    expect(plainOutput).toContain('User action');
    expect(plainOutput).toContain('[info     ]');

    // Additional arguments should be passed as separate parameters to console.log
    expect(consoleLogSpy.mock.calls[0][1]).toEqual(context);
    expect(consoleLogSpy.mock.calls[0][2]).toBe(additionalInfo);
  });

  describe('stringify options', () => {
    test('should use default stringify options', () => {
      const logger = createConsoleLogLogger();
      const largeArray = Array.from({ length: 150 }, (_, i) => i);

      logger.i`Large array: ${largeArray}`;

      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(loggedMessage).toContain('...(50)');
    });

    test('should respect custom stringify options for array truncation', () => {
      const logger = createConsoleLogLogger('info', 'colorful', { stringifyOptions: { maxArrayElements: 5 } });
      const array = Array.from({ length: 20 }, (_, i) => i);

      logger.i`Array: ${array}`;

      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(loggedMessage).toContain('...(15)');
    });

    test('should respect custom stringify options for object truncation', () => {
      const logger = createConsoleLogLogger('info', 'colorful', { stringifyOptions: { maxProperties: 3 } });
      const obj = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`prop${i}`, i]));

      logger.i`Object: ${obj}`;

      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(loggedMessage).toContain('...(7)');
    });

    test('should disable truncation when options set to negative', () => {
      const logger = createConsoleLogLogger('info', 'colorful', {
        stringifyOptions: { maxArrayElements: -1, maxProperties: -1 },
      });
      const largeArray = Array.from({ length: 150 }, (_, i) => i);

      logger.i`Large array: ${largeArray}`;

      const loggedMessage = consoleLogSpy.mock.calls[0]?.[0] as string;
      expect(loggedMessage).not.toContain('...');
    });
  });
});
