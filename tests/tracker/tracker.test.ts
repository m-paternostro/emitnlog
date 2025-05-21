import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { Invocation, InvocationTracker, PhasedInvocation, Tag } from '../../src/tracker/index.ts';
import { createInvocationTracker } from '../../src/tracker/index.ts';
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

  describe('events and notifications', () => {
    test('should notify listeners about started events', () => {
      const events: PhasedInvocation<'started'>[] = [];
      tracker.onStarted((invocation) => events.push(invocation));

      const fn = tracker.track('test', (a: number) => a * 2);
      fn(5);

      expect(events).toHaveLength(1);
      expect(events[0].phase).toBe('started');
      expect(events[0].key.operation).toBe('test');
      expect(events[0].args).toEqual([5]);
    });

    test('should notify listeners about completed events', () => {
      const events: PhasedInvocation<'completed'>[] = [];
      tracker.onCompleted((invocation) => events.push(invocation));

      const fn = tracker.track('test', (a: number) => a * 2);
      const result = fn(5);

      expect(result).toBe(10);
      expect(events).toHaveLength(1);
      expect(events[0].phase).toBe('completed');
      expect(events[0].key.operation).toBe('test');
      expect(events[0].duration).toBeDefined();
      expect(events[0].args).toEqual([5]);
      expect(events[0].result).toBe(10);
    });

    test('should notify listeners about errored events', () => {
      const events: PhasedInvocation<'errored'>[] = [];
      tracker.onErrored((invocation) => events.push(invocation));

      const error = new Error('Test error');
      const fn = tracker.track('test', () => {
        throw error;
      });

      expect(() => fn()).toThrow(error);

      expect(events).toHaveLength(1);
      expect(events[0].phase).toBe('errored');
      expect(events[0].key.operation).toBe('test');
      expect(events[0].duration).toBeDefined();
      expect(events[0].error).toBe(error);
    });

    test('should notify about all events with onInvoked', () => {
      const events: Invocation[] = [];
      tracker.onInvoked((invocation) => events.push(invocation));

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

      expect(events).toHaveLength(4); // 2 started, 1 completed, 1 errored
      expect(events.filter((e) => e.phase === 'started')).toHaveLength(2);
      expect(events.filter((e) => e.phase === 'completed')).toHaveLength(1);
      expect(events.filter((e) => e.phase === 'errored')).toHaveLength(1);
    });

    test('should handle async function completion notifications', async () => {
      const events: PhasedInvocation<'completed'>[] = [];
      tracker.onCompleted((invocation) => events.push(invocation));

      const fn = tracker.track('asyncTest', async (a: number) => {
        await jest.advanceTimersByTimeAsync(100);
        return a * 2;
      });

      const promise = fn(5);
      expect(events).toHaveLength(0); // Not completed yet

      await promise;

      expect(events).toHaveLength(1);
      expect(events[0].phase).toBe('completed');
      expect(events[0].key.operation).toBe('asyncTest');
      expect(events[0].promiseLike).toBe(true);
      expect(events[0].result).toBe(10);
    });

    test('should handle async function error notifications', async () => {
      const events: PhasedInvocation<'errored'>[] = [];
      tracker.onErrored((invocation) => events.push(invocation));

      const error = new Error('Async error');
      const fn = tracker.track('asyncTest', async () => {
        await jest.advanceTimersByTimeAsync(100);
        throw error;
      });

      const promise = fn();
      expect(events).toHaveLength(0); // Not errored yet

      await expect(promise).rejects.toThrow(error);

      expect(events).toHaveLength(1);
      expect(events[0].phase).toBe('errored');
      expect(events[0].key.operation).toBe('asyncTest');
      expect(events[0].promiseLike).toBe(true);
      expect(events[0].error).toBe(error);
    });

    test('should not notify after tracker is closed', () => {
      const events: PhasedInvocation<'started' | 'completed'>[] = [];
      tracker.onInvoked((invocation) => {
        if (invocation.phase === 'started' || invocation.phase === 'completed') {
          events.push(invocation);
        }
      });

      const fn = tracker.track('test', (a: number) => a * 2);
      fn(5);

      expect(events).toHaveLength(2); // 1 started, 1 completed

      tracker.close();
      events.length = 0;

      fn(10); // This should not trigger notifications

      expect(events).toHaveLength(0);
    });
  });

  describe('tagging system', () => {
    test('should apply tracker-level tags to all invocations', () => {
      const events: PhasedInvocation<'started' | 'completed'>[] = [];
      const trackerTags: Tag[] = [{ service: 'auth' }];

      const taggedTracker = createInvocationTracker({ tags: trackerTags });
      taggedTracker.onInvoked((invocation) => {
        if (invocation.phase === 'started' || invocation.phase === 'completed') {
          events.push(invocation);
        }
      });

      const fn = taggedTracker.track('test', (a: number) => a * 2);
      fn(5);

      expect(events).toHaveLength(2); // 1 started, 1 completed
      expect(events[0].tags).toEqual(trackerTags);
      expect(events[1].tags).toEqual(trackerTags);

      taggedTracker.close();
    });

    test('should apply operation-level tags', () => {
      const events: PhasedInvocation<'started' | 'completed'>[] = [];
      const operationTags: Tag[] = [{ feature: 'signup' }];

      tracker.onInvoked((invocation) => {
        if (invocation.phase === 'started' || invocation.phase === 'completed') {
          events.push(invocation);
        }
      });

      const fn = tracker.track('test', (a: number) => a * 2, { tags: operationTags });
      fn(5);

      expect(events).toHaveLength(2); // 1 started, 1 completed
      expect(events[0].tags).toEqual(operationTags);
      expect(events[1].tags).toEqual(operationTags);
    });

    test('should merge tracker-level and operation-level tags', () => {
      const events: PhasedInvocation<'started' | 'completed'>[] = [];
      const trackerTags: Tag[] = [{ service: 'auth' }];
      const operationTags: Tag[] = [{ feature: 'signup' }];
      const expectedTags = [...trackerTags, ...operationTags];

      const taggedTracker = createInvocationTracker({ tags: trackerTags });
      taggedTracker.onInvoked((invocation) => {
        if (invocation.phase === 'started' || invocation.phase === 'completed') {
          events.push(invocation);
        }
      });

      const fn = taggedTracker.track('test', (a: number) => a * 2, { tags: operationTags });
      fn(5);

      expect(events).toHaveLength(2); // 1 started, 1 completed
      expect(events[0].tags).toEqual(expectedTags);
      expect(events[1].tags).toEqual(expectedTags);

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
    test('should log tracker events with the provided logger', () => {
      const fn = tracker.track('test', (a: number) => a * 2);
      fn(5);

      expect(logger).toHaveLoggedWith('info', /starting with 1 args/);
      expect(logger).toHaveLoggedWith('info', /test/);
    });
  });

  describe('promise handling', () => {
    test('should correctly identify and handle promise-like return values', async () => {
      const events: PhasedInvocation<'completed'>[] = [];
      tracker.onCompleted((invocation) => events.push(invocation));

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

      expect(events).toHaveLength(1);
      expect(events[0].phase).toBe('completed');
      expect(events[0].promiseLike).toBe(true);
    });
  });
});
