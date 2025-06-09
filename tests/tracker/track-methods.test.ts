import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { Invocation, InvocationTracker } from '../../src/tracker/index.ts';
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

  describe('typed operation tracker', () => {
    test('should work with a typed operation tracker', () => {
      type Operation = 'add' | 'subtract' | 'multiply';

      const calculator = {
        add: (a: number, b: number) => a + b,
        subtract: (a: number, b: number) => a - b,
        multiply: (a: number, b: number) => a * b,
      };

      const operationTracker = createInvocationTracker<Operation>();

      const operationInvocations: Invocation<Operation>[] = [];
      operationTracker.onInvoked((invocation) => {
        operationInvocations.push(invocation);
      });

      const trackedMethods = trackMethods(operationTracker, calculator, { methods: ['add', 'subtract'] });

      expect(trackedMethods).toEqual(new Set(['add', 'subtract']));

      expect(calculator.add(1, 2)).toBe(3);
      expect(calculator.subtract(3, 2)).toBe(1);
      expect(calculator.multiply(2, 3)).toBe(6);

      expect(operationInvocations).toHaveLength(4);
      expect(operationInvocations[0].key.operation).toBe('add');
      expect(operationInvocations[0].stage.type).toBe('started');
      expect(operationInvocations[1].key.operation).toBe('add');
      expect(operationInvocations[1].stage.type).toBe('completed');
      expect(operationInvocations[2].key.operation).toBe('subtract');
      expect(operationInvocations[2].stage.type).toBe('started');
      expect(operationInvocations[3].key.operation).toBe('subtract');
      expect(operationInvocations[3].stage.type).toBe('completed');
    });
  });

  describe('tagging system', () => {
    test('should apply tags to tracked method invocations', () => {
      const trackedInvocations: Invocation[] = [];
      const methodTags = { service: 'calculator', feature: 'math' };

      tracker.onInvoked((invocation) => {
        trackedInvocations.push(invocation);
      });

      const calculator = { add: (a: number, b: number) => a + b, subtract: (a: number, b: number) => a - b };

      trackMethods(tracker, calculator, { methods: ['add'], tags: methodTags });

      calculator.add(5, 3);

      expect(trackedInvocations).toHaveLength(2); // 1 started, 1 completed
      expect(trackedInvocations[0].tags).toEqual([
        { name: 'feature', value: 'math' },
        { name: 'service', value: 'calculator' },
      ]);
      expect(trackedInvocations[1].tags).toBe(trackedInvocations[0].tags);
    });

    test('should merge tracker-level and method-level tags', () => {
      const trackedInvocations: Invocation[] = [];
      const trackerTags = { environment: 'test' };
      const methodTags = [
        { name: 'service', value: 'calculator' },
        { name: 'operation', value: 'arithmetic' },
      ];
      const expectedTags = [
        { name: 'environment', value: 'test' },
        { name: 'operation', value: 'arithmetic' },
        { name: 'service', value: 'calculator' },
      ];

      const taggedTracker = createInvocationTracker({ tags: trackerTags });
      taggedTracker.onInvoked((invocation) => {
        trackedInvocations.push(invocation);
      });

      const calculator = { multiply: (a: number, b: number) => a * b };

      trackMethods(taggedTracker, calculator, { methods: ['multiply'], tags: methodTags });

      calculator.multiply(4, 5);

      expect(trackedInvocations).toHaveLength(2); // 1 started, 1 completed
      expect(trackedInvocations[0].tags).toEqual(expectedTags);
      expect(trackedInvocations[1].tags).toBe(trackedInvocations[0].tags);

      taggedTracker.close();
    });

    test('should apply tags to all tracked methods when tracking multiple methods', () => {
      const trackedInvocations: Invocation[] = [];
      const methodTags = [
        { name: 'module', value: 'utility' },
        { name: 'version', value: '1.0' },
      ];

      tracker.onInvoked((invocation) => {
        trackedInvocations.push(invocation);
      });

      const utilities = { double: (x: number) => x * 2, triple: (x: number) => x * 3, quadruple: (x: number) => x * 4 };

      trackMethods(tracker, utilities, { methods: ['double', 'triple'], tags: methodTags });

      utilities.double(2);
      utilities.triple(3);

      expect(trackedInvocations).toHaveLength(4); // 2 started, 2 completed

      // Check that all invocations have the tags
      trackedInvocations.forEach((invocation) => {
        expect(invocation.tags).toEqual(methodTags);
      });
    });

    test('should apply tags when tracking all methods without specifying method names', () => {
      const trackedInvocations: Invocation[] = [];
      const methodTags = { component: 'service', layer: 'business' };

      tracker.onInvoked((invocation) => {
        trackedInvocations.push(invocation);
      });

      const service = {
        process: (data: string) => `processed: ${data}`,
        validate: (input: string) => input.length > 0,
      };

      trackMethods(tracker, service, { tags: methodTags });

      service.process('test');
      service.validate('input');

      expect(trackedInvocations).toHaveLength(4); // 2 started, 2 completed

      // Check that all invocations have the tags
      trackedInvocations.forEach((invocation) => {
        expect(invocation.tags).toEqual([
          { name: 'component', value: 'service' },
          { name: 'layer', value: 'business' },
        ]);
      });
    });

    test('should apply tags to class instance methods', () => {
      const trackedInvocations: Invocation[] = [];
      const methodTags = { class: 'Counter', pattern: 'state' };

      tracker.onInvoked((invocation) => {
        trackedInvocations.push(invocation);
      });

      class Counter {
        private count = 0;

        public increment(): number {
          this.count += 1;
          return this.count;
        }

        public decrement(): number {
          this.count -= 1;
          return this.count;
        }
      }

      const counter = new Counter();
      trackMethods(tracker, counter, { methods: ['increment'], tags: methodTags });

      counter.increment();

      expect(trackedInvocations).toHaveLength(2); // 1 started, 1 completed
      expect(trackedInvocations[0].tags).toEqual([
        { name: 'class', value: 'Counter' },
        { name: 'pattern', value: 'state' },
      ]);
      expect(trackedInvocations[1].tags).toBe(trackedInvocations[0].tags);
    });
  });
});
