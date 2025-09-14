import { logging, notifying, tracking, utils } from 'emitnlog/neutral';
import { expect, test, describe } from '@jest/globals';

describe('ESM namespace neutral imports', () => {
  test('Logger exports are available', () => {
    expect(typeof logging.createConsoleLogLogger).toBe('function');
    expect(typeof logging.fromEnv).toBe('function');

    {
      const logger = logging.fromEnv();
      expect(logger).toBe(logging.OFF_LOGGER);
    }

    process.env.EMITNLOG_LOGGER = 'file:/tmp/log.txt';
    {
      const logger = logging.fromEnv();
      expect(logger).toBe(logging.OFF_LOGGER); // file system logging is not available
    }
    delete process.env.EMITNLOG_LOGGER;
  });

  test('Notifier exports are available', () => {
    expect(typeof notifying.createEventNotifier).toBe('function');
  });

  test('Tracker exports are available', () => {
    expect(typeof tracking.createInvocationTracker).toBe('function');

    // AsyncLocalStorage should NOT be available in non-node environment
    expect(tracking.createAsyncLocalStorageInvocationStack).toBeUndefined();

    expect(typeof tracking.isAtStage).toBe('function');
    expect(typeof tracking.trackMethods).toBe('function');
    expect(typeof tracking.trackPromises).toBe('function');
  });

  test('Utils exports are available', () => {
    expect(typeof utils.createDeferredValue).toBe('function');
    expect(typeof utils.emptyArray).toBe('function');
  });
});
