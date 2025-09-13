const logging = require('../../node_modules/emitnlog/dist/cjs/logger/index.cjs');
const notifying = require('../../node_modules/emitnlog/dist/cjs/notifier/index.cjs');
const tracking = require('../../node_modules/emitnlog/dist/cjs/tracker/index.cjs');
const utils = require('../../node_modules/emitnlog/dist/cjs/utils/index.cjs');

describe('CJS path imports - Non-Node Environment', () => {
  test('Logger path exports are available', () => {
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

  test('Notifier path exports are available', () => {
    expect(typeof notifying.createEventNotifier).toBe('function');
  });

  test('Tracker path exports are available', () => {
    expect(typeof tracking.createInvocationTracker).toBe('function');

    // AsyncLocalStorage should NOT be available in non-node environment
    expect(tracking.createAsyncLocalStorageInvocationStack).toBeUndefined();

    expect(typeof tracking.isAtStage).toBe('function');
    expect(typeof tracking.trackMethods).toBe('function');
    expect(typeof tracking.trackPromises).toBe('function');
  });

  test('Utils path exports are available', () => {
    expect(typeof utils.createDeferredValue).toBe('function');
    expect(typeof utils.emptyArray).toBe('function');
  });
});
