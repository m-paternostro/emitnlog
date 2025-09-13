// Import directly from the platform-neutral ESM build to simulate non-node environment
import * as logging from '../../node_modules/emitnlog/dist/esm/logger/index.js';
import * as notifying from '../../node_modules/emitnlog/dist/esm/notifier/index.js';
import * as tracking from '../../node_modules/emitnlog/dist/esm/tracker/index.js';
import * as utils from '../../node_modules/emitnlog/dist/esm/utils/index.js';
import { expect, test, describe } from '@jest/globals';

describe('ESM path imports - Non-Node Environment', () => {
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
