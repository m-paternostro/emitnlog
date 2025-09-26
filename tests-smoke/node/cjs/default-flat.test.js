const emitnlog = require('emitnlog');

describe('CJS Flat imports', () => {
  test('Logger exports are available', () => {
    expect(typeof emitnlog.createConsoleLogLogger).toBe('function');
    expect(typeof emitnlog.createFileLogger).toBe('function');
    expect(typeof emitnlog.fromEnv).toBe('function');
    expect(typeof emitnlog.requestLogger).toBe('function');

    {
      const logger = emitnlog.fromEnv();
      expect(logger).toBe(emitnlog.OFF_LOGGER);
    }

    process.env.EMITNLOG_LOGGER = 'file:/tmp/log.txt';
    {
      const logger = emitnlog.fromEnv();
      expect(logger).toBeDefined();
      expect(logger.level).toBe('info');
      expect(logger.filePath).toBe('/tmp/log.txt');
    }

    delete process.env.EMITNLOG_LOGGER;
  });

  test('Notifier exports are available', () => {
    expect(typeof emitnlog.createEventNotifier).toBe('function');
  });

  test('Tracker exports are available', () => {
    expect(typeof emitnlog.createInvocationTracker).toBe('function');
    expect(typeof emitnlog.createAsyncLocalStorageInvocationStack).toBe('function');
    expect(typeof emitnlog.isAtStage).toBe('function');
    expect(typeof emitnlog.trackMethods).toBe('function');

    expect(typeof emitnlog.trackPromises).toBe('function');
  });

  test('Utils exports are available', () => {
    expect(typeof emitnlog.createDeferredValue).toBe('function');
    expect(typeof emitnlog.emptyArray).toBe('function');
  });
});
