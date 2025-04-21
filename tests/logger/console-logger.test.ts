import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { ConsoleLogger } from '../../src/logger/index.ts';

describe('emitnlog.logger.ConsoleLogger', () => {
  // Spy on console.log
  let consoleLogSpy: jest.Mock;

  beforeEach(() => {
    // Create a spy on console.log

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined) as jest.Mock;
  });

  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  test('should write logs to console.log', () => {
    const logger = new ConsoleLogger();

    logger.info('Test message');

    // Verify console.log was called
    expect(consoleLogSpy).toHaveBeenCalled();

    // Check that the first argument of the first call contains our message
    expect(consoleLogSpy.mock.calls[0][0]).toContain('Test message');

    // Verify it contains level and timestamp formatting
    expect(consoleLogSpy.mock.calls[0][0]).toContain('[info     ]');

    // Verify it contains ANSI color codes (from ColoredLogger)
    expect(consoleLogSpy.mock.calls[0][0]).toContain('\x1b[');
  });

  test('should pass additional arguments to console.log', () => {
    const logger = new ConsoleLogger();
    const context = { userId: '123' };

    logger.info('User logged in', context);

    // Verify console.log was called with additional args
    expect(consoleLogSpy).toHaveBeenCalled();

    // Check if the context was included in the arguments
    expect(consoleLogSpy.mock.calls[0]).toContain(context);
  });

  test('should respect log level filtering', () => {
    const logger = new ConsoleLogger('warning');

    logger.info('This should not be logged');
    logger.warning('This should be logged');

    // Verify console.log was called only once (for warning)
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);

    expect(consoleLogSpy.mock.calls[0][0]).toContain('This should be logged');
  });
});
