import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { createDeferredValue } from '../../../src/utils/index.ts';

describe('emitnlog.utils.deferred-value', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should resolve the promise with the correct value', async () => {
    const deferred = createDeferredValue<number>();
    setTimeout(() => deferred.resolve(42), 1000);
    jest.advanceTimersByTime(1000);
    await expect(deferred.promise).resolves.toBe(42);
  });

  test('should reject the promise with the correct reason', async () => {
    const deferred = createDeferredValue<number>();
    const error = new Error('test error');
    setTimeout(() => deferred.reject(error), 1000);
    jest.advanceTimersByTime(1000);
    await expect(deferred.promise).rejects.toThrow('test error');
  });
});
