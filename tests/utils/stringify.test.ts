import { describe, expect, test } from '@jest/globals';

import { stringify } from '../../src/utils/index.ts';

describe('emitnlog.utils.stringify', () => {
  test('should stringify primitive values correctly', () => {
    expect(stringify(42)).toBe('42');
    expect(stringify('hello')).toBe('hello');
    expect(stringify(true)).toBe('true');
    expect(stringify(null)).toBe('null');
    expect(stringify(undefined)).toBe('undefined');
  });

  test('should stringify Date objects as ISO strings by default', () => {
    const date = new Date('2023-01-01T12:00:00Z');
    expect(stringify(date)).toBe('2023-01-01 12:00:00.000');
  });

  test('should stringify Date objects using locale format when useLocale is true', () => {
    const date = new Date('2023-01-01T12:00:00Z');

    // Get the expected locale string for comparison
    const expectedLocaleString = date.toLocaleString();

    expect(stringify(date, { useLocale: true })).toBe(expectedLocaleString);

    // Verify the result is different from ISO format
    expect(stringify(date, { useLocale: true })).not.toBe('2023-01-01 12:00:00.000');
  });

  test('should stringify Error objects using their message', () => {
    const error = new Error('Something went wrong');
    expect(stringify(error)).toBe('Something went wrong');
  });

  test('should handle Error objects with stack traces when includeStack is true', () => {
    const error = new Error('Test error');
    const result = stringify(error, { includeStack: true });
    expect(result).toContain('Test error');
    expect(result).toContain('Error:');
    expect(result).toContain('at ');
  });

  test('should stringify complex objects', () => {
    const obj = { a: 1, b: { c: 2 }, d: [3, 4] };
    const result = stringify(obj);
    expect(result).toContain('"a":1');
    expect(result).toContain('"b":');
    expect(result).toContain('"c":2');
    expect(result).toContain('"d":[3,4]');
  });

  test('should format complex objects with pretty option', () => {
    const obj = { a: 1, b: { c: 2 }, d: [3, 4] };
    const result = stringify(obj, { pretty: true });
    expect(result).toContain('"a": 1');
    expect(result).toContain('"b": {');
    expect(result).toContain('"c": 2');
    expect(result).toContain('"d": [');
    expect(result.split('\n').length).toBeGreaterThan(1);
  });

  test('should handle circular references', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;

    const result = stringify(obj);
    // Just verify it doesn't crash and contains the key names
    expect(result).toContain('a');
    expect(result).toContain('self');
    // The output format might vary depending on implementation details
  });

  test('should respect maxDepth option', () => {
    const deepObj = { level1: { level2: { level3: { level4: { level5: 'deep value' } } } } };

    // With very small depth
    const shallowResult = stringify(deepObj, { maxDepth: 1 });
    expect(shallowResult).toContain('level1');
    expect(shallowResult).not.toContain('level5');
    expect(shallowResult).not.toContain('deep value');

    // With custom higher depth - should include the full structure
    const deepResult = stringify(deepObj, { maxDepth: 10 });
    expect(deepResult).toContain('level5');
    expect(deepResult).toContain('deep value');
  });

  test('should handle special objects like Map and Set', () => {
    const map = new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);
    const set = new Set([1, 2, 3]);

    const mapResult = stringify(map);
    expect(mapResult).toContain('key1');
    expect(mapResult).toContain('value1');

    const setResult = stringify(set);
    expect(setResult).toContain('1');
    expect(setResult).toContain('2');
    expect(setResult).toContain('3');
  });

  test('should handle Map objects with circular references', () => {
    const map = new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);
    expect(stringify(map)).toBe('{"key1":"value1","key2":"value2"}');

    const circularMap = new Map();
    const obj: Record<string, unknown> = {};

    circularMap.set('circular', obj);
    obj['ref'] = obj;

    expect(stringify(circularMap)).toBe('Map(1)');
  });

  test('should handle Set objects with circular references', () => {
    const set = new Set(['value1', 'value2']);
    expect(stringify(set)).toBe('["value1","value2"]');

    const circularSet = new Set();
    const setObj: Record<string, unknown> = {};
    circularSet.add(setObj);
    setObj['ref'] = setObj;

    expect(stringify(circularSet)).toBe('Set(1)');
  });

  test('should handle special objects like RegExp', () => {
    const regex = /test-pattern/gi;
    const result = stringify(regex);
    expect(result).toBe('/test-pattern/gi');
  });

  test('should never throw errors on problematic values', () => {
    // Create problematic Date
    const invalidDate = new Date('invalid date');
    expect(() => stringify(invalidDate)).not.toThrow();
    expect(stringify(invalidDate)).toBe('[Invalid Date]');

    // Create an object with a problematic toJSON method
    const badToJSON = {
      toJSON: () => {
        throw new Error('toJSON error');
      },
    };
    expect(() => stringify(badToJSON)).not.toThrow();

    // Object with circular reference
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    circular.map = new Map([['self', circular]]);
    circular.set = new Set([circular]);
    expect(() => stringify(circular)).not.toThrow();

    // Object that throws on property access
    const throwOnAccess = {
      get prop() {
        throw new Error('Property access error');
      },
    };
    expect(() => stringify(throwOnAccess)).not.toThrow();

    // Object with non-serializable values
    const nonSerializable = {
      fn: () => 'function',
      symbol: Symbol('test'),
      bigint: BigInt(Number.MAX_SAFE_INTEGER) * BigInt(2),
      regex: /test/gi,
    };
    expect(() => stringify(nonSerializable)).not.toThrow();

    // Deeply nested object beyond maxDepth
    let deepObj: Record<string, unknown> = { level: 'max' };
    for (let i = 0; i < 100; i++) {
      deepObj = { child: deepObj, level: i };
    }
    expect(() => stringify(deepObj)).not.toThrow();
    expect(() => stringify(deepObj, { maxDepth: 1000 })).not.toThrow();

    // Really complex object combining multiple edge cases
    const complexEdgeCase = {
      circular: circular,
      throwOnAccess: throwOnAccess,
      deepObj: deepObj,
      badToJSON: badToJSON,
      invalidDate: invalidDate,
      nonSerializable: nonSerializable,
    };
    expect(() => stringify(complexEdgeCase)).not.toThrow();
    expect(() => stringify(complexEdgeCase, { pretty: true, maxDepth: 10 })).not.toThrow();
  });

  test('should handle options being invalid without throwing', () => {
    // @ts-expect-error - Testing with invalid options
    expect(() => stringify({}, 'invalid')).not.toThrow();
    // @ts-expect-error - Testing with null options
    expect(() => stringify({}, null)).not.toThrow();
    // @ts-expect-error - Testing with invalid maxDepth
    expect(() => stringify({}, { maxDepth: 'not a number' })).not.toThrow();
  });
});
