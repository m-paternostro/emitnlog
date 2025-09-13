// Import directly from the platform-neutral CJS build to simulate non-node environment
const emitnlog = require('../../node_modules/emitnlog/dist/cjs/index.cjs');

describe('CJS no duplication checks - Non-Node Environment', () => {
  test('Logger singletons are the same instance', () => {
    const logger1 = emitnlog.fromEnv();
    const logger2 = emitnlog.fromEnv();
    expect(logger1).toBe(logger2);
    expect(logger1).toBe(emitnlog.OFF_LOGGER);
  });

  test('Logger classes are the same', () => {
    const logger1 = emitnlog.createConsoleLogLogger();
    const logger2 = emitnlog.createConsoleLogLogger();
    expect(logger1.constructor).toBe(logger2.constructor);
  });

  test('Tracker classes are the same', () => {
    const tracker1 = emitnlog.createInvocationTracker();
    const tracker2 = emitnlog.createInvocationTracker();
    expect(tracker1.constructor).toBe(tracker2.constructor);
  });
});
