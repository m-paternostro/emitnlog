import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { delay } from '../../../src/utils/index.ts';

describe('emitnlog.utils.delay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should resolve after the specified delay', async () => {
    let resolved = false;
    const promise = delay(1000).then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    jest.advanceTimersByTime(1000);
    await promise;
    expect(resolved).toBe(true);
  });

  test('should use 0 for negative delays', async () => {
    const promise = delay(-1000);
    jest.advanceTimersByTime(0);
    await expect(promise).resolves.toBeUndefined();
  });

  test('should ceil decimal delays', async () => {
    const promise = delay(1000.4);
    jest.advanceTimersByTime(1001);
    await expect(promise).resolves.toBeUndefined();
  });

  test('should not resolve before the full delay', async () => {
    let resolved = false;
    const promise = delay(1000).then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(500);
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(999);
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });
});
