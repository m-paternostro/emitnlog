/* eslint-disable @typescript-eslint/no-confusing-void-expression */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { PromiseSettledEvent } from '../../../src/tracker/index.ts';
import { vaultPromises } from '../../../src/tracker/index.ts';
import { createTestLogger } from '../../jester.setup.ts';

describe('emitnlog.tracker.promise.vault', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('vaultPromises', () => {
    test('should create a vault with size 0', () => {
      const vault = vaultPromises();
      expect(vault.size).toBe(0);
    });

    test('should create a vault with forgetOnRejection option', () => {
      const vault = vaultPromises({ forgetOnRejection: true });
      expect(vault.size).toBe(0);
    });
  });

  describe('persistent caching behavior', () => {
    test('should cache successful operations permanently', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('cached-result'));

      // First call executes the supplier
      const result1 = await vault.track('persistent-op', supplierFn);
      expect(result1).toBe('cached-result');
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(1); // Should remain in cache

      // Second call uses cached result
      const result2 = await vault.track('persistent-op', supplierFn);
      expect(result2).toBe('cached-result');
      expect(supplierFn).toHaveBeenCalledTimes(1); // Not called again
      expect(vault.size).toBe(1); // Still in cache

      // Verify they're the same cached promise
      const promise1 = vault.track('persistent-op', supplierFn);
      const promise2 = vault.track('persistent-op', supplierFn);
      expect(promise1).toBe(promise2);
      expect(supplierFn).toHaveBeenCalledTimes(1); // Still not called again
    });

    test('should cache failed operations permanently by default', async () => {
      const vault = vaultPromises();
      const error = new Error('operation failed');
      const supplierFn = jest.fn(() => Promise.reject(error));

      // First call executes and fails
      await expect(vault.track('failing-op', supplierFn)).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(1); // Should remain in cache

      // Second call uses cached rejected promise
      await expect(vault.track('failing-op', supplierFn)).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(1); // Not called again
      expect(vault.size).toBe(1); // Still in cache

      // Verify they're the same cached promise
      const promise1 = vault.track('failing-op', supplierFn);
      const promise2 = vault.track('failing-op', supplierFn);
      expect(promise1).toBe(promise2);
      expect(supplierFn).toHaveBeenCalledTimes(1); // Still not called again
    });

    test('should cache multiple operations independently', async () => {
      const vault = vaultPromises();
      const supplier1 = jest.fn(() => Promise.resolve('result-1'));
      const supplier2 = jest.fn(() => Promise.resolve('result-2'));

      const result1 = await vault.track('op-1', supplier1);
      const result2 = await vault.track('op-2', supplier2);

      expect(result1).toBe('result-1');
      expect(result2).toBe('result-2');
      expect(supplier1).toHaveBeenCalledTimes(1);
      expect(supplier2).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(2);

      // Both operations should be cached permanently
      const cachedResult1 = await vault.track('op-1', supplier1);
      const cachedResult2 = await vault.track('op-2', supplier2);

      expect(cachedResult1).toBe('result-1');
      expect(cachedResult2).toBe('result-2');
      expect(supplier1).toHaveBeenCalledTimes(1); // Not called again
      expect(supplier2).toHaveBeenCalledTimes(1); // Not called again
      expect(vault.size).toBe(2);
    });

    test('should handle concurrent requests during operation execution', async () => {
      const vault = vaultPromises();
      let resolvePromise: (value: string) => void;
      const delayedPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
      const supplierFn = jest.fn(() => delayedPromise);

      // Start multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => vault.track('concurrent-op', supplierFn));

      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(1);

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
      expect(vault.size).toBe(1); // Should remain cached

      // Additional requests should use cached result
      const additionalResult = await vault.track('concurrent-op', supplierFn);
      expect(additionalResult).toBe('concurrent-result');
      expect(supplierFn).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('forgetOnRejection option', () => {
    test('should automatically clear failed operations when forgetOnRejection is true', async () => {
      const vault = vaultPromises({ forgetOnRejection: true });
      const error = new Error('operation failed');
      const supplierFn = jest.fn(() => Promise.reject(error));

      // First call executes and fails
      await expect(vault.track('auto-retry-op', supplierFn)).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(0); // Should be cleared from cache

      // Second call executes again (not cached)
      await expect(vault.track('auto-retry-op', supplierFn)).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(2); // Called again
      expect(vault.size).toBe(0); // Still cleared
    });

    test('should cache successful operations even with forgetOnRejection=true', async () => {
      const vault = vaultPromises({ forgetOnRejection: true });
      const supplierFn = jest.fn(() => Promise.resolve('success-result'));

      // First call executes successfully
      const result1 = await vault.track('success-op', supplierFn);
      expect(result1).toBe('success-result');
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(1); // Should remain in cache

      // Second call uses cached result
      const result2 = await vault.track('success-op', supplierFn);
      expect(result2).toBe('success-result');
      expect(supplierFn).toHaveBeenCalledTimes(1); // Not called again
      expect(vault.size).toBe(1); // Still in cache
    });

    test('should handle mixed success and failure scenarios with forgetOnRejection', async () => {
      const vault = vaultPromises({ forgetOnRejection: true });
      const error = new Error('failure');
      const successSupplier = jest.fn(() => Promise.resolve('success'));
      const failureSupplier = jest.fn(() => Promise.reject(error));

      // Success operation - should be cached
      const successResult = await vault.track('success-op', successSupplier);
      expect(successResult).toBe('success');
      expect(vault.size).toBe(1);

      // Failure operation - should not be cached
      await expect(vault.track('failure-op', failureSupplier)).rejects.toThrow(error);
      expect(vault.size).toBe(1); // Only success operation cached

      // Second call to failure operation should execute again
      await expect(vault.track('failure-op', failureSupplier)).rejects.toThrow(error);
      expect(failureSupplier).toHaveBeenCalledTimes(2);

      // Success operation should still be cached
      const cachedSuccess = await vault.track('success-op', successSupplier);
      expect(cachedSuccess).toBe('success');
      expect(successSupplier).toHaveBeenCalledTimes(1); // Not called again
      expect(vault.size).toBe(1);
    });

    test('should allow retry pattern with forgetOnRejection', async () => {
      const vault = vaultPromises({ forgetOnRejection: true });
      const error = new Error('network error');
      let attemptCount = 0;
      const flakySupplier = jest.fn(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(error);
        }
        return Promise.resolve('success-after-retries');
      });

      // First two attempts fail and are cleared
      await expect(vault.track('flaky-op', flakySupplier)).rejects.toThrow(error);
      expect(vault.size).toBe(0);

      await expect(vault.track('flaky-op', flakySupplier)).rejects.toThrow(error);
      expect(vault.size).toBe(0);

      // Third attempt succeeds and is cached
      const result = await vault.track('flaky-op', flakySupplier);
      expect(result).toBe('success-after-retries');
      expect(vault.size).toBe(1);
      expect(flakySupplier).toHaveBeenCalledTimes(3);

      // Fourth attempt uses cached success
      const cachedResult = await vault.track('flaky-op', flakySupplier);
      expect(cachedResult).toBe('success-after-retries');
      expect(flakySupplier).toHaveBeenCalledTimes(3); // Not called again
    });
  });

  describe('clear method', () => {
    test('should clear all cached operations', async () => {
      const vault = vaultPromises();
      const supplier1 = jest.fn(() => Promise.resolve('result-1'));
      const supplier2 = jest.fn(() => Promise.resolve('result-2'));

      // Cache two operations
      await vault.track('op-1', supplier1);
      await vault.track('op-2', supplier2);
      expect(vault.size).toBe(2);

      // Clear all cached operations
      vault.clear();
      expect(vault.size).toBe(0);

      // Next calls should execute suppliers again
      const newResult1 = await vault.track('op-1', supplier1);
      const newResult2 = await vault.track('op-2', supplier2);

      expect(newResult1).toBe('result-1');
      expect(newResult2).toBe('result-2');
      expect(supplier1).toHaveBeenCalledTimes(2); // Called again
      expect(supplier2).toHaveBeenCalledTimes(2); // Called again
      expect(vault.size).toBe(2);
    });

    test('should handle clear on empty vault', () => {
      const vault = vaultPromises();
      expect(vault.size).toBe(0);

      vault.clear();
      expect(vault.size).toBe(0);
    });

    test('should clear both successful and failed operations', async () => {
      const vault = vaultPromises();
      const error = new Error('failure');
      const successSupplier = jest.fn(() => Promise.resolve('success'));
      const failureSupplier = jest.fn(() => Promise.reject(error));

      // Cache one success and one failure
      await vault.track('success-op', successSupplier);
      await expect(vault.track('failure-op', failureSupplier)).rejects.toThrow(error);
      expect(vault.size).toBe(2);

      // Clear all
      vault.clear();
      expect(vault.size).toBe(0);

      // Both operations should execute again
      const newSuccess = await vault.track('success-op', successSupplier);
      await expect(vault.track('failure-op', failureSupplier)).rejects.toThrow(error);

      expect(newSuccess).toBe('success');
      expect(successSupplier).toHaveBeenCalledTimes(2);
      expect(failureSupplier).toHaveBeenCalledTimes(2);
      expect(vault.size).toBe(2);
    });
  });

  describe('forget method', () => {
    test('should remove specific cached operation', async () => {
      const vault = vaultPromises();
      const supplier1 = jest.fn(() => Promise.resolve('result-1'));
      const supplier2 = jest.fn(() => Promise.resolve('result-2'));

      // Cache two operations
      await vault.track('op-1', supplier1);
      await vault.track('op-2', supplier2);
      expect(vault.size).toBe(2);

      // Remove specific operation
      const wasRemoved = vault.forget('op-1');
      expect(wasRemoved).toBe(true);
      expect(vault.size).toBe(1);

      // op-1 should execute again, op-2 should use cached result
      const newResult1 = await vault.track('op-1', supplier1);
      const cachedResult2 = await vault.track('op-2', supplier2);

      expect(newResult1).toBe('result-1');
      expect(cachedResult2).toBe('result-2');
      expect(supplier1).toHaveBeenCalledTimes(2); // Called again
      expect(supplier2).toHaveBeenCalledTimes(1); // Not called again
      expect(vault.size).toBe(2);
    });

    test('should return false when trying to forget non-existent operation', () => {
      const vault = vaultPromises();

      const wasRemoved = vault.forget('non-existent-op');
      expect(wasRemoved).toBe(false);
      expect(vault.size).toBe(0);
    });

    test('should handle forgetting failed operations', async () => {
      const vault = vaultPromises();
      const error = new Error('operation failed');
      const supplierFn = jest.fn(() => Promise.reject(error));

      // Cache a failed operation
      await expect(vault.track('failing-op', supplierFn)).rejects.toThrow(error);
      expect(vault.size).toBe(1);

      // Remove the failed operation
      const wasRemoved = vault.forget('failing-op');
      expect(wasRemoved).toBe(true);
      expect(vault.size).toBe(0);

      // Operation should execute again
      await expect(vault.track('failing-op', supplierFn)).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(2); // Called again
      expect(vault.size).toBe(1);
    });

    test('should handle forgetting during concurrent operations', async () => {
      const vault = vaultPromises();
      let resolvePromise: (value: string) => void;
      const delayedPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
      const supplierFn = jest.fn(() => delayedPromise);

      // Start operation
      const promise1 = vault.track('concurrent-op', supplierFn);
      expect(vault.size).toBe(1);

      // Try to forget while operation is still running
      const wasRemoved = vault.forget('concurrent-op');
      expect(wasRemoved).toBe(true);
      expect(vault.size).toBe(0);

      // Complete the operation
      resolvePromise!('result');
      const result = await promise1;
      expect(result).toBe('result');

      // New operation should execute (not cached)
      const newPromise = vault.track('concurrent-op', supplierFn);
      expect(newPromise).not.toBe(promise1);
      expect(supplierFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('has method', () => {
    test('should return true for cached operations', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('result'));

      expect(vault.has('test-op')).toBe(false);

      await vault.track('test-op', supplierFn);
      expect(vault.has('test-op')).toBe(true);

      // Should remain true after operation completes (persistent cache)
      expect(vault.has('test-op')).toBe(true);
    });

    test('should return false after forget', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('result'));

      await vault.track('test-op', supplierFn);
      expect(vault.has('test-op')).toBe(true);

      vault.forget('test-op');
      expect(vault.has('test-op')).toBe(false);
    });

    test('should return false after clear', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('result'));

      await vault.track('test-op', supplierFn);
      expect(vault.has('test-op')).toBe(true);

      vault.clear();
      expect(vault.has('test-op')).toBe(false);
    });

    test('should handle failed operations based on forgetOnRejection', async () => {
      const defaultVault = vaultPromises();
      const forgetVault = vaultPromises({ forgetOnRejection: true });
      const error = new Error('failure');
      const supplierFn = jest.fn(() => Promise.reject(error));

      // Default vault should cache failed operations
      await expect(defaultVault.track('fail-op', supplierFn)).rejects.toThrow(error);
      expect(defaultVault.has('fail-op')).toBe(true);

      // forgetOnRejection vault should not cache failed operations
      await expect(forgetVault.track('fail-op', supplierFn)).rejects.toThrow(error);
      expect(forgetVault.has('fail-op')).toBe(false);
    });
  });

  describe('inherited PromiseTracker behavior', () => {
    test('should emit settlement events for cached operations', async () => {
      const vault = vaultPromises();
      const events: PromiseSettledEvent[] = [];

      vault.onSettled((event) => {
        events.push(event);
      });

      // First execution should emit event
      await vault.track('test-op', () => Promise.resolve('result'));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ label: 'test-op', duration: expect.any(Number), result: 'result' });

      // Second execution should not emit event (cached)
      await vault.track('test-op', () => Promise.resolve('should-not-execute'));
      expect(events).toHaveLength(1); // No additional event
    });

    test('should support wait functionality with persistent cache', async () => {
      const vault = vaultPromises();

      let resolve1: (value: string) => void;
      let resolve2: (value: string) => void;

      const promise1 = new Promise<string>((resolve) => {
        resolve1 = resolve;
      });
      const promise2 = new Promise<string>((resolve) => {
        resolve2 = resolve;
      });

      void vault.track('wait-op1', () => promise1);
      void vault.track('wait-op2', () => promise2);

      expect(vault.size).toBe(2);

      const waitPromise = vault.wait();

      // Resolve both operations
      resolve1!('result1');
      resolve2!('result2');

      await waitPromise;
      expect(vault.size).toBe(2); // Should remain cached
    });

    test('should handle wait with empty vault', async () => {
      const vault = vaultPromises();
      expect(vault.size).toBe(0);

      await vault.wait();
      expect(vault.size).toBe(0);
    });
  });

  describe('logging integration', () => {
    test('should log operations with logger', async () => {
      const testLogger = createTestLogger();
      const vault = vaultPromises({ logger: testLogger });

      await vault.track('logged-op', () => Promise.resolve('result'));

      expect(testLogger).toHaveLoggedWith('debug', "promise: tracking a promise supplier with label 'logged-op'");
      expect(testLogger).toHaveLoggedWith('debug', "promise: promise with label 'logged-op' resolved in");
    });

    test('should not log duplicate operations', async () => {
      const testLogger = createTestLogger();
      const vault = vaultPromises({ logger: testLogger });

      // First call should log
      await vault.track('cached-op', () => Promise.resolve('result'));

      // Second call should not log operation start (cached)
      await vault.track('cached-op', () => Promise.resolve('should-not-execute'));

      // Should only log once for the supplier execution
      expect(testLogger).toHaveLoggedWith('debug', "promise: tracking a promise supplier with label 'cached-op'");
      expect(testLogger).toHaveLoggedWith('debug', "promise: promise with label 'cached-op' resolved in");
    });

    test('should log with forgetOnRejection option', async () => {
      const testLogger = createTestLogger();
      const vault = vaultPromises({ logger: testLogger, forgetOnRejection: true });

      const error = new Error('test error');
      await expect(vault.track('retry-op', () => Promise.reject(error))).rejects.toThrow(error);

      expect(testLogger).toHaveLoggedWith('debug', "promise: tracking a promise supplier with label 'retry-op'");
      expect(testLogger).toHaveLoggedWith('debug', "promise: promise with label 'retry-op' rejected in");
    });
  });

  describe('forget option in track method', () => {
    test('should use persistent caching by default (forget: false)', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('persistent-result'));

      // First call executes the supplier
      const result1 = await vault.track('default-behavior', supplierFn);
      expect(result1).toBe('persistent-result');
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(1); // Should remain in cache

      // Second call uses cached result
      const result2 = await vault.track('default-behavior', supplierFn);
      expect(result2).toBe('persistent-result');
      expect(supplierFn).toHaveBeenCalledTimes(1); // Not called again
      expect(vault.size).toBe(1); // Still in cache
    });

    test('should use persistent caching when forget: false is explicit', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('explicit-persistent'));

      // First call with explicit forget: false
      const result1 = await vault.track('explicit-persistent', supplierFn, { forget: false });
      expect(result1).toBe('explicit-persistent');
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(1);

      // Second call should use cached result
      const result2 = await vault.track('explicit-persistent', supplierFn, { forget: false });
      expect(result2).toBe('explicit-persistent');
      expect(supplierFn).toHaveBeenCalledTimes(1); // Not called again
      expect(vault.size).toBe(1);
    });

    test('should use transient caching when forget: true (PromiseHolder behavior)', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('transient-result'));

      // First call executes and caches temporarily
      const result1 = await vault.track('transient-op', supplierFn, { forget: true });
      expect(result1).toBe('transient-result');
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(0); // Should be cleared after settlement

      // Second call executes again (not cached)
      const result2 = await vault.track('transient-op', supplierFn, { forget: true });
      expect(result2).toBe('transient-result');
      expect(supplierFn).toHaveBeenCalledTimes(2); // Called again
      expect(vault.size).toBe(0); // Still cleared
    });

    test('should handle mixed caching strategies in same vault', async () => {
      const vault = vaultPromises();
      const persistentSupplier = jest.fn(() => Promise.resolve('persistent'));
      const transientSupplier = jest.fn(() => Promise.resolve('transient'));

      // Persistent operation
      const persistent1 = await vault.track('persistent-op', persistentSupplier, { forget: false });
      expect(persistent1).toBe('persistent');
      expect(vault.size).toBe(1);

      // Transient operation
      const transient1 = await vault.track('transient-op', transientSupplier, { forget: true });
      expect(transient1).toBe('transient');
      expect(vault.size).toBe(1); // Only persistent operation remains

      // Verify behaviors persist
      const persistent2 = await vault.track('persistent-op', persistentSupplier, { forget: false });
      const transient2 = await vault.track('transient-op', transientSupplier, { forget: true });

      expect(persistent2).toBe('persistent');
      expect(transient2).toBe('transient');
      expect(persistentSupplier).toHaveBeenCalledTimes(1); // Cached
      expect(transientSupplier).toHaveBeenCalledTimes(2); // Not cached
      expect(vault.size).toBe(1); // Still only persistent operation
    });

    test('should handle error scenarios with forget: true', async () => {
      const vault = vaultPromises();
      const error = new Error('transient operation failed');
      const supplierFn = jest.fn(() => Promise.reject(error));

      // First call fails and is cleared automatically
      await expect(vault.track('transient-error', supplierFn, { forget: true })).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(0); // Should be cleared

      // Second call executes again (not cached)
      await expect(vault.track('transient-error', supplierFn, { forget: true })).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(2); // Called again
      expect(vault.size).toBe(0); // Still cleared
    });

    test('should handle error scenarios with forget: false', async () => {
      const vault = vaultPromises();
      const error = new Error('persistent operation failed');
      const supplierFn = jest.fn(() => Promise.reject(error));

      // First call fails and is cached
      await expect(vault.track('persistent-error', supplierFn, { forget: false })).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(1); // Should remain in cache

      // Second call uses cached failure
      await expect(vault.track('persistent-error', supplierFn, { forget: false })).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(1); // Not called again
      expect(vault.size).toBe(1); // Still in cache
    });

    test('should respect forgetOnRejection option even when forget: false', async () => {
      const vault = vaultPromises({ forgetOnRejection: true });
      const error = new Error('should be cleared by forgetOnRejection');
      const supplierFn = jest.fn(() => Promise.reject(error));

      // forget: false but forgetOnRejection: true should clear on failure
      await expect(vault.track('error-with-global-forget', supplierFn, { forget: false })).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(0); // Should be cleared by forgetOnRejection

      // Second call executes again
      await expect(vault.track('error-with-global-forget', supplierFn, { forget: false })).rejects.toThrow(error);
      expect(supplierFn).toHaveBeenCalledTimes(2); // Called again
      expect(vault.size).toBe(0);
    });

    test('should handle concurrent operations with forget: true', async () => {
      const vault = vaultPromises();
      let resolvePromise: (value: string) => void;
      const delayedPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
      const supplierFn = jest.fn(() => delayedPromise);

      // Start multiple concurrent requests with forget: true
      const promises = Array.from({ length: 3 }, () =>
        vault.track('concurrent-transient', supplierFn, { forget: true }),
      );

      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(1); // Operation in progress

      // All promises should be the same instance
      promises.forEach((promise, index) => {
        if (index > 0) {
          expect(promise).toBe(promises[0]);
        }
      });

      // Resolve the operation
      resolvePromise!('concurrent-result');
      const results = await Promise.all(promises);

      expect(results).toEqual(Array(3).fill('concurrent-result'));
      expect(vault.size).toBe(0); // Should be cleared after settlement

      // New request should execute fresh
      const newResult = await vault.track('concurrent-transient', supplierFn, { forget: true });
      expect(newResult).toBe('concurrent-result');
      expect(supplierFn).toHaveBeenCalledTimes(2); // Called again
    });

    test('should allow switching forget behavior for same operation ID', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('switchable-result'));

      // First call with forget: true (transient)
      const result1 = await vault.track('switchable-op', supplierFn, { forget: true });
      expect(result1).toBe('switchable-result');
      expect(vault.size).toBe(0); // Cleared

      // Second call with forget: false (persistent)
      const result2 = await vault.track('switchable-op', supplierFn, { forget: false });
      expect(result2).toBe('switchable-result');
      expect(vault.size).toBe(1); // Cached

      // Third call should use cached result
      const result3 = await vault.track('switchable-op', supplierFn, { forget: false });
      expect(result3).toBe('switchable-result');
      expect(supplierFn).toHaveBeenCalledTimes(2); // Called twice total
      expect(vault.size).toBe(1);
    });

    test('should emit events for both persistent and transient operations', async () => {
      const vault = vaultPromises();
      const events: PromiseSettledEvent[] = [];

      vault.onSettled((event) => {
        events.push(event);
      });

      // Persistent operation
      await vault.track('persistent-event', () => Promise.resolve('persistent'), { forget: false });

      // Transient operation
      await vault.track('transient-event', () => Promise.resolve('transient'), { forget: true });

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        label: 'persistent-event',
        duration: expect.any(Number),
        result: 'persistent',
      });
      expect(events[1]).toMatchObject({ label: 'transient-event', duration: expect.any(Number), result: 'transient' });

      // Only persistent operation should remain
      expect(vault.size).toBe(1);
    });

    test('should handle forget option with logging', async () => {
      const testLogger = createTestLogger();
      const vault = vaultPromises({ logger: testLogger });

      // Test both persistent and transient operations
      await vault.track('logged-persistent', () => Promise.resolve('persistent'), { forget: false });
      await vault.track('logged-transient', () => Promise.resolve('transient'), { forget: true });

      expect(testLogger).toHaveLoggedWith(
        'debug',
        "promise: tracking a promise supplier with label 'logged-persistent'",
      );
      expect(testLogger).toHaveLoggedWith('debug', "promise: promise with label 'logged-persistent' resolved in");
      expect(testLogger).toHaveLoggedWith(
        'debug',
        "promise: tracking a promise supplier with label 'logged-transient'",
      );
      expect(testLogger).toHaveLoggedWith('debug', "promise: promise with label 'logged-transient' resolved in");
    });

    test('should handle synchronous errors with forget: true', async () => {
      const vault = vaultPromises();
      const error = new Error('sync error with forget');
      const throwingSupplier = jest.fn(() => {
        throw error;
      });

      // First call throws and should be cleared
      await expect(vault.track('sync-error-transient', throwingSupplier, { forget: true })).rejects.toThrow(error);
      expect(vault.size).toBe(0); // Should be cleared

      // Second call executes again
      await expect(vault.track('sync-error-transient', throwingSupplier, { forget: true })).rejects.toThrow(error);
      expect(throwingSupplier).toHaveBeenCalledTimes(2); // Called again
      expect(vault.size).toBe(0);
    });

    test('should handle complex scenarios with mixed options and global forgetOnRejection', async () => {
      const vault = vaultPromises({ forgetOnRejection: true });
      const successSupplier = jest.fn(() => Promise.resolve('success'));
      const errorSupplier = jest.fn(() => Promise.reject(new Error('failure')));

      // Success with forget: false - should be cached (overrides global forgetOnRejection for success)
      await vault.track('success-persistent', successSupplier, { forget: false });
      expect(vault.size).toBe(1);

      // Success with forget: true - should be cleared
      await vault.track('success-transient', successSupplier, { forget: true });
      expect(vault.size).toBe(1); // Only persistent success remains

      // Error with forget: false - should be cleared due to global forgetOnRejection
      await expect(vault.track('error-persistent', errorSupplier, { forget: false })).rejects.toThrow();
      expect(vault.size).toBe(1); // Still only persistent success

      // Error with forget: true - should be cleared
      await expect(vault.track('error-transient', errorSupplier, { forget: true })).rejects.toThrow();
      expect(vault.size).toBe(1); // Still only persistent success

      // Verify cached success is still available
      const cachedSuccess = await vault.track('success-persistent', successSupplier, { forget: false });
      expect(cachedSuccess).toBe('success');
      expect(successSupplier).toHaveBeenCalledTimes(2); // Called twice (once persistent, once transient)
    });

    test('should validate that forget option does not affect other operations', async () => {
      const vault = vaultPromises();
      const supplier1 = jest.fn(() => Promise.resolve('result1'));
      const supplier2 = jest.fn(() => Promise.resolve('result2'));
      const supplier3 = jest.fn(() => Promise.resolve('result3'));

      // Mix of operations with different forget settings
      await vault.track('op1', supplier1, { forget: false }); // Persistent
      await vault.track('op2', supplier2, { forget: true }); // Transient
      await vault.track('op3', supplier3); // Default (persistent)

      expect(vault.size).toBe(2); // op1 and op3 should be cached

      // Second calls
      await vault.track('op1', supplier1, { forget: false }); // Should use cache
      await vault.track('op2', supplier2, { forget: true }); // Should execute again
      await vault.track('op3', supplier3); // Should use cache

      expect(supplier1).toHaveBeenCalledTimes(1); // Cached
      expect(supplier2).toHaveBeenCalledTimes(2); // Not cached
      expect(supplier3).toHaveBeenCalledTimes(1); // Cached
      expect(vault.size).toBe(2); // Still op1 and op3
    });
  });

  describe('edge cases', () => {
    test('should handle suppliers that throw synchronously', async () => {
      const vault = vaultPromises();
      const error = new Error('sync error');
      const throwingSupplier = jest.fn(() => {
        throw error;
      });

      await expect(vault.track('sync-error', throwingSupplier)).rejects.toThrow(error);
      expect(vault.size).toBe(1); // Should be cached

      // Second call should use cached rejected promise
      await expect(vault.track('sync-error', throwingSupplier)).rejects.toThrow(error);
      expect(throwingSupplier).toHaveBeenCalledTimes(1); // Not called again
    });

    test('should handle suppliers that throw synchronously with forgetOnRejection', async () => {
      const vault = vaultPromises({ forgetOnRejection: true });
      const error = new Error('sync error');
      const throwingSupplier = jest.fn(() => {
        throw error;
      });

      await expect(vault.track('sync-error-retry', throwingSupplier)).rejects.toThrow(error);
      expect(vault.size).toBe(0); // Should be cleared

      // Second call should execute again
      await expect(vault.track('sync-error-retry', throwingSupplier)).rejects.toThrow(error);
      expect(throwingSupplier).toHaveBeenCalledTimes(2); // Called again
    });

    test('should handle undefined and null results', async () => {
      const vault = vaultPromises();
      const undefinedSupplier = jest.fn(() => Promise.resolve(undefined));
      const nullSupplier = jest.fn(() => Promise.resolve(null));

      const undefinedResult = await vault.track('undefined-op', undefinedSupplier);
      const nullResult = await vault.track('null-op', nullSupplier);

      expect(undefinedResult).toBeUndefined();
      expect(nullResult).toBeNull();
      expect(vault.size).toBe(2);

      // Should be cached
      const cachedUndefined = await vault.track('undefined-op', undefinedSupplier);
      const cachedNull = await vault.track('null-op', nullSupplier);

      expect(cachedUndefined).toBeUndefined();
      expect(cachedNull).toBeNull();
      expect(undefinedSupplier).toHaveBeenCalledTimes(1);
      expect(nullSupplier).toHaveBeenCalledTimes(1);
    });

    test('should handle empty string as operation ID', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('empty-id-result'));

      const result = await vault.track('', supplierFn);
      expect(result).toBe('empty-id-result');
      expect(vault.has('')).toBe(true);
      expect(vault.size).toBe(1);

      // Should be cached
      const cachedResult = await vault.track('', supplierFn);
      expect(cachedResult).toBe('empty-id-result');
      expect(supplierFn).toHaveBeenCalledTimes(1);
    });

    test('should handle complex objects as results', async () => {
      const vault = vaultPromises();
      const complexObject = { data: [1, 2, 3], nested: { value: 'test' } };
      const supplierFn = jest.fn(() => Promise.resolve(complexObject));

      const result1 = await vault.track('complex-object', supplierFn);
      expect(result1).toBe(complexObject);
      expect(vault.size).toBe(1);

      // Should be cached
      const result2 = await vault.track('complex-object', supplierFn);
      expect(result2).toBe(complexObject);
      expect(supplierFn).toHaveBeenCalledTimes(1);
    });

    test('should handle rapid sequential calls', async () => {
      const vault = vaultPromises();
      const supplierFn = jest.fn(() => Promise.resolve('rapid-result'));

      const promises: Promise<string>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(vault.track('rapid-calls', supplierFn));
      }

      expect(supplierFn).toHaveBeenCalledTimes(1);
      expect(vault.size).toBe(1);

      const results = await Promise.all(promises);
      expect(results).toEqual(Array(10).fill('rapid-result'));

      // All promises should be the same instance
      promises.forEach((promise, index) => {
        if (index > 0) {
          expect(promise).toBe(promises[0]);
        }
      });
    });
  });
});
