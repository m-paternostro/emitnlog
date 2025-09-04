import * as emitnlog from 'emitnlog';
import { expect, test, describe } from '@jest/globals';

describe('ESM Flat imports', () => {
  test('Logger exports are available', () => {
    expect(typeof emitnlog.createConsoleLogLogger).toBe('function');
    expect(typeof emitnlog.fromEnv).toBe('function');

    process.env.EMITNLOG_LOGGER = 'file:/tmp/log.txt';
    {
      const logger = emitnlog.fromEnv();
      expect(logger).toBe(emitnlog.OFF_LOGGER);
    }
    process.env.EMITNLOG_LOGGER = 'console-log';
    {
      const logger = emitnlog.fromEnv();
      expect(logger).toBeDefined();
      expect(logger.level).toBe('info');
    }
  });

  test('Notifier exports are available', () => {
    expect(typeof emitnlog.createEventNotifier).toBe('function');
  });

  test('Tracker exports are available', () => {
    expect(typeof emitnlog.createInvocationTracker).toBe('function');
    expect(typeof emitnlog.isAtStage).toBe('function');
    expect(typeof emitnlog.trackMethods).toBe('function');

    expect(typeof emitnlog.trackPromises).toBe('function');
  });

  test('Utils exports are available', () => {
    expect(typeof emitnlog.createDeferredValue).toBe('function');
  });
});
