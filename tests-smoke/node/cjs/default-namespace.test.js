const logging = require('emitnlog').logging;
const notifying = require('emitnlog').notifying;
const tracking = require('emitnlog').tracking;
const utils = require('emitnlog').utils;

describe('CJS namespace imports', () => {
  test('Logger import works', () => {
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

    delete process.env.EMITNLOG_LOGGER;
  });

  test('Notifier import works', () => {
    expect(typeof notifying.createEventNotifier).toBe('function');
  });

  test('Tracker import works', () => {
    expect(typeof tracking.createAsyncLocalStorageInvocationStack).toBe('function');
    expect(typeof tracking.createInvocationTracker).toBe('function');
    expect(typeof tracking.trackMethods).toBe('function');
    expect(typeof tracking.trackPromises).toBe('function');
  });

  test('Utils import works', () => {
    expect(typeof utils.createDeferredValue).toBe('function');
    expect(typeof utils.emptyArray).toBe('function');

    expect(typeof utils.runProcessMain).toBe('function');
    expect(utils.isProcessMain(__filename)).toBe(false);
  });
});
