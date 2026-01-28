import { describe, expect, test } from 'vitest';

import { stringifyDuration, stringifyElapsed, toNonNegativeInteger } from '../../../src/utils/index.ts';

describe('emitnlog.utils.stringifyDuration', () => {
  test('should format positive duration with default precision (2 decimals)', () => {
    expect(stringifyDuration(12.34567)).toBe('12.35ms');
    expect(stringifyDuration(100.12345)).toBe('100.1ms');
    expect(stringifyDuration(0.123)).toBe('0.12ms');
  });

  test('should format duration with custom precision', () => {
    expect(stringifyDuration(12.34567, { precision: 0 })).toBe('12ms');
    expect(stringifyDuration(12.34567, { precision: 1 })).toBe('12.3ms');
    expect(stringifyDuration(12.34567, { precision: 3 })).toBe('12.346ms');
    expect(stringifyDuration(12.34567, { precision: 4 })).toBe('12.3457ms');
  });

  test('should suppress unit suffix when requested', () => {
    expect(stringifyDuration(12.34567, { suppressUnit: true })).toBe('12.35');
    expect(stringifyDuration(100, { suppressUnit: true })).toBe('100.0');
    expect(stringifyDuration(0.5, { suppressUnit: true, precision: 1 })).toBe('0.5');
  });

  test('should handle zero duration', () => {
    expect(stringifyDuration(0)).toBe('0.00ms');
    expect(stringifyDuration(0, { precision: 0 })).toBe('0ms');
    expect(stringifyDuration(0, { suppressUnit: true })).toBe('0.00');
  });

  test('should convert negative durations to zero', () => {
    expect(stringifyDuration(-10)).toBe('0.00ms');
    expect(stringifyDuration(-100.5)).toBe('0.00ms');
    expect(stringifyDuration(-1, { precision: 3 })).toBe('0.000ms');
    expect(stringifyDuration(-1, { suppressUnit: true })).toBe('0.00');
  });

  test('should handle large durations', () => {
    expect(stringifyDuration(123456.789)).toBe('123457ms');
    expect(stringifyDuration(1000000, { precision: 0 })).toBe('1000000ms');
  });

  test('should handle very small positive durations', () => {
    expect(stringifyDuration(0.001, { precision: 3 })).toBe('0.001ms');
    expect(stringifyDuration(0.0001, { precision: 4 })).toBe('0.0001ms');
  });

  test('should handle combined options', () => {
    expect(stringifyDuration(123.456789, { precision: 1, suppressUnit: true })).toBe('123.5');
    expect(stringifyDuration(999.999, { precision: 0, suppressUnit: false })).toBe('1000ms');
  });

  test('should handle negative precision as zero', () => {
    expect(stringifyDuration(12.34567, { precision: -1 })).toBe('12ms');
    expect(stringifyDuration(12.34567, { precision: -10 })).toBe('12ms');
  });

  test('should handle fractional precision by flooring', () => {
    expect(stringifyDuration(12.34567, { precision: 2.9 })).toBe('12.35ms');
    expect(stringifyDuration(12.34567, { precision: 1.1 })).toBe('12.3ms');
  });

  test('should handle undefined options', () => {
    expect(stringifyDuration(12.34567, undefined)).toBe('12.35ms');
    expect(stringifyDuration(12.34567, {})).toBe('12.35ms');
  });
});

describe('emitnlog.utils.stringifyElapsed', () => {
  test('should calculate and format elapsed time', () => {
    const now = performance.now();
    const start = now - 98.1;

    const result = stringifyElapsed(start);

    // Result should be close to 100.5ms (allowing for small timing differences)
    expect(result).toMatch(/^98\.\d{2}ms$/);
  });

  test('should format elapsed time with custom precision', () => {
    const now = performance.now();
    const start = now - 100;

    const result = stringifyElapsed(start, { precision: 0 });
    expect(result).toMatch(/^10\dms$/);
  });

  test('should suppress unit suffix when requested', () => {
    const now = performance.now();
    const start = now - 50;

    const result = stringifyElapsed(start, { suppressUnit: true });
    expect(result).toMatch(/^\d+\.\d{2}$/);
    expect(result).not.toContain('ms');
  });

  test('should handle negative start times as zero elapsed', () => {
    const result = stringifyElapsed(-100);
    // Since start is negative, it becomes 0, so elapsed = now - 0 = now
    // We just verify it produces a valid format
    expect(result).toMatch(/^\d+\.\d{1}ms$/);
  });

  test('should handle start time in the future by treating as zero elapsed', () => {
    const futureStart = performance.now() + 1000;
    const result = stringifyElapsed(futureStart);

    // Future start gets clamped to 0, resulting in elapsed = now - 0
    expect(result).toMatch(/^\d+\.\d{2}ms$/);
  });

  test('should handle combined options', () => {
    const now = performance.now();
    const start = now - 200;

    const result = stringifyElapsed(start, { precision: 1, suppressUnit: true });
    expect(result).toMatch(/^\d+\.\d$/);
    expect(result).not.toContain('ms');
  });

  test('should produce consistent results for same start time', () => {
    const start = performance.now() - 50;

    const result1 = stringifyElapsed(start);
    const result2 = stringifyElapsed(start);

    // Both should have same format (though exact values may differ due to time passing)
    expect(result1).toMatch(/^\d+\.\d{2}ms$/);
    expect(result2).toMatch(/^\d+\.\d{2}ms$/);
  });
});

describe('emitnlog.utils.toNonNegativeInteger', () => {
  test('should return value when value is a positive integer', () => {
    expect(toNonNegativeInteger(0)).toBe(0);
    expect(toNonNegativeInteger(1)).toBe(1);
    expect(toNonNegativeInteger(10)).toBe(10);
    expect(toNonNegativeInteger(100)).toBe(100);
  });

  test('should floor positive decimal values', () => {
    expect(toNonNegativeInteger(1.1)).toBe(1);
    expect(toNonNegativeInteger(1.5)).toBe(1);
    expect(toNonNegativeInteger(1.9)).toBe(1);
    expect(toNonNegativeInteger(10.999)).toBe(10);
  });

  test('should convert negative values to zero', () => {
    expect(toNonNegativeInteger(-1)).toBe(0);
    expect(toNonNegativeInteger(-10)).toBe(0);
    expect(toNonNegativeInteger(-100.5)).toBe(0);
    expect(toNonNegativeInteger(-0.1)).toBe(0);
  });

  test('should return default value when value is undefined', () => {
    expect(toNonNegativeInteger(undefined)).toBe(0);
    expect(toNonNegativeInteger(undefined, 5)).toBe(5);
    expect(toNonNegativeInteger(undefined, 10)).toBe(10);
  });

  test('should floor positive decimal default values', () => {
    expect(toNonNegativeInteger(undefined, 5.9)).toBe(5);
    expect(toNonNegativeInteger(undefined, 10.1)).toBe(10);
    expect(toNonNegativeInteger(undefined, 1.5)).toBe(1);
  });

  test('should convert negative default values to zero', () => {
    expect(toNonNegativeInteger(undefined, -1)).toBe(0);
    expect(toNonNegativeInteger(undefined, -10)).toBe(0);
    expect(toNonNegativeInteger(undefined, -100.5)).toBe(0);
  });

  test('should prioritize value over default', () => {
    expect(toNonNegativeInteger(5, 10)).toBe(5);
    expect(toNonNegativeInteger(0, 10)).toBe(0);
    expect(toNonNegativeInteger(15, 5)).toBe(15);
  });

  test('should convert negative value to zero regardless of default', () => {
    expect(toNonNegativeInteger(-5, 10)).toBe(0);
    expect(toNonNegativeInteger(-10, 100)).toBe(0);
    expect(toNonNegativeInteger(-1, -5)).toBe(0);
  });

  test('should handle zero value', () => {
    expect(toNonNegativeInteger(0)).toBe(0);
    expect(toNonNegativeInteger(0, 10)).toBe(0);
    expect(toNonNegativeInteger(0, -10)).toBe(0);
  });

  test('should handle zero default', () => {
    expect(toNonNegativeInteger(undefined, 0)).toBe(0);
    expect(toNonNegativeInteger(5, 0)).toBe(5);
  });

  test('should handle large numbers', () => {
    expect(toNonNegativeInteger(1000000)).toBe(1000000);
    expect(toNonNegativeInteger(1000000.9)).toBe(1000000);
    expect(toNonNegativeInteger(undefined, 1000000)).toBe(1000000);
  });

  test('should match JSDoc examples', () => {
    expect(toNonNegativeInteger(undefined)).toBe(0);
    expect(toNonNegativeInteger(undefined, 2)).toBe(2);
    expect(toNonNegativeInteger(undefined, -2)).toBe(0);
    expect(toNonNegativeInteger(1.5)).toBe(1);
    expect(toNonNegativeInteger(-1, 2)).toBe(0);
    expect(toNonNegativeInteger(10)).toBe(10);
  });
});
