import { ConsoleLogger, fromEnv as fromEnvLogger, OFF_LOGGER } from 'emitnlog/logger';
import { fromEnv } from 'emitnlog/logger/environment';
import { createEventNotifier } from 'emitnlog/notifier';
import { createInvocationTracker, trackPromises, trackMethods } from 'emitnlog/tracker';
import { createDeferredValue } from 'emitnlog/utils';
import { expect, test, describe } from '@jest/globals';

describe('ESM Named imports', () => {
  test('Logger import works', () => {
    expect(typeof ConsoleLogger).toBe('function');
    expect(typeof fromEnvLogger).toBe('function');

    process.env.EMITNLOG_LOGGER = 'file:/tmp/log.txt';
    {
      const logger = fromEnvLogger();
      expect(logger).toBe(OFF_LOGGER);
    }
    process.env.EMITNLOG_LOGGER = 'console';
    {
      const logger = fromEnvLogger();
      expect(logger).toBeDefined();
      expect(logger.constructor.name).toBe('ConsoleLogger');
    }
  });

  test('Logger environment import works', () => {
    expect(typeof fromEnv).toBe('function');

    // The smoke tests run in node so this must work
    process.env.EMITNLOG_LOGGER = 'file:/tmp/log.txt';
    {
      const logger = fromEnv();
      expect(logger).toBeDefined();
      expect(logger.constructor.name).toBe('FileLogger');
    }
    process.env.EMITNLOG_LOGGER = 'console';
    {
      const logger = fromEnv();
      expect(logger).toBeDefined();
      expect(logger.constructor.name).toBe('ConsoleLogger');
    }
  });

  test('Notifier import works', () => {
    expect(typeof createEventNotifier).toBe('function');
  });

  test('Tracker import works', () => {
    expect(typeof createInvocationTracker).toBe('function');
    expect(typeof trackMethods).toBe('function');
    expect(typeof trackPromises).toBe('function');
  });

  test('Utils import works', () => {
    expect(typeof createDeferredValue).toBe('function');
  });
});
