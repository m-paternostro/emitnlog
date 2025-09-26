import { logging, notifying, tracking, utils } from 'emitnlog';
import { expect, test, describe } from '@jest/globals';

describe('ESM namespace imports', () => {
  test('Logger exports are available', () => {
    expect(typeof logging.createConsoleLogLogger).toBe('function');
    expect(typeof logging.createFileLogger).toBe('function');
    expect(typeof logging.fromEnv).toBe('function');
    expect(typeof logging.requestLogger).toBe('function');

    {
      const logger = logging.fromEnv();
      expect(logger).toBe(logging.OFF_LOGGER);
    }

    process.env.EMITNLOG_LOGGER = 'file:/tmp/log.txt';
    {
      const logger = logging.fromEnv();
      expect(logger).toBeDefined();
      expect(logger.level).toBe('info');
      expect(logger.filePath).toBe('/tmp/log.txt');
    }
  });

  test('Notifier exports are available', () => {
    expect(typeof notifying.createEventNotifier).toBe('function');
  });

  test('Tracker exports are available', () => {
    expect(typeof tracking.createInvocationTracker).toBe('function');
    expect(typeof tracking.createAsyncLocalStorageInvocationStack).toBe('function');
    expect(typeof tracking.isAtStage).toBe('function');
    expect(typeof tracking.trackMethods).toBe('function');

    expect(typeof tracking.trackPromises).toBe('function');
  });

  test('Utils exports are available', () => {
    expect(typeof utils.createDeferredValue).toBe('function');
    expect(typeof utils.emptyArray).toBe('function');
  });
});
