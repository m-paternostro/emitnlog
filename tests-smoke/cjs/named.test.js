const { ConsoleLogger } = require('emitnlog/logger');
const { createEventNotifier } = require('emitnlog/notifier');

describe('CJS Named imports', () => {
  test('Logger import works', () => {
    const logger = new ConsoleLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
  });

  test('Notifier import works', () => {
    const notifier = createEventNotifier();
    expect(notifier).toBeDefined();
    expect(typeof notifier.onEvent).toBe('function');
    expect(typeof notifier.notify).toBe('function');
  });
});
