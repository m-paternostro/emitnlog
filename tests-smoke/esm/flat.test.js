import * as emitnlog from 'emitnlog';
import { expect, test, describe } from '@jest/globals';

describe('ESM Flat imports', () => {
  test('Logger exports are available', () => {
    expect(emitnlog.ConsoleLogger).toBeDefined();
    expect(typeof emitnlog.ConsoleLogger).toBe('function');
  });

  test('Notifier exports are available', () => {
    expect(emitnlog.createEventNotifier).toBeDefined();
    expect(typeof emitnlog.createEventNotifier).toBe('function');
  });

  test('Can create and use a logger', () => {
    const logger = new emitnlog.ConsoleLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
  });
});
