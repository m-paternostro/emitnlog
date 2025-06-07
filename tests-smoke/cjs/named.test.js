const { ConsoleLogger } = require('emitnlog/logger');
const { createEventNotifier } = require('emitnlog/notifier');
const { createInvocationTracker } = require('emitnlog/tracker');
const { createDeferredValue } = require('emitnlog/utils');

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

  test('Tracker import works', () => {
    const tracker = createInvocationTracker();
    expect(tracker).toBeDefined();
    expect(typeof tracker.track).toBe('function');
    expect(typeof tracker.onInvoked).toBe('function');
    expect(typeof tracker.onStarted).toBe('function');
    expect(typeof tracker.onCompleted).toBe('function');
    expect(typeof tracker.onErrored).toBe('function');
  });

  test('Utils import works', () => {
    const deferred = createDeferredValue();
    expect(deferred).toBeDefined();
    expect(typeof deferred.promise).toBe('object');
    expect(typeof deferred.resolve).toBe('function');
    expect(typeof deferred.reject).toBe('function');
  });
});
