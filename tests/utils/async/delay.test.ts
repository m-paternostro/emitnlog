import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { delay } from '../../../src/utils/index.ts';

describe('emitnlog.utils.delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should resolve after the specified delay', async () => {
    let resolved = false;
    const promise = delay(1000).then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    vi.advanceTimersByTime(1000);
    await promise;
    expect(resolved).toBe(true);
  });

  test('should use 0 for negative delays', async () => {
    const promise = delay(-1000);
    vi.advanceTimersByTime(0);
    await expect(promise).resolves.toBeUndefined();
  });

  test('should ceil decimal delays', async () => {
    const promise = delay(1000.4);
    vi.advanceTimersByTime(1001);
    await expect(promise).resolves.toBeUndefined();
  });

  test('should not resolve before the full delay', async () => {
    let resolved = false;
    const promise = delay(1000).then(() => {
      resolved = true;
    });

    vi.advanceTimersByTime(500);
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(999);
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });
});
