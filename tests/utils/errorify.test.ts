import { describe, expect, test } from '@jest/globals';

import { errorify } from '../../src/utils/index.ts';

describe('emitnlog.utils.errorify', () => {
  test('should return the original error if the value is already an Error', () => {
    const originalError = new Error('Original error');
    const result = errorify(originalError);
    expect(result).toBe(originalError);
  });

  test('should convert a string into an Error object', () => {
    const result = errorify('An error occurred');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('An error occurred');
  });

  test('should convert a number into an Error object', () => {
    const result = errorify(404);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('404');
  });

  test('should convert an object into an Error object with the object as cause', () => {
    const obj = { code: 500, reason: 'Server error' };
    const result = errorify(obj);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('[object Object]');
    expect(result.cause).toBe(obj);
  });

  test('should handle null and undefined values', () => {
    const nullResult = errorify(null);
    expect(nullResult).toBeInstanceOf(Error);
    expect(nullResult.message).toBe('null');

    const undefinedResult = errorify(undefined);
    expect(undefinedResult).toBeInstanceOf(Error);
    expect(undefinedResult.message).toBe('undefined');
  });
});
