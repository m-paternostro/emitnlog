import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { ConsoleErrorLogger } from '../../src/logger/index.ts';

describe('emitnlog.logger.ConsoleErrorLogger', () => {
  // Spy on console.error
  let consoleErrorSpy: jest.Mock;

  beforeEach(() => {
    // Create a spy on console.error

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined) as jest.Mock;
  });

  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  test('should write logs to console.error', () => {
    const logger = new ConsoleErrorLogger();

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
    const logger = new ConsoleErrorLogger();
    const error = new Error('Connection failed');

    logger.error('Operation failed', error);

    // Verify console.error was called with additional args
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Check if error was included in the arguments
    expect(consoleErrorSpy.mock.calls[0]).toContain(error);
  });

  test('should respect log level filtering', () => {
    const logger = new ConsoleErrorLogger('error');

    logger.warning('This should not be logged');
    logger.error('This should be logged');

    // Verify console.error was called only once (for error)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    expect(consoleErrorSpy.mock.calls[0][0]).toContain('This should be logged');
  });
});
