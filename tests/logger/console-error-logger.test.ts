import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createConsoleErrorLogger } from '../../src/logger/index.ts';

describe('emitnlog.logger.factory.createConsoleErrorLogger', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => void 0);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('should write logs to console.error', () => {
    const logger = createConsoleErrorLogger();

    logger.info('Test message');

    // Verify console.error was called
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Check that the first argument of the first call contains our message
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Test message');

    // Verify it contains level and timestamp formatting
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('[info     ]');

    // Verify it contains ANSI color codes (from ColoredLogger)
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('\x1b[');
  });

  test('should pass additional arguments to console.error', () => {
    const logger = createConsoleErrorLogger();
    const error = new Error('Connection failed');

    logger.error('Operation failed', error);

    // Verify console.error was called with additional args
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Check if error was included in the arguments
    expect(consoleErrorSpy.mock.calls[0]).toContain(error);
  });

  test('should respect log level filtering', () => {
    const logger = createConsoleErrorLogger('error');

    logger.warning('This should not be logged');
    logger.error('This should be logged');

    // Verify console.error was called only once (for error)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    expect(consoleErrorSpy.mock.calls[0][0]).toContain('This should be logged');
  });

  test('should work with JSON format', () => {
    const logger = createConsoleErrorLogger('info', 'json-pretty');

    logger.info('JSON test message');

    // Verify console.error was called
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Check that the first argument is valid JSON
    const jsonOutput = consoleErrorSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(jsonOutput) as unknown).not.toThrow();

    const parsed = JSON.parse(jsonOutput) as Record<string, unknown>;
    expect(parsed.message).toBe('JSON test message');
    expect(parsed.level).toBe('info');
    expect(parsed.timestamp).toBeDefined();
  });

  test('should work with unformatted JSON format', () => {
    const logger = createConsoleErrorLogger('info', 'json-compact');

    logger.info('Unformatted JSON test message');

    // Verify console.error was called
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Check that the first argument is valid JSON and compact
    const jsonOutput = consoleErrorSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(jsonOutput) as unknown).not.toThrow();
    expect(jsonOutput).not.toContain('\n'); // Should be compact

    const parsed = JSON.parse(jsonOutput) as Record<string, unknown>;
    expect(parsed.message).toBe('Unformatted JSON test message');
    expect(parsed.level).toBe('info');
    expect(parsed.timestamp).toBeDefined();
  });

  test('should pass additional arguments correctly with JSON format', () => {
    const logger = createConsoleErrorLogger('info', 'json-pretty');
    const context = { userId: '123', action: 'login' };
    const error = new Error('Test error');

    logger.error('User action failed', context, error);

    // Verify console.error was called with multiple arguments
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0].length).toBeGreaterThan(1);

    // First argument should be JSON formatted line
    const jsonOutput = consoleErrorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(jsonOutput) as Record<string, unknown>;
    expect(parsed.message).toBe('User action failed');
    expect(parsed.level).toBe('error');

    // Additional arguments should be passed as separate parameters to console.error
    expect(consoleErrorSpy.mock.calls[0][1]).toEqual(context);
    expect(consoleErrorSpy.mock.calls[0][2]).toBe(error);
  });
});
