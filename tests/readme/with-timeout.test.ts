import { describe, expect, test } from 'vitest';

import { delay, withTimeout } from '../../src/utils/index.ts';

describe('emitnlog.utils.with-timeout', () => {
  test('should make sure that the readme example works', async () => {
    const fetchCompleted = (): Promise<boolean> => delay(50).then(() => true);

    const result1: boolean | undefined = await withTimeout(fetchCompleted(), 10);
    const result2: boolean | 'timeout' = await withTimeout(fetchCompleted(), 10, 'timeout');

    expect(result1).toBe(undefined);
    expect(result2).toBe('timeout');
  });
});
