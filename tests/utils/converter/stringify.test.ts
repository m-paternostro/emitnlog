import { describe, expect, test } from 'vitest';

import { stringify } from '../../../src/utils/index.ts';

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
    expect(stringify(date)).toBe('2023-01-01T12:00:00.000Z');
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

  test('should stringify Error objects without message with name', () => {
    const error = new Error();
    error.name = 'Error Name';
    expect(stringify(error)).toBe('Error Name');
  });

  test('should stringify Error objects without message and without name', () => {
    const error = new Error();
    error.name = '';
    expect(stringify(error)).toBe('[unknown error]');
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
    const deepObj = { level1: { level2: { level3: { level4: { level5: { level6: { level7: 'deep value' } } } } } } };

    // With very small depth
    const zeroResult = stringify(deepObj, { maxDepth: 0 });
    expect(zeroResult).toBe('[object Object]');

    // With very small depth
    const shallowResult = stringify(deepObj, { maxDepth: 1 });
    expect(shallowResult).toContain('level1');
    expect(shallowResult).not.toContain('level5');
    expect(shallowResult).not.toContain('deep value');

    // With custom higher depth - should include the full structure
    const deepResult = stringify(deepObj, { maxDepth: 10 });
    expect(deepResult).toContain('level7');
    expect(deepResult).toContain('deep value');

    // With custom higher depth - should include the full structure
    const allResult = stringify(deepObj, { maxDepth: -1 });
    expect(allResult).toContain('level7');
    expect(allResult).toContain('deep value');
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

    const noDepthMapResult = stringify(map, { maxDepth: 0 });
    expect(noDepthMapResult).toBe('Map(2)');

    const setResult = stringify(set);
    expect(setResult).toContain('1');
    expect(setResult).toContain('2');
    expect(setResult).toContain('3');

    const noDepthSetResult = stringify(set, { maxDepth: 0 });
    expect(noDepthSetResult).toBe('Set(3)');
  });

  test('should handle Map objects with circular references', () => {
    const circularMap = new Map();
    const obj: Record<string, unknown> = {};

    circularMap.set('key1', obj);
    obj['ref'] = obj;

    expect(stringify(circularMap)).toBe('{"key1":{"ref":"[Circular Reference]"}}');
    expect(stringify(circularMap, { maxDepth: -1 })).toBe('{"key1":{"ref":"[Circular Reference]"}}');
  });

  test('should handle empty objects', () => {
    const client = {
      clientInfo: { name: 'hello', version: '1.0.0' },
      clientCapabilities: { sampling: {}, elicitation: {}, roots: { listChanged: true } },
    };

    expect(stringify(client)).toBe(JSON.stringify(client));
  });

  test('should handle Set objects with circular references', () => {
    const circularSet = new Set();
    const setObj: Record<string, unknown> = {};
    circularSet.add(setObj);
    setObj['ref'] = setObj;

    expect(stringify(circularSet)).toBe('[{"ref":"[Circular Reference]"}]');
    expect(stringify(circularSet, { maxDepth: -1 })).toBe('[{"ref":"[Circular Reference]"}]');
  });

  test('should handle special objects like RegExp', () => {
    const regex = /test-pattern/gi;
    const result = stringify(regex);
    expect(result).toBe('/test-pattern/gi');
  });

  test('should handle Headers objects by converting them to plain records', () => {
    const headers = new Headers([
      ['Content-Type', 'application/json'],
      ['X-Test', 'value1'],
      ['X-Test', 'value2'],
    ]);

    expect(stringify(headers)).toBe('{"content-type":"application/json","x-test":"value1, value2"}');
  });

  test('should handle a global `Headers` is not defined', () => {
    const headers = new Headers([
      ['Content-Type', 'application/json'],
      ['X-Test', 'value1'],
      ['X-Test', 'value2'],
    ]);

    /* eslint-disable no-undef */
    const OriginalHeaders = globalThis.Headers;
    try {
      (globalThis.Headers as unknown) = undefined;
      expect(stringify(headers)).toBe('[object Headers]');
    } finally {
      globalThis.Headers = OriginalHeaders;
    }
    /* eslint-enable no-undef */
  });

  test('should handle a global `Headers` is not properly defined', () => {
    const headers = new Headers([
      ['Content-Type', 'application/json'],
      ['X-Test', 'value1'],
      ['X-Test', 'value2'],
    ]);

    /* eslint-disable no-undef */
    const OriginalHeaders = globalThis.Headers;
    try {
      (globalThis.Headers as unknown) = true;
      expect(stringify(headers)).toBe('[object Headers]');
    } finally {
      globalThis.Headers = OriginalHeaders;
    }
    /* eslint-enable no-undef */
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

  describe('array truncation', () => {
    test('should truncate large arrays with default limit (100 elements)', () => {
      const largeArray = Array.from({ length: 150 }, (_, i) => i);
      const result = stringify(largeArray);

      expect(result).toContain('0');
      expect(result).toContain('99'); // Last element before truncation
      expect(result).toContain('...(50)');
      expect(result).not.toContain('149'); // Should not contain last element
    });

    test('should not truncate arrays smaller than the default limit', () => {
      const smallArray = Array.from({ length: 50 }, (_, i) => i);
      const result = stringify(smallArray);

      expect(result).toContain('0');
      expect(result).toContain('49');
      expect(result).not.toContain('...');
    });

    test('should respect custom maxArrayElements option', () => {
      const array = Array.from({ length: 21 }, (_, i) => i);
      const result = stringify(array, { maxArrayElements: 5 });

      expect(result).toContain('0');
      expect(result).toContain('4');
      expect(result).toContain('...(16)');
      expect(result).not.toContain('5');
    });

    test('should respect custom maxArrayElements and excludeArrayTruncationElement options', () => {
      const array = Array.from({ length: 21 }, (_, i) => i);
      const result = stringify(array, { maxArrayElements: 5, excludeArrayTruncationElement: true });

      expect(result).toContain('0');
      expect(result).toContain('4');
      expect(result).not.toContain('...(16)');
      expect(result).not.toContain('5');
    });

    test('should respect 0 maxArrayElements option', () => {
      const array = Array.from({ length: 20 }, (_, i) => i);
      const result = stringify(array, { maxArrayElements: 0 });
      expect(result).toBe('["...(20)"]');
    });

    test('should disable array truncation when maxArrayElements is negative', () => {
      const largeArray = Array.from({ length: 200 }, (_, i) => i);
      const result = stringify(largeArray, { maxArrayElements: -1 });

      expect(result).toContain('0');
      expect(result).toContain('199');
      expect(result).not.toContain('...');
    });

    test('should truncate Set objects like arrays', () => {
      const largeSet = new Set(Array.from({ length: 150 }, (_, i) => i));
      const result = stringify(largeSet);

      expect(result).toContain('0');
      expect(result).toContain('99');
      expect(result).toContain('...(50)');
      expect(result).not.toContain('149');
    });
  });

  describe('object property truncation', () => {
    test('should truncate objects with many properties with default limit (50 properties)', () => {
      const largeObject = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`prop${i}`, i]));
      const result = stringify(largeObject);

      expect(result).toContain('prop0');
      expect(result).toContain('prop49');
      expect(result).toContain('...(30)');
      expect(result).not.toContain('prop50');
      expect(result).not.toContain('prop79');
    });

    test('should not truncate objects with fewer properties than the default limit', () => {
      const smallObject = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`prop${i}`, i]));
      const result = stringify(smallObject);

      expect(result).toContain('prop0');
      expect(result).toContain('prop19');
      expect(result).not.toContain('... and');
    });

    test('should respect custom maxProperties option', () => {
      const obj = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`prop${i}`, i]));
      const result = stringify(obj, { maxProperties: 3 });

      expect(result).toContain('prop0');
      expect(result).toContain('prop2');
      expect(result).toContain('...(12)');
      expect(result).not.toContain('prop3');
      expect(result).not.toContain('prop14');
    });

    test('should respect custom maxProperties and excludeObjectTruncationProperty options', () => {
      const obj = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`prop${i}`, i]));
      const result = stringify(obj, { maxProperties: 3, excludeObjectTruncationProperty: true });

      expect(result).toContain('prop0');
      expect(result).toContain('prop2');
      expect(result).not.toContain('...(12)');
      expect(result).not.toContain('prop3');
      expect(result).not.toContain('prop14');
    });

    test('should disable object truncation when maxProperties is negative', () => {
      const largeObject = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`prop${i}`, i]));
      const result = stringify(largeObject, { maxProperties: -1 });

      expect(result).toContain('prop0');
      expect(result).toContain('prop99');
      expect(result).not.toContain('... and');
    });
  });

  describe('throwing property', () => {
    const obj = {
      a: 1,
      b: 2,
      get c() {
        throw new Error('test');
      },
      d: 4,
      e: 5,
    } as const;

    test('should handle objects with throwing properties', () => {
      const result = stringify(obj);
      expect(result).toEqual('{"a":1,"b":2,"d":4,"e":5}');
    });

    test('should handle objects with throwing properties with truncate option', () => {
      expect(stringify(obj, { maxProperties: 3 })).toEqual('{"a":1,"b":2,"d":4,"...(1)":"..."}');
      expect(stringify(obj, { maxProperties: 4 })).toEqual('{"a":1,"b":2,"d":4,"e":5}');
    });

    test('should not include the throwing property with truncate option', () => {
      const result = stringify(obj, { maxProperties: 2 });
      expect(result).toEqual('{"a":1,"b":2,"...(3)":"..."}');
    });
  });

  describe('combined truncation scenarios', () => {
    test('should handle objects containing large arrays', () => {
      const obj = {
        smallProp: 'value',
        largeArray: Array.from({ length: 150 }, (_, i) => i),
        anotherProp: 'another value',
      };
      const result = stringify(obj);

      expect(result).toContain('smallProp');
      expect(result).toContain('largeArray');
      expect(result).toContain('...(50)'); // Array truncation
      expect(result).toContain('anotherProp');
    });

    test('should handle arrays containing large objects', () => {
      const largeObj = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`prop${i}`, i]));
      const array = ['item1', largeObj, 'item3'];
      const result = stringify(array);

      expect(result).toContain('item1');
      expect(result).toContain('item3');
      // The large object inside should be stringified but might not be truncated
      // since it's not the top-level object
    });
  });
});
