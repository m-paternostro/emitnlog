import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createDeferredValue, delay } from '../../../src/utils/index.ts';

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

      void delay(1000).then(() => deferred.resolve(42));
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
      void delay(1000).then(() => deferred.reject(error));
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).rejects.toThrow('test error');

      expect(deferred.settled).toBe(true);
      expect(deferred.resolved).toBe(false);
      expect(deferred.rejected).toBe(true);
    });

    test('should renew a settled deferred and allow new resolution', async () => {
      const deferred = createDeferredValue<number>();

      // First resolution
      void delay(1000).then(() => deferred.resolve(42));
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).resolves.toBe(42);
      expect(deferred.settled).toBe(true);

      // Renew
      const renewed = deferred.renew();
      expect(renewed).toBe(deferred); // Should return the same object
      expect(deferred.settled).toBe(false);
      expect(deferred.resolved).toBe(false);
      expect(deferred.rejected).toBe(false);

      // Second resolution
      void delay(1000).then(() => deferred.resolve(100));
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).resolves.toBe(100);
      expect(deferred.settled).toBe(true);
    });

    test('should renew a settled deferred and allow new rejection', async () => {
      const deferred = createDeferredValue<number>();

      // First resolution
      void delay(1000).then(() => deferred.resolve(42));
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).resolves.toBe(42);

      // Renew
      deferred.renew();
      expect(deferred.settled).toBe(false);

      // Now reject the renewed promise
      const error = new Error('renewed rejection');
      void delay(1000).then(() => deferred.reject(error));
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).rejects.toThrow('renewed rejection');
      expect(deferred.settled).toBe(true);
      expect(deferred.rejected).toBe(true);
    });

    test('should allow multiple renew cycles with different resolutions', async () => {
      const deferred = createDeferredValue<string>();

      // First cycle
      void delay(1000).then(() => deferred.resolve('first'));
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).resolves.toBe('first');

      // Second cycle
      deferred.renew();
      void delay(1000).then(() => deferred.reject(new Error('second')));
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).rejects.toThrow('second');

      // Third cycle
      deferred.renew();
      void delay(1000).then(() => deferred.resolve('third'));
      jest.advanceTimersByTime(1000);
      await expect(deferred.promise).resolves.toBe('third');
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

  describe('renew functionality', () => {
    test('should do nothing when renewing a non-settled deferred', async () => {
      const deferred = createDeferredValue<number>();
      const originalPromise = deferred.promise;

      // Renew shouldn't do anything since it's not settled
      deferred.renew();

      expect(deferred.promise).toBe(originalPromise); // Promise should be the same
      expect(deferred.settled).toBe(false);

      // Should still be resolvable
      deferred.resolve(42);
      await expect(deferred.promise).resolves.toBe(42);
    });

    test('should create a new promise when renewing a resolved deferred', async () => {
      const deferred = createDeferredValue<number>();

      // Resolve the deferred
      deferred.resolve(42);
      await deferred.promise;

      const originalPromise = deferred.promise;
      deferred.renew();

      expect(deferred.promise).not.toBe(originalPromise); // Should be a new promise
      expect(deferred.settled).toBe(false);
      expect(deferred.resolved).toBe(false);
    });

    test('should create a new promise when renewing a rejected deferred', async () => {
      const deferred = createDeferredValue<number>();

      // Reject the deferred
      deferred.reject(new Error('original rejection'));
      try {
        await deferred.promise;
      } catch {
        // Ignore the rejection, we just need to ensure the promise is settled
      }

      const originalPromise = deferred.promise;
      deferred.renew();

      expect(deferred.promise).not.toBe(originalPromise); // Should be a new promise
      expect(deferred.settled).toBe(false);
      expect(deferred.rejected).toBe(false);
    });

    test('should be chainable with resolution/rejection', async () => {
      const deferred = createDeferredValue<number>();

      deferred.resolve(1);
      await deferred.promise;

      // Chain renew and resolve
      deferred.renew().resolve(2);
      await expect(deferred.promise).resolves.toBe(2);

      // Chain renew and reject
      deferred.renew().reject(new Error('chained rejection'));
      await expect(deferred.promise).rejects.toThrow('chained rejection');
    });
  });
});
