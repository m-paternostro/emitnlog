import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { Invocation, InvocationAtStage, InvocationTracker, Tag, Tags } from '../../src/tracker/index.ts';
import { createInvocationTracker, isAtStage } from '../../src/tracker/index.ts';
import { createTestLogger, flushFakeTimePromises } from '../jester.setup.ts';

describe('emitnlog.tracker', () => {
  let tracker: InvocationTracker;
  let logger: ReturnType<typeof createTestLogger>;

  beforeEach(() => {
    jest.useFakeTimers();
    logger = createTestLogger();
    tracker = createInvocationTracker({ logger });
  });

  afterEach(() => {
    tracker.close();
    jest.useRealTimers();
  });

  describe('basic functionality', () => {
    test('should create a tracker with a unique ID', () => {
      const tracker1 = createInvocationTracker();
      const tracker2 = createInvocationTracker();

      expect(tracker1.id).toBeDefined();
      expect(tracker2.id).toBeDefined();
      expect(tracker1.id).not.toBe(tracker2.id);

      tracker1.close();
      tracker2.close();
    });

    test('should wrap and unwrap functions transparently for sync functions', () => {
      const original = (a: number, b: number) => a + b;
      const wrapped = tracker.track('add', original);

      expect(wrapped(2, 3)).toBe(5);
      expect(wrapped(5, 7)).toBe(12);
    });

    test('should wrap and unwrap functions transparently for async functions', async () => {
      const original = async (a: number, b: number) => a + b;
      const wrapped = tracker.track('asyncAdd', original);

      await expect(wrapped(2, 3)).resolves.toBe(5);
      await expect(wrapped(5, 7)).resolves.toBe(12);
    });

    test('should not re-wrap already tracked functions', () => {
      const original = (a: number) => a * 2;
      const wrapped1 = tracker.track('double', original);
      const wrapped2 = tracker.track('double', wrapped1);

      // wrapped2 should be the same as wrapped1, not a double-wrapped function
      expect(wrapped2).toBe(wrapped1);
      expect(wrapped2(5)).toBe(10);
    });

    test('should identify if a function is tracked', () => {
      const original = (a: number) => a * 2;
      const otherTracker = createInvocationTracker();

      const wrapped = tracker.track('double', original);
      const otherWrapped = otherTracker.track('double', original);

      expect(tracker.isTracked(original)).toBe(false);
      expect(tracker.isTracked(wrapped)).toBe('this');
      expect(tracker.isTracked(otherWrapped)).toBe('other');

      otherTracker.close();
    });

    test('should continue to work with original function after tracker is closed', () => {
      const original = (a: number) => a * 2;
      const wrapped = tracker.track('double', original);

      expect(wrapped(5)).toBe(10);

      tracker.close();

      // Even after the tracker is closed, the original function should work
      expect(wrapped(5)).toBe(10);
    });
  });

  describe('invocations and notifications', () => {
    test('should notify listeners about started invocations', () => {
      const invocations: InvocationAtStage<'started'>[] = [];
      tracker.onStarted((invocation) => invocations.push(invocation));

      const fn = tracker.track('test', (a: number) => a * 2);
      fn(5);

      expect(invocations).toHaveLength(1);
      expect(invocations[0].stage.type).toBe('started');
      expect(invocations[0].key.operation).toBe('test');
      expect(invocations[0].args).toEqual([5]);
    });

    test('should notify listeners about completed invocations', () => {
      const invocations: InvocationAtStage<'completed'>[] = [];
      tracker.onCompleted((invocation) => invocations.push(invocation));

      const fn = tracker.track('test', (a: number) => a * 2);
      const result = fn(5);

      expect(result).toBe(10);
      expect(invocations).toHaveLength(1);
      expect(invocations[0].stage.type).toBe('completed');
      expect(invocations[0].key.operation).toBe('test');
      expect(invocations[0].stage.duration).toBeDefined();
      expect(invocations[0].args).toEqual([5]);
      expect(invocations[0].stage.result).toBe(10);
    });

    test('should notify listeners about errored invocations', () => {
      const invocations: InvocationAtStage<'errored'>[] = [];
      tracker.onErrored((invocation) => invocations.push(invocation));

      const error = new Error('Test error');
      const fn = tracker.track('test', () => {
        throw error;
      });

      expect(() => fn()).toThrow(error);

      expect(invocations).toHaveLength(1);
      expect(invocations[0].stage.type).toBe('errored');
      expect(invocations[0].key.operation).toBe('test');
      expect(invocations[0].stage.duration).toBeDefined();
      expect(invocations[0].stage.error).toBe(error);
    });

    test('should notify about all invocations with onInvoked', () => {
      const invocations: Invocation[] = [];
      tracker.onInvoked((invocation) => invocations.push(invocation));

      const successFn = tracker.track('success', (a: number) => a * 2);
      const errorFn = tracker.track('error', () => {
        throw new Error('Test error');
      });

      successFn(5);
      try {
        errorFn();
      } catch (_error) {
        // Ignore the error
      }

      expect(invocations).toHaveLength(4); // 2 started, 1 completed, 1 errored
      expect(invocations.filter((e) => e.stage.type === 'started')).toHaveLength(2);
      expect(invocations.filter((e) => e.stage.type === 'completed')).toHaveLength(1);
      expect(invocations.filter((e) => e.stage.type === 'errored')).toHaveLength(1);
    });

    test('should handle async function completion notifications', async () => {
      const invocations: InvocationAtStage<'completed'>[] = [];
      tracker.onCompleted((invocation) => invocations.push(invocation));

      const fn = tracker.track('asyncTest', async (a: number) => {
        await jest.advanceTimersByTimeAsync(100);
        return a * 2;
      });

      const promise = fn(5);
      expect(invocations).toHaveLength(0); // Not completed yet

      await promise;

      expect(invocations).toHaveLength(1);
      expect(invocations[0].stage.type).toBe('completed');
      expect(invocations[0].key.operation).toBe('asyncTest');
      expect(invocations[0].stage.promiseLike).toBe(true);
      expect(invocations[0].stage.result).toBe(10);
    });

    test('should handle async function error notifications', async () => {
      const invocations: InvocationAtStage<'errored'>[] = [];
      tracker.onErrored((invocation) => invocations.push(invocation));

      const error = new Error('Async error');
      const fn = tracker.track('asyncTest', async () => {
        await jest.advanceTimersByTimeAsync(100);
        throw error;
      });

      const promise = fn();
      expect(invocations).toHaveLength(0); // Not errored yet

      await expect(promise).rejects.toThrow(error);

      expect(invocations).toHaveLength(1);
      expect(invocations[0].stage.type).toBe('errored');
      expect(invocations[0].key.operation).toBe('asyncTest');
      expect(invocations[0].stage.promiseLike).toBe(true);
      expect(invocations[0].stage.error).toBe(error);
    });

    test('should not notify after tracker is closed', () => {
      const invocations: InvocationAtStage<'started' | 'completed'>[] = [];
      tracker.onInvoked((invocation) => {
        if (isAtStage(invocation, 'started') || isAtStage(invocation, 'completed')) {
          invocations.push(invocation);
        }
      });

      const fn = tracker.track('test', (a: number) => a * 2);
      fn(5);

      expect(invocations).toHaveLength(2); // 1 started, 1 completed

      tracker.close();
      invocations.length = 0;

      fn(10); // This should not trigger notifications

      expect(invocations).toHaveLength(0);
    });
  });

  describe('tagging system', () => {
    test('should apply tracker-level tag record to all invocations', () => {
      const invocations: InvocationAtStage<'started' | 'completed'>[] = [];
      const trackerTags = { service: 'auth' };

      const taggedTracker = createInvocationTracker({ tags: trackerTags });
      taggedTracker.onInvoked((invocation) => {
        if (isAtStage(invocation, 'started') || isAtStage(invocation, 'completed')) {
          invocations.push(invocation);
        }
      });

      const fn = taggedTracker.track('test', (a: number) => a * 2);
      fn(5);

      expect(invocations).toHaveLength(2); // 1 started, 1 completed
      expect(invocations[0].tags).toEqual([{ name: 'service', value: 'auth' }]);
      expect(invocations[1].tags).toBe(invocations[0].tags);

      taggedTracker.close();
    });

    test('should apply tracker-level tag array to all invocations', () => {
      const invocations: InvocationAtStage<'started' | 'completed'>[] = [];
      const trackerTags: Tag[] = [
        { name: 'service', value: 'auth' },
        { name: 'feature', value: 'signup' },
        { name: 'service', value: 'auth' },
      ];

      const taggedTracker = createInvocationTracker({ tags: trackerTags });
      taggedTracker.onInvoked((invocation) => {
        if (isAtStage(invocation, 'started') || isAtStage(invocation, 'completed')) {
          invocations.push(invocation);
        }
      });

      const fn = taggedTracker.track('test', (a: number) => a * 2);
      fn(5);

      expect(invocations).toHaveLength(2); // 1 started, 1 completed
      expect(invocations[0].tags).toEqual([
        { name: 'feature', value: 'signup' },
        { name: 'service', value: 'auth' },
      ]);
      expect(invocations[1].tags).toBe(invocations[0].tags);

      taggedTracker.close();
    });

    test('should apply operation-level tag record', () => {
      const invocations: InvocationAtStage<'started' | 'completed'>[] = [];
      const operationTags = { feature: 'signup' };

      tracker.onInvoked((invocation) => {
        if (isAtStage(invocation, 'started') || isAtStage(invocation, 'completed')) {
          invocations.push(invocation);
        }
      });

      const fn = tracker.track('test', (a: number) => a * 2, { tags: operationTags });
      fn(5);

      expect(invocations).toHaveLength(2); // 1 started, 1 completed
      expect(invocations[0].tags).toEqual([{ name: 'feature', value: 'signup' }]);
      expect(invocations[1].tags).toBe(invocations[0].tags);
    });

    test('should merge tracker-level and operation-level tags', () => {
      const invocations: InvocationAtStage<'started' | 'completed'>[] = [];
      const trackerTags: Tags = { service: 'auth', feature: 'signup' };
      const operationTags: Tags = [
        { name: 'feature', value: 'signup' },
        { name: 'feature', value: 'login' },
      ];

      const taggedTracker = createInvocationTracker({ tags: trackerTags });
      taggedTracker.onInvoked((invocation) => {
        if (isAtStage(invocation, 'started') || isAtStage(invocation, 'completed')) {
          invocations.push(invocation);
        }
      });

      const fn = taggedTracker.track('test', (a: number) => a * 2, { tags: operationTags });
      fn(5);

      expect(invocations).toHaveLength(2); // 1 started, 1 completed
      expect(invocations[0].tags).toEqual([
        { name: 'feature', value: 'login' },
        { name: 'feature', value: 'signup' },
        { name: 'service', value: 'auth' },
      ]);
      expect(invocations[1].tags).toBe(invocations[0].tags);

      taggedTracker.close();
    });

    test('should support changing the tags content', async () => {
      const invocations: InvocationAtStage<'started' | 'completed'>[] = [];
      const trackerTags: Record<string, string> = { service: 'auth1' };

      const taggedTracker = createInvocationTracker({ tags: trackerTags });
      taggedTracker.onInvoked((invocation) => {
        if (isAtStage(invocation, 'started') || isAtStage(invocation, 'completed')) {
          invocations.push(invocation);
        }
      });

      const invocationTags: { name: string; value: string }[] = [{ name: 'feature', value: 'signup' }];
      const fn = taggedTracker.track('test', async (a: number) => a * 2, { tags: invocationTags });

      await fn(0);
      const p1 = fn(1);

      trackerTags.service = 'auth2';
      trackerTags.env = 'production';

      await p1;
      await fn(2);

      invocationTags.push({ name: 'env', value: 'test' });

      await fn(3);

      expect(invocations).toHaveLength(8);

      expect(invocations[0].args).toEqual([0]);
      expect(invocations[0].tags).toEqual([
        { name: 'feature', value: 'signup' },
        { name: 'service', value: 'auth1' },
      ]);
      expect(invocations[1].args).toEqual([0]);
      expect(invocations[1].tags).toBe(invocations[0].tags);

      expect(invocations[2].args).toEqual([1]);
      expect(invocations[2].tags).toEqual([
        { name: 'feature', value: 'signup' },
        { name: 'service', value: 'auth1' },
      ]);
      expect(invocations[3].args).toEqual([1]);
      expect(invocations[3].tags).toBe(invocations[2].tags);

      expect(invocations[4].args).toEqual([2]);
      expect(invocations[4].tags).toEqual([
        { name: 'env', value: 'production' },
        { name: 'feature', value: 'signup' },
        { name: 'service', value: 'auth2' },
      ]);
      expect(invocations[5].args).toEqual([2]);
      expect(invocations[5].tags).toBe(invocations[4].tags);

      expect(invocations[6].args).toEqual([3]);
      expect(invocations[6].tags).toEqual([
        { name: 'env', value: 'production' },
        { name: 'env', value: 'test' },
        { name: 'feature', value: 'signup' },
        { name: 'service', value: 'auth2' },
      ]);

      taggedTracker.close();
    });
  });

  describe('typed operations', () => {
    test('should work with typed operations', () => {
      // Define allowed operation names at compile time
      type AllowedOperations = 'fetchUser' | 'saveUser';

      const typedTracker = createInvocationTracker<AllowedOperations>();

      const fetchUser = typedTracker.track('fetchUser', (id: string) => ({ id, name: 'Test User' }));
      const result = fetchUser('123');

      expect(result).toEqual({ id: '123', name: 'Test User' });

      typedTracker.close();
    });
  });

  describe('logging behavior', () => {
    test('should log tracker invocations with the provided logger', () => {
      const fn = tracker.track('test', (a: number) => a * 2);
      fn(5);

      expect(logger).toHaveLoggedWith('info', /starting with 1 args/);
      expect(logger).toHaveLoggedWith('info', /test/);
    });
  });

  describe('promise handling', () => {
    test('should correctly identify and handle promise-like return values', async () => {
      const invocations: InvocationAtStage<'completed'>[] = [];
      tracker.onCompleted((invocation) => invocations.push(invocation));

      // A thenable that's not a real Promise
      const thenable = {
        then(onFulfilled: (value: number) => void) {
          setTimeout(() => onFulfilled(42), 100);
          return this;
        },
      };

      const fn = tracker.track('thenable', () => thenable);
      fn();

      // Fast-forward time to allow the thenable to resolve
      jest.advanceTimersByTime(150);
      await flushFakeTimePromises();

      expect(invocations).toHaveLength(1);
      expect(invocations[0].stage.type).toBe('completed');
      expect(invocations[0].stage.promiseLike).toBe(true);
    });
  });
});
