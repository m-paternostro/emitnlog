import * as emitnlog from 'emitnlog/neutral';
import { expect, test, describe } from '@jest/globals';

describe('ESM neutral flat imports', () => {
  test('Logger exports are available', () => {
    expect(typeof emitnlog.createConsoleLogLogger).toBe('function');
    expect(typeof emitnlog.fromEnv).toBe('function');

    {
      const logger = emitnlog.fromEnv();
      expect(logger).toBe(emitnlog.OFF_LOGGER);
    }

    process.env.EMITNLOG_LOGGER = 'file:/tmp/log.txt';
    {
      const logger = emitnlog.fromEnv();
      expect(logger).toBe(emitnlog.OFF_LOGGER); // file system logging is not available
    }
    delete process.env.EMITNLOG_LOGGER;
  });

  test('Notifier exports are available', () => {
    expect(typeof emitnlog.createEventNotifier).toBe('function');
  });

  test('Tracker exports are available', () => {
    expect(typeof emitnlog.createInvocationTracker).toBe('function');

    // AsyncLocalStorage should NOT be available in non-node environment
    expect(emitnlog.createAsyncLocalStorageInvocationStack).toBeUndefined();

    expect(typeof emitnlog.isAtStage).toBe('function');
    expect(typeof emitnlog.trackMethods).toBe('function');
    expect(typeof emitnlog.trackPromises).toBe('function');
  });

  test('Utils exports are available', () => {
    expect(typeof emitnlog.createDeferredValue).toBe('function');
    expect(typeof emitnlog.emptyArray).toBe('function');
  });
});
