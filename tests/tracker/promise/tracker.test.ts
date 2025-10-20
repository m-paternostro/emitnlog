import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { PromiseSettledEvent } from '../../../src/tracker/index.ts';
import { trackPromises } from '../../../src/tracker/index.ts';
import { createTestLogger } from '../../vitest.setup.ts';

describe('emitnlog.tracker.promise', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trackPromises', () => {
    test('should create a tracker with size 0', () => {
      const tracker = trackPromises();
      expect(tracker.size).toBe(0);
    });
  });

  describe('track', () => {
    test('should track a resolved promise and update size', async () => {
      const tracker = trackPromises();
      const promise = tracker.track('test-label', Promise.resolve('result'));

      expect(tracker.size).toBe(1);
      const result = await promise;
      expect(result).toBe('result');
      expect(tracker.size).toBe(0);
    });

    test('should track a rejected promise and update size', async () => {
      const tracker = trackPromises();
      const error = new Error('test error');
      const promise = tracker.track('test-label', Promise.reject(error));

      expect(tracker.size).toBe(1);
      await expect(promise).rejects.toThrow(error);
      expect(tracker.size).toBe(0);
    });

    test('should track multiple promises', async () => {
      const tracker = trackPromises();

      const promise1 = tracker.track(Promise.resolve('result1'));
      const promise2 = tracker.track(Promise.resolve('result2'));

      expect(tracker.size).toBe(2);

      const results = await Promise.all([promise1, promise2]);
      expect(results).toEqual(['result1', 'result2']);
      expect(tracker.size).toBe(0);
    });

    test('should track promise suppliers', async () => {
      const tracker = trackPromises();
      const supplierFn = vi.fn(() => Promise.resolve('supplier-result'));

      const promise = tracker.track('supplier-test', supplierFn);

      expect(tracker.size).toBe(1);
      expect(supplierFn).toHaveBeenCalledTimes(1);

      const result = await promise;
      expect(result).toBe('supplier-result');
      expect(tracker.size).toBe(0);
    });

    test('should track promise suppliers that throw synchronously', async () => {
      const tracker = trackPromises();
      const error = new Error('sync error');
      const supplierFn = vi.fn(() => {
        throw error;
      });

      const promise = tracker.track('sync-throw-test', supplierFn);

      expect(tracker.size).toBe(1);
      await expect(promise).rejects.toThrow(error);
      expect(tracker.size).toBe(0);
    });

    test('should track promise suppliers that return rejected promises', async () => {
      const tracker = trackPromises();
      const error = new Error('async error');
      const supplierFn = vi.fn(() => Promise.reject(error));

      const promise = tracker.track('async-reject-test', supplierFn);

      expect(tracker.size).toBe(1);
      await expect(promise).rejects.toThrow(error);
      expect(tracker.size).toBe(0);
    });

    test('should track promises without labels', async () => {
      const tracker = trackPromises();
      const promise = tracker.track(Promise.resolve('unlabeled'));

      expect(tracker.size).toBe(1);
      const result = await promise;
      expect(result).toBe('unlabeled');
      expect(tracker.size).toBe(0);
    });

    test('should return the same promise instance for chaining', async () => {
      const tracker = trackPromises();
      const originalPromise = Promise.resolve('chainable');
      const trackedPromise = tracker.track(originalPromise);

      // Should be able to chain normally
      const chainedResult = await trackedPromise.then((result) => `${result}-chained`);
      expect(chainedResult).toBe('chainable-chained');
    });
  });

  describe('wait', () => {
    test('should resolve immediately when no promises are tracked', async () => {
      const tracker = trackPromises();
      await expect(tracker.wait()).resolves.toBeUndefined();
    });

    test('should wait for all tracked promises to settle', async () => {
      const tracker = trackPromises();

      let resolved1 = false;
      let resolved2 = false;

      const promise1 = new Promise<void>((resolve) => {
        setTimeout(() => {
          resolved1 = true;
          resolve();
        }, 100);
      });

      const promise2 = new Promise<void>((resolve) => {
        setTimeout(() => {
          resolved2 = true;
          resolve();
        }, 200);
      });

      void tracker.track('promise1', promise1);
      void tracker.track('promise2', promise2);

      expect(tracker.size).toBe(2);
      expect(resolved1).toBe(false);
      expect(resolved2).toBe(false);

      const waitPromise = tracker.wait();

      vi.advanceTimersByTime(100);
      await Promise.resolve(); // Wait for microtasks to execute
      expect(resolved1).toBe(true);
      expect(resolved2).toBe(false);
      expect(tracker.size).toBe(1);

      vi.advanceTimersByTime(100);
      await Promise.resolve(); // Wait for microtasks to execute
      expect(resolved2).toBe(true);

      await waitPromise;
      expect(tracker.size).toBe(0);
    });

    test('should wait for both resolved and rejected promises', async () => {
      const tracker = trackPromises();

      const resolvedPromise = Promise.resolve('success');

      // Track the resolved promise
      void tracker.track(resolvedPromise);

      // Track a promise that will reject - but handle it properly
      const trackedRejectedPromise = tracker.track(Promise.reject(new Error('failure')));

      // Handle the rejection to prevent Vitest from complaining
      trackedRejectedPromise.catch(() => {
        // Expected rejection - do nothing
      });

      expect(tracker.size).toBe(2);

      // wait() should resolve even if some promises reject
      await expect(tracker.wait()).resolves.toBeUndefined();
      expect(tracker.size).toBe(0);
    });

    test('should not wait for promises tracked after wait is called', async () => {
      const tracker = trackPromises();

      let firstResolved = false;
      let secondResolved = false;

      const firstPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          firstResolved = true;
          resolve();
        }, 100);
      });

      void tracker.track('first', firstPromise);
      const waitPromise = tracker.wait();

      // Track another promise after wait() is called - this one takes longer
      const secondPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          secondResolved = true;
          resolve();
        }, 200);
      });
      void tracker.track('second', secondPromise);

      // Advance time to resolve only the first promise
      vi.advanceTimersByTime(100);
      await Promise.resolve(); // Wait for microtasks to execute
      expect(firstResolved).toBe(true);
      expect(secondResolved).toBe(false);

      // wait() should now complete since the first promise resolved
      await waitPromise;

      // The second promise should still be tracked (not resolved yet)
      expect(tracker.size).toBe(1);

      // Clean up the second promise for the test
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(secondResolved).toBe(true);
      expect(tracker.size).toBe(0);
    });

    test('should handle empty wait after promises settle', async () => {
      const tracker = trackPromises();

      const promise = tracker.track(Promise.resolve('test'));
      await promise;

      expect(tracker.size).toBe(0);
      await expect(tracker.wait()).resolves.toBeUndefined();
    });
  });

  describe('onSettled', () => {
    test('should emit events when promises resolve', async () => {
      const tracker = trackPromises();
      const events: PromiseSettledEvent[] = [];

      tracker.onSettled((event) => {
        events.push(event);
      });

      const promise = tracker.track('test-label', Promise.resolve('test-result'));
      await promise;

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ label: 'test-label', duration: expect.any(Number), result: 'test-result' });
      expect(events[0].duration).toBeGreaterThanOrEqual(0);
    });

    test('should emit events when promises reject', async () => {
      const tracker = trackPromises();
      const events: PromiseSettledEvent[] = [];

      tracker.onSettled((event) => {
        events.push(event);
      });

      const error = new Error('test error');
      const promise = tracker.track('error-label', Promise.reject(error));

      await expect(promise).rejects.toThrow(error);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        label: 'error-label',
        duration: expect.any(Number),
        rejected: true,
        result: error,
      });
    });

    test('should emit events without labels for unlabeled promises', async () => {
      const tracker = trackPromises();
      const events: PromiseSettledEvent[] = [];

      tracker.onSettled((event) => {
        events.push(event);
      });

      const promise = tracker.track(Promise.resolve('unlabeled'));
      await promise;

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ duration: expect.any(Number), result: 'unlabeled' });
      expect(events[0].label).toBeUndefined();
      expect(events[0].rejected).toBeUndefined();
    });

    test('should emit events without result for undefined values', async () => {
      const tracker = trackPromises();
      const events: PromiseSettledEvent[] = [];

      tracker.onSettled((event) => {
        events.push(event);
      });

      const promise = tracker.track('undefined-result', Promise.resolve(undefined));
      await promise;

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ label: 'undefined-result', duration: expect.any(Number) });
      expect(events[0].result).toBeUndefined();
      expect(events[0].rejected).toBeUndefined();
    });

    test('should support multiple event listeners', async () => {
      const tracker = trackPromises();
      const events1: PromiseSettledEvent[] = [];
      const events2: PromiseSettledEvent[] = [];

      tracker.onSettled((event) => events1.push(event));
      tracker.onSettled((event) => events2.push(event));

      const promise = tracker.track('test', Promise.resolve('multi-listener'));
      await promise;

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0]).toEqual(events2[0]);
    });

    test('should measure duration accurately for promise suppliers', async () => {
      const tracker = trackPromises();
      const events: PromiseSettledEvent[] = [];

      tracker.onSettled((event) => {
        events.push(event);
      });

      const supplierFn = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve('supplier-result'), 100);
          }),
      );

      const promise = tracker.track('timing-test', supplierFn);

      vi.advanceTimersByTime(100);
      await promise;

      expect(events).toHaveLength(1);
      expect(events[0].duration).toBeGreaterThanOrEqual(100);
      expect(events[0].result).toBe('supplier-result');
    });
  });

  describe('edge cases', () => {
    test('should handle tracking the same promise multiple times', async () => {
      const tracker = trackPromises();
      const originalPromise = Promise.resolve('shared');

      const tracked1 = tracker.track('first-track', originalPromise);
      const tracked2 = tracker.track('second-track', originalPromise);

      expect(tracker.size).toBe(1);

      const results = await Promise.all([tracked1, tracked2]);
      expect(results).toEqual(['shared', 'shared']);
      expect(tracker.size).toBe(0);
    });

    test('should handle concurrent promise resolution', async () => {
      const tracker = trackPromises();
      const events: PromiseSettledEvent[] = [];

      tracker.onSettled((event) => events.push(event));

      const promises = Array.from({ length: 5 }, (_, i) =>
        tracker.track(`promise-${i}`, Promise.resolve(`result-${i}`)),
      );

      expect(tracker.size).toBe(5);

      const results = await Promise.all(promises);
      expect(results).toEqual(['result-0', 'result-1', 'result-2', 'result-3', 'result-4']);
      expect(tracker.size).toBe(0);
      expect(events).toHaveLength(5);
    });

    test('should handle mixed resolved and rejected promises', async () => {
      const tracker = trackPromises();
      const events: PromiseSettledEvent[] = [];

      tracker.onSettled((event) => events.push(event));

      const resolvedPromise = tracker.track('resolved', Promise.resolve('success'));

      const error = new Error('failure');
      const rejectedPromise = tracker.track('rejected', Promise.reject(error));

      expect(tracker.size).toBe(2);

      await expect(resolvedPromise).resolves.toBe('success');
      await expect(rejectedPromise).rejects.toThrow('failure');

      expect(tracker.size).toBe(0);
      expect(events).toHaveLength(2);

      const resolvedEvent = events.find((e) => e.label === 'resolved');
      const rejectedEvent = events.find((e) => e.label === 'rejected');

      expect(resolvedEvent).toMatchObject({ label: 'resolved', result: 'success' });
      expect(rejectedEvent).toMatchObject({ label: 'rejected', rejected: true, result: error });
    });

    test('should clean up properly after promise settlement', async () => {
      const tracker = trackPromises();

      // Track and resolve multiple promises
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const promise = tracker.track(`promise-${i}`, Promise.resolve(i));
        promises.push(promise);
      }
      await Promise.all(promises);

      expect(tracker.size).toBe(0);

      // Should still work after cleanup
      const newPromise = tracker.track(Promise.resolve('after-cleanup'));
      expect(tracker.size).toBe(1);

      await newPromise;
      expect(tracker.size).toBe(0);
    });
  });

  describe('logging integration', () => {
    test('should call logger methods when logger is provided', async () => {
      const testLogger = createTestLogger();

      const tracker = trackPromises({ logger: testLogger });

      const promise = tracker.track('logged-promise', Promise.resolve('logged'));
      await promise;

      // Should have logged tracking and resolution
      expect(testLogger).toHaveLoggedWith('debug', "promise: tracking a promise with label 'logged-promise'");
      expect(testLogger).toHaveLoggedWith('debug', "promise: promise with label 'logged-promise' resolved in");
    });
  });
});
