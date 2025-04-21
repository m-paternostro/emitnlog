import { ConsoleLogger } from 'emitnlog/logger';
import { createEventNotifier } from 'emitnlog/notifier';
import { expect, test, describe } from '@jest/globals';

describe('ESM Named imports', () => {
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
