import { createConsoleLogLogger, createFileLogger, fromEnv, requestLogger, OFF_LOGGER } from 'emitnlog/logger';
import { createEventNotifier } from 'emitnlog/notifier';
import {
  createAsyncLocalStorageInvocationStack,
  createInvocationTracker,
  trackPromises,
  trackMethods,
} from 'emitnlog/tracker';
import { createDeferredValue, emptyArray, runProcessMain, isProcessMain } from 'emitnlog/utils';
import { expect, test, describe } from 'vitest';

describe('ESM path imports', () => {
  test('Logger import works', () => {
    expect(typeof createConsoleLogLogger).toBe('function');
    expect(typeof createFileLogger).toBe('function');
    expect(typeof fromEnv).toBe('function');
    expect(typeof requestLogger).toBe('function');

    {
      const logger = fromEnv();
      expect(logger).toBe(OFF_LOGGER);
    }

    process.env.EMITNLOG_LOGGER = 'file:/tmp/log.txt';
    {
      const logger = fromEnv();
      expect(logger).toBeDefined();
      expect(logger.level).toBe('info');
      expect(logger.filePath).toBe('/tmp/log.txt');
    }
  });

  test('Notifier import works', () => {
    expect(typeof createEventNotifier).toBe('function');
  });

  test('Tracker import works', () => {
    expect(typeof createAsyncLocalStorageInvocationStack).toBe('function');
    expect(typeof createInvocationTracker).toBe('function');
    expect(typeof trackMethods).toBe('function');
    expect(typeof trackPromises).toBe('function');
  });

  test('Utils import works', () => {
    expect(typeof createDeferredValue).toBe('function');
    expect(typeof emptyArray).toBe('function');

    expect(typeof runProcessMain).toBe('function');
    expect(isProcessMain(import.meta.url)).toBe(false);
  });
});
