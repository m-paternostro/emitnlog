import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createDeferredValue } from '../../../src/utils/index.ts';

describe('emitnlog.utils.deferred-value', () => {
  describe('using fake timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should resolve the promise with the correct value', async () => {
      const deferred = createDeferredValue<number>();

      expect(deferred.settled).toBe(false);
      expect(deferred.resolved).toBe(false);
      expect(deferred.rejected).toBe(false);

      setTimeout(() => deferred.resolve(42), 1000);
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).resolves.toBe(42);

      expect(deferred.settled).toBe(true);
      expect(deferred.resolved).toBe(true);
      expect(deferred.rejected).toBe(false);
    });

    test('should reject the promise with the correct reason', async () => {
      const deferred = createDeferredValue<number>();

      expect(deferred.settled).toBe(false);
      expect(deferred.resolved).toBe(false);
      expect(deferred.rejected).toBe(false);

      const error = new Error('test error');
      setTimeout(() => deferred.reject(error), 1000);
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).rejects.toThrow('test error');

      expect(deferred.settled).toBe(true);
      expect(deferred.resolved).toBe(false);
      expect(deferred.rejected).toBe(true);
    });
  });

  test('should update resolved state after resolution', async () => {
    const deferred = createDeferredValue<number>();
    expect(deferred.resolved).toBe(false);
    deferred.resolve(42);
    expect(deferred.resolved).toBe(true);
    await deferred.promise;
  });

  test('should update rejected state after rejection', async () => {
    const deferred = createDeferredValue<number>();
    expect(deferred.rejected).toBe(false);
    deferred.reject(new Error('test error'));
    expect(deferred.rejected).toBe(true);
    await expect(deferred.promise).rejects.toThrow();
  });

  test('should ignore subsequent resolve calls after being resolved', async () => {
    const deferred = createDeferredValue<number>();
    deferred.resolve(42);
    deferred.resolve(100); // This should be ignored
    await expect(deferred.promise).resolves.toBe(42);
  });

  test('should ignore subsequent reject calls after being resolved', async () => {
    const deferred = createDeferredValue<number>();
    deferred.resolve(42);
    deferred.reject(new Error('test error')); // This should be ignored
    await expect(deferred.promise).resolves.toBe(42);
  });

  test('should ignore subsequent resolve calls after being rejected', async () => {
    const deferred = createDeferredValue<number>();
    const error = new Error('test error');
    deferred.reject(error);
    deferred.resolve(42); // This should be ignored
    await expect(deferred.promise).rejects.toThrow('test error');
  });

  test('should ignore subsequent reject calls after being rejected', async () => {
    const deferred = createDeferredValue<number>();
    deferred.reject(new Error('first error'));
    deferred.reject(new Error('second error')); // This should be ignored
    await expect(deferred.promise).rejects.toThrow('first error');
  });
});
