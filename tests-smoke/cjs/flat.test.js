const emitnlog = require('emitnlog');

describe('CJS Flat imports', () => {
  test('Logger exports are available', () => {
    expect(typeof emitnlog.ConsoleLogger).toBe('function');
  });

  test('Notifier exports are available', () => {
    expect(typeof emitnlog.createEventNotifier).toBe('function');
  });

  test('Tracker exports are available', () => {
    expect(typeof emitnlog.createInvocationTracker).toBe('function');
    expect(typeof emitnlog.isAtStage).toBe('function');
  });

  test('Utils exports are available', () => {
    expect(typeof emitnlog.createDeferredValue).toBe('function');
    expect(typeof emitnlog.delay).toBe('function');
  });

  test('Can create and use a logger', () => {
    const logger = new emitnlog.ConsoleLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
  });
});
