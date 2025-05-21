import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { InvocationTracker } from '../../src/tracker/definition.ts';
import { createInvocationTracker, trackMethods } from '../../src/tracker/index.ts';
import { createTestLogger } from '../jester.setup.ts';

describe('trackMethods', () => {
  let tracker: InvocationTracker;
  let logger: ReturnType<typeof createTestLogger>;
  let invocations: { operation: string; args: unknown[] }[];

  beforeEach(() => {
    jest.useFakeTimers();
    logger = createTestLogger();
    tracker = createInvocationTracker({ logger });
    invocations = [];

    tracker.onStarted((invocation) => {
      invocations.push({
        operation: invocation.key.operation,
        args: Array.isArray(invocation.args) ? invocation.args : [],
      });
    });
  });

  afterEach(() => {
    tracker.close();
    jest.useRealTimers();
  });

  describe('with plain objects', () => {
    test('should track specified methods', () => {
      const obj = {
        add: (a: number, b: number) => a + b,
        subtract: (a: number, b: number) => a - b,
        multiply: (a: number, b: number) => a * b,
      };

      const trackedMethods = trackMethods(tracker, obj, { methods: ['add', 'subtract'] });

      expect(trackedMethods).toEqual(new Set(['add', 'subtract']));

      // Test that methods work and are tracked
      expect(obj.add(5, 3)).toBe(8);
      expect(obj.subtract(10, 4)).toBe(6);
      expect(obj.multiply(2, 3)).toBe(6);

      expect(invocations).toHaveLength(2);
      expect(invocations[0].operation).toBe('add');
      expect(invocations[0].args).toEqual([5, 3]);
      expect(invocations[1].operation).toBe('subtract');
      expect(invocations[1].args).toEqual([10, 4]);
    });

    test('should track all methods when no method names are specified', () => {
      const obj = { add: (a: number, b: number) => a + b, subtract: (a: number, b: number) => a - b };

      const trackedMethods = trackMethods(tracker, obj);

      expect(trackedMethods).toEqual(new Set(['add', 'subtract']));

      obj.add(2, 3);
      obj.subtract(5, 2);

      expect(invocations).toHaveLength(2);
    });

    test('should handle empty objects', () => {
      const emptyObj = {};
      const trackedMethods = trackMethods(tracker, emptyObj);
      expect(trackedMethods.size).toBe(0);
    });

    test('should skip non-function properties', () => {
      const obj = { method: () => 'result', property: 'value' };

      const trackedMethods = trackMethods(tracker, obj);
      expect(trackedMethods).toEqual(new Set(['method']));
    });

    test('should return empty set for null or undefined targets', () => {
      expect(trackMethods(tracker, null).size).toBe(0);
      expect(trackMethods(tracker, undefined).size).toBe(0);
    });
  });

  describe('with class instances', () => {
    class BaseClass {
      public baseMethod(): string {
        return 'base';
      }
    }

    class ChildClass extends BaseClass {
      public childMethod(): string {
        return 'child';
      }
    }

    class GrandchildClass extends ChildClass {
      public grandchildMethod(): string {
        return 'grandchild';
      }
    }

    test('should track methods on a class instance', () => {
      const instance = new BaseClass();
      const trackedMethods = trackMethods(tracker, instance);

      expect(trackedMethods).toEqual(new Set(['baseMethod']));

      expect(instance.baseMethod()).toBe('base');
      expect(invocations).toHaveLength(1);
      expect(invocations[0].operation).toBe('baseMethod');
    });

    test('should track methods and optionally the constructor on a class instance', () => {
      const instance = new BaseClass();
      const trackedMethods = trackMethods(tracker, instance, { includeConstructor: true });

      expect(trackedMethods).toEqual(new Set(['baseMethod', 'constructor']));

      expect(instance.baseMethod()).toBe('base');
      expect(invocations).toHaveLength(1);
      expect(invocations[0].operation).toBe('baseMethod');
    });

    test('should track inherited methods', () => {
      const child = new ChildClass();
      const trackedMethods = trackMethods(tracker, child);

      expect(trackedMethods).toEqual(new Set(['baseMethod', 'childMethod']));

      child.baseMethod();
      child.childMethod();

      expect(invocations).toHaveLength(2);
    });

    test('should track methods through multiple inheritance levels', () => {
      const grandchild = new GrandchildClass();
      const trackedMethods = trackMethods(tracker, grandchild);

      expect(trackedMethods).toEqual(new Set(['baseMethod', 'childMethod', 'grandchildMethod']));

      grandchild.baseMethod();
      grandchild.childMethod();
      grandchild.grandchildMethod();

      expect(invocations).toHaveLength(3);
    });

    test('should track only specified methods in a class hierarchy', () => {
      const grandchild = new GrandchildClass();
      const trackedMethods = trackMethods(tracker, grandchild, { methods: ['baseMethod', 'grandchildMethod'] });

      expect(trackedMethods).toEqual(new Set(['baseMethod', 'grandchildMethod']));

      grandchild.baseMethod();
      grandchild.childMethod();
      grandchild.grandchildMethod();

      expect(invocations).toHaveLength(2);
      expect(invocations[0].operation).toBe('baseMethod');
      expect(invocations[1].operation).toBe('grandchildMethod');
    });
  });

  describe('with built-in types', () => {
    test('should not track methods on Set objects', () => {
      const set = new Set([1, 2, 3]);
      const trackedMethods = trackMethods(tracker, set, { methods: ['add', 'delete'] });
      expect(trackedMethods.size).toBe(0);
    });

    test('should track methods on Set objects if the option is set', () => {
      const set = new Set([1, 2, 3]);
      const trackedMethods = trackMethods(tracker, set, { methods: ['add', 'delete'], trackBuiltIn: true });

      expect(trackedMethods).toEqual(new Set(['add', 'delete']));

      set.add(4);
      expect(set).toEqual(new Set([1, 2, 3, 4]));

      set.delete(1);
      expect(set).toEqual(new Set([2, 3, 4]));

      expect(invocations).toHaveLength(2);
      expect(invocations[0].operation).toBe('add');
      expect(invocations[1].operation).toBe('delete');
    });

    test('should track custom methods added to built-in types', () => {
      // Define an interface for our extended array
      interface ExtendedArray<T> extends Array<T> {
        sum(): number;
      }

      const extendedArray = [1, 2, 3] as ExtendedArray<number>;

      // Add a custom method to the array
      extendedArray.sum = function (): number {
        return this.reduce((acc: number, val: number) => acc + val, 0);
      };

      expect(trackMethods(tracker, extendedArray, { methods: ['sum'] }).size).toBe(0);

      const trackedMethods = trackMethods(tracker, extendedArray, { methods: ['sum'], trackBuiltIn: true });
      expect(trackedMethods).toEqual(new Set(['sum']));

      const sum = extendedArray.sum();

      expect(sum).toBe(6);
      expect(invocations).toHaveLength(1);
      expect(invocations[0].operation).toBe('sum');
    });

    test('should work with built-in types', () => {
      // Define an interface for our custom object
      interface CustomObject {
        customMethod(): string;
      }

      // Add a custom method to an object
      const obj: CustomObject = { customMethod: () => 'result' };
      trackMethods(tracker, obj);

      expect(obj.customMethod()).toBe('result');
      expect(invocations.length).toBe(1);
      expect(invocations[0].operation).toBe('customMethod');
    });
  });

  describe('functional behavior', () => {
    test('should preserve method context (this)', () => {
      class Counter {
        public count = 0;

        public increment(): number {
          this.count += 1;
          return this.count;
        }
      }

      const counter = new Counter();
      trackMethods(tracker, counter);

      expect(counter.increment()).toBe(1);
      expect(counter.increment()).toBe(2);
      expect(counter.count).toBe(2);
    });

    test('should handle methods that throw errors', () => {
      const obj = {
        throwError: () => {
          throw new Error('Test error');
        },
      };

      trackMethods(tracker, obj);

      expect(() => obj.throwError()).toThrow('Test error');
      expect(invocations).toHaveLength(1);
      expect(invocations[0].operation).toBe('throwError');
    });

    test('should work with async methods', async () => {
      const obj = {
        async fetchData(): Promise<string> {
          await jest.advanceTimersByTimeAsync(100);
          return 'data';
        },
      };

      trackMethods(tracker, obj);

      const promise = obj.fetchData();
      expect(invocations).toHaveLength(1);
      expect(invocations[0].operation).toBe('fetchData');

      const result = await promise;
      expect(result).toBe('data');
    });
  });
});
