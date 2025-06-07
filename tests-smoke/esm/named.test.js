import { ConsoleLogger } from 'emitnlog/logger';
import { createEventNotifier } from 'emitnlog/notifier';
import { createInvocationTracker } from 'emitnlog/tracker';
import { createDeferredValue } from 'emitnlog/utils';
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

  test('Tracker import works', () => {
    const tracker = createInvocationTracker();
    expect(tracker).toBeDefined();
    expect(typeof tracker.track).toBe('function');
    expect(typeof tracker.onInvoked).toBe('function');
    expect(typeof tracker.onStarted).toBe('function');
  });

  test('Utils import works', () => {
    const deferred = createDeferredValue();
    expect(deferred).toBeDefined();
    expect(typeof deferred.promise).toBe('object');
    expect(typeof deferred.resolve).toBe('function');
    expect(typeof deferred.reject).toBe('function');
  });
});
