import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { delay, withTimeout } from '../../../src/utils/index.ts';

describe('emitnlog.utils.with-timeout', () => {
  test('should handle promise rejection', async () => {
    const error = new Error('test error');
    const promise = withTimeout(Promise.reject(error), 1000);
    await expect(promise).rejects.toThrow(error);
  });

  test('should resolve with the promise value if within timeout', async () => {
    const promise = withTimeout(Promise.resolve('success'), 1000);
    await expect(promise).resolves.toBe('success');
  });

  describe('useFakeTimers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should resolve with undefined if timeout occurs without timeoutValue', async () => {
      const promise = withTimeout(new Promise(() => void 0), 1000);
      jest.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });

    test('should resolve with timeoutValue if timeout occurs with timeoutValue', async () => {
      const promise = withTimeout(new Promise(() => void 0), 1000, 'timeout');
      jest.advanceTimersByTime(1000);
      await expect(promise).resolves.toBe('timeout');
    });

    test('should preserve literal types for timeoutValue', async () => {
      const promise = withTimeout(new Promise<number>(() => void 0), 1000, 42);
      jest.advanceTimersByTime(1000);
      await expect(promise).resolves.toBe(42);
    });

    test('should resolve with promise value even if it takes almost the full timeout', async () => {
      const delayedPromise = delay(999).then(() => 'success');
      const promise = withTimeout(delayedPromise, 1000);
      jest.advanceTimersByTime(999);
      await expect(promise).resolves.toBe('success');
    });
  });
});
