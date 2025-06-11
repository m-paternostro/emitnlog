/* eslint-disable @typescript-eslint/no-confusing-void-expression */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { PromiseSettledEvent } from '../../../src/tracker/index.ts';
import { holdPromises } from '../../../src/tracker/index.ts';
import { createTestLogger } from '../../jester.setup.ts';

describe('emitnlog.tracker.promise.holder', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('holdPromises', () => {
    test('should create a holder with size 0', () => {
      const holder = holdPromises();
      expect(holder.size).toBe(0);
    });
  });

  describe('track (caching behavior)', () => {
    test('should execute operation only once for same ID', async () => {
      const holder = holdPromises();
      const supplierFn = jest.fn(() => Promise.resolve('cached-result'));

      const promise1 = holder.track('operation-1', supplierFn);
      const promise2 = holder.track('operation-1', supplierFn);
      const promise3 = holder.track('operation-1', supplierFn);

      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(promise1).toBe(promise2);
      expect(promise2).toBe(promise3);

      const results = await Promise.all([promise1, promise2, promise3]);
      expect(results).toEqual(['cached-result', 'cached-result', 'cached-result']);
      expect(holder.size).toBe(0);
    });

    test('should execute different operations for different IDs', async () => {
      const holder = holdPromises();
      const supplier1 = jest.fn(() => Promise.resolve('result-1'));
      const supplier2 = jest.fn(() => Promise.resolve('result-2'));

      const promise1 = holder.track('operation-1', supplier1);
      const promise2 = holder.track('operation-2', supplier2);

      expect(supplier1).toHaveBeenCalledTimes(1);
      expect(supplier2).toHaveBeenCalledTimes(1);
      expect(promise1).not.toBe(promise2);

      const results = await Promise.all([promise1, promise2]);
      expect(results).toEqual(['result-1', 'result-2']);
      expect(holder.size).toBe(0);
    });

    test('should allow reuse of ID after operation completes', async () => {
      const holder = holdPromises();
      const supplier1 = jest.fn(() => Promise.resolve('first-execution'));
      const supplier2 = jest.fn(() => Promise.resolve('second-execution'));

      // First execution
      const result1 = await holder.track('reusable-id', supplier1);
      expect(result1).toBe('first-execution');
      expect(supplier1).toHaveBeenCalledTimes(1);
      expect(holder.size).toBe(0);

      // Second execution with same ID after first completes
      const result2 = await holder.track('reusable-id', supplier2);
      expect(result2).toBe('second-execution');
      expect(supplier2).toHaveBeenCalledTimes(1);
      expect(holder.size).toBe(0);
    });

    test('should cache rejected promises and clean up after rejection', async () => {
      const holder = holdPromises();
      const error = new Error('operation failed');
      const supplierFn = jest.fn(() => Promise.reject(error));

      const promise1 = holder.track('failing-operation', supplierFn);
      const promise2 = holder.track('failing-operation', supplierFn);

      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(promise1).toBe(promise2);

      await expect(promise1).rejects.toThrow(error);
      await expect(promise2).rejects.toThrow(error);
      expect(holder.size).toBe(0);

      // Should allow retry after failure
      const retrySupplier = jest.fn(() => Promise.resolve('retry-success'));
      const retryResult = await holder.track('failing-operation', retrySupplier);
      expect(retryResult).toBe('retry-success');
      expect(retrySupplier).toHaveBeenCalledTimes(1);
    });

    test('should handle suppliers that throw synchronously', async () => {
      const holder = holdPromises();
      const error = new Error('sync error');
      const throwingSupplier = jest.fn(() => {
        throw error;
      });

      const promise1 = holder.track('sync-error', throwingSupplier);
      const promise2 = holder.track('sync-error', throwingSupplier);

      expect(throwingSupplier).toHaveBeenCalledTimes(1);
      expect(promise1).toBe(promise2);

      await expect(promise1).rejects.toThrow(error);
      await expect(promise2).rejects.toThrow(error);
      expect(holder.size).toBe(0);
    });

    test('should handle concurrent requests for same operation', async () => {
      const holder = holdPromises();
      let resolvePromise: (value: string) => void;
      const delayedPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
      const supplierFn = jest.fn(() => delayedPromise);

      // Start multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => holder.track('concurrent-op', supplierFn));

      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(holder.size).toBe(1);

      // All promises should be the same instance
      promises.forEach((promise, index) => {
        if (index > 0) {
          expect(promise).toBe(promises[0]);
        }
      });

      // Resolve the operation
      resolvePromise!('concurrent-result');
      const results = await Promise.all(promises);

      expect(results).toEqual(Array(5).fill('concurrent-result'));
      expect(holder.size).toBe(0);
    });
  });

  describe('has method', () => {
    test('should return false for non-existent operations', () => {
      const holder = holdPromises();
      expect(holder.has('non-existent')).toBe(false);
    });

    test('should return true for ongoing operations', async () => {
      const holder = holdPromises();
      let resolvePromise: (value: string) => void;
      const delayedPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });

      void holder.track('ongoing-op', () => delayedPromise);

      expect(holder.has('ongoing-op')).toBe(true);
      expect(holder.has('different-op')).toBe(false);

      // Complete the operation
      resolvePromise!('completed');
      await delayedPromise;

      // Should return false after completion
      expect(holder.has('ongoing-op')).toBe(false);
    });

    test('should return false after operation fails', async () => {
      const holder = holdPromises();
      const error = new Error('operation failed');

      const promise = holder.track('failing-op', () => Promise.reject(error));

      expect(holder.has('failing-op')).toBe(true);

      await expect(promise).rejects.toThrow(error);

      expect(holder.has('failing-op')).toBe(false);
    });

    test('should handle multiple operations correctly', () => {
      const holder = holdPromises();
      let resolve1: (value: string) => void;
      let resolve2: (value: string) => void;

      const promise1 = new Promise<string>((resolve) => {
        resolve1 = resolve;
      });
      const promise2 = new Promise<string>((resolve) => {
        resolve2 = resolve;
      });

      void holder.track('op1', () => promise1);
      void holder.track('op2', () => promise2);

      expect(holder.has('op1')).toBe(true);
      expect(holder.has('op2')).toBe(true);
      expect(holder.has('op3')).toBe(false);

      // Complete first operation
      resolve1!('result1');

      // After microtask, op1 should be cleaned up
      return Promise.resolve().then(() => {
        expect(holder.has('op1')).toBe(false);
        expect(holder.has('op2')).toBe(true);

        // Complete second operation
        resolve2!('result2');
        return Promise.resolve().then(() => {
          expect(holder.has('op2')).toBe(false);
        });
      });
    });
  });

  describe('inherited PromiseTracker behavior', () => {
    test('should maintain size correctly', async () => {
      const holder = holdPromises();

      expect(holder.size).toBe(0);

      const promise1 = holder.track('op1', () => Promise.resolve('result1'));
      expect(holder.size).toBe(1);

      const promise2 = holder.track('op2', () => Promise.resolve('result2'));
      expect(holder.size).toBe(2);

      // Tracking same ID should not increase size
      const promise1Duplicate = holder.track('op1', () => Promise.resolve('should-not-execute'));
      expect(holder.size).toBe(2);
      expect(promise1Duplicate).toBe(promise1);

      await Promise.all([promise1, promise2]);
      expect(holder.size).toBe(0);
    });

    test('should emit settlement events', async () => {
      const holder = holdPromises();
      const events: PromiseSettledEvent[] = [];

      holder.onSettled((event) => {
        events.push(event);
      });

      const result1 = await holder.track('successful-op', () => Promise.resolve('success'));
      expect(result1).toBe('success');

      const error = new Error('failure');
      await expect(holder.track('failing-op', () => Promise.reject(error))).rejects.toThrow(error);

      expect(events).toHaveLength(2);

      const successEvent = events.find((e) => e.label === 'successful-op');
      const errorEvent = events.find((e) => e.label === 'failing-op');

      expect(successEvent).toMatchObject({ label: 'successful-op', duration: expect.any(Number), result: 'success' });

      expect(errorEvent).toMatchObject({
        label: 'failing-op',
        duration: expect.any(Number),
        rejected: true,
        result: error,
      });
    });

    test('should support wait functionality', async () => {
      const holder = holdPromises();

      let resolve1: (value: string) => void;
      let resolve2: (value: string) => void;

      const promise1 = new Promise<string>((resolve) => {
        resolve1 = resolve;
      });
      const promise2 = new Promise<string>((resolve) => {
        resolve2 = resolve;
      });

      void holder.track('wait-op1', () => promise1);
      void holder.track('wait-op2', () => promise2);

      expect(holder.size).toBe(2);

      const waitPromise = holder.wait();

      // Resolve both operations
      resolve1!('result1');
      resolve2!('result2');

      await waitPromise;
      expect(holder.size).toBe(0);
    });

    test('should not wait for promises tracked after wait is called', async () => {
      const holder = holdPromises();

      let resolve1: (value: string) => void;
      let resolve2: (value: string) => void;

      const promise1 = new Promise<string>((resolve) => {
        resolve1 = resolve;
      });

      void holder.track('initial-op', () => promise1);
      const waitPromise = holder.wait();

      // Track another operation after wait is called
      const promise2 = new Promise<string>((resolve) => {
        resolve2 = resolve;
      });
      void holder.track('after-wait-op', () => promise2);

      // Resolve only the first operation
      resolve1!('result1');
      await waitPromise;

      // Should still have the second operation tracked
      expect(holder.size).toBe(1);

      // Clean up
      resolve2!('result2');
      await promise2;
      expect(holder.size).toBe(0);
    });
  });

  describe('logging integration', () => {
    test('should call logger methods when logger is provided', async () => {
      const testLogger = createTestLogger();
      const holder = holdPromises({ logger: testLogger });

      const result = await holder.track('logged-operation', () => Promise.resolve('logged-result'));
      expect(result).toBe('logged-result');

      // Should have logged tracking and resolution
      expect(testLogger).toHaveLoggedWith(
        'debug',
        "promise: tracking a promise supplier with label 'logged-operation'",
      );
      expect(testLogger).toHaveLoggedWith('debug', "promise: promise with label 'logged-operation' resolved in");
    });

    test('should log cached operations appropriately', async () => {
      const testLogger = createTestLogger();
      const holder = holdPromises({ logger: testLogger });

      // First call should log operation start
      const promise1 = holder.track('cached-op', () => Promise.resolve('cached'));

      // Second call should not trigger additional logging for operation start
      const promise2 = holder.track('cached-op', () => Promise.resolve('should-not-execute'));

      expect(promise1).toBe(promise2);
      await promise1;

      // Should only log once for the supplier execution
      expect(testLogger).toHaveLoggedWith('debug', "promise: tracking a promise supplier with label 'cached-op'");
    });
  });

  describe('edge cases', () => {
    test('should handle operation that resolves to undefined', async () => {
      const holder = holdPromises();
      const supplierFn = jest.fn(() => Promise.resolve(undefined));

      const promise1 = holder.track('undefined-result', supplierFn);
      const promise2 = holder.track('undefined-result', supplierFn);

      expect(promise1).toBe(promise2);
      expect(supplierFn).toHaveBeenCalledTimes(1);

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    test('should handle rapid sequential calls with same ID', async () => {
      const holder = holdPromises();
      const supplierFn = jest.fn(() => Promise.resolve('sequential-result'));

      // Make multiple calls in quick succession
      const promises: Promise<string>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(holder.track('rapid-calls', supplierFn));
      }

      expect(supplierFn).toHaveBeenCalledTimes(1);

      // All should resolve to same result
      const results = await Promise.all(promises);
      expect(results).toEqual(Array(10).fill('sequential-result'));

      // All promises should be the same instance
      promises.forEach((promise, index) => {
        if (index > 0) {
          expect(promise).toBe(promises[0]);
        }
      });
    });

    test('should handle empty string as operation ID', async () => {
      const holder = holdPromises();
      const supplierFn = jest.fn(() => Promise.resolve('empty-id-result'));

      const result = await holder.track('', supplierFn);
      expect(result).toBe('empty-id-result');
      expect(holder.has('')).toBe(false);
    });

    test('should invoke the operation if the previous has settled', async () => {
      const holder = holdPromises();
      const complexObject = { data: [1, 2, 3], nested: { value: 'test' } };
      const supplierFn = jest.fn(() => Promise.resolve(complexObject));

      const result1 = await holder.track('complex-object', supplierFn);
      const result2 = await holder.track('complex-object', supplierFn);

      expect(result1).toBe(complexObject);
      expect(result2).toBe(complexObject);
      expect(supplierFn).toHaveBeenCalledTimes(2);
    });
  });
});
