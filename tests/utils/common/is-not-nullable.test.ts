import { describe, expect, test } from 'vitest';

import { isNotNullable } from '../../../src/utils/index.ts';

describe('emitnlog.utils.isNotNullable', () => {
  test('should return false for null', () => {
    expect(isNotNullable(null)).toBe(false);
  });

  test('should return false for undefined', () => {
    expect(isNotNullable(undefined)).toBe(false);
  });

  test('should return true for false', () => {
    expect(isNotNullable(false)).toBe(true);
  });

  test('should return true for 0', () => {
    expect(isNotNullable(0)).toBe(true);
  });

  test('should return true for NaN', () => {
    expect(isNotNullable(NaN)).toBe(true);
  });

  test('should filter out null and undefined from an array', () => {
    const array = [null, undefined, false, 0, NaN];
    expect(array.filter(isNotNullable)).toEqual([false, 0, NaN]);
  });

  test('should filter out null and undefined and adjust the type', () => {
    const array: (string | undefined | null)[] = [null, undefined, 'a', undefined, 'b'];
    const result: string[] = array.filter(isNotNullable);
    expect(result).toEqual(['a', 'b']);
  });
});
