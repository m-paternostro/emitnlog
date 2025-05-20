import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { InvocationTracker, PhasedInvocation } from '../../src/tracker/index.ts';
import { createBasicInvocationStack, createInvocationTracker } from '../../src/tracker/index.ts';
import { createTestLogger } from '../jester.setup.ts';

describe('emitnlog.tracker.cross-invocation', () => {
  let tracker: InvocationTracker;
  let logger: ReturnType<typeof createTestLogger>;

  beforeEach(() => {
    jest.useFakeTimers();
    logger = createTestLogger();
    // Create tracker with explicit stack to ensure consistent behavior
    const stack = createBasicInvocationStack({ logger });
    tracker = createInvocationTracker({ logger, stack });
  });

  afterEach(() => {
    tracker.close();
    jest.useRealTimers();
  });

  describe('parent-child relationships', () => {
    test('should track parent-child relationships for nested synchronous calls', () => {
      const events: PhasedInvocation<'started'>[] = [];
      tracker.onStarted((invocation) => events.push(invocation));

      const childFn = tracker.track('child', (x: number) => x * 2);
      const parentFn = tracker.track('parent', (x: number) => childFn(x) + 1);

      parentFn(5);

      expect(events).toHaveLength(2);

      // First event should be parent with no parentKey
      expect(events[0].key.operation).toBe('parent');
      expect(events[0].parentKey).toBeUndefined();

      // Second event should be child with parent as parentKey
      expect(events[1].key.operation).toBe('child');
      expect(events[1].parentKey).toBeDefined();
      expect(events[1].parentKey?.operation).toBe('parent');
      expect(events[1].parentKey?.id).toBe(events[0].key.id);
    });

    test('should track multi-level nesting (3+ levels deep)', () => {
      const events: PhasedInvocation<'started'>[] = [];
      tracker.onStarted((invocation) => events.push(invocation));

      const level3Fn = tracker.track('level3', (x: number) => x * 2);
      const level2Fn = tracker.track('level2', (x: number) => level3Fn(x) + 2);
      const level1Fn = tracker.track('level1', (x: number) => level2Fn(x) + 3);

      level1Fn(5);

      expect(events).toHaveLength(3);

      // Check operations in correct order
      expect(events[0].key.operation).toBe('level1');
      expect(events[1].key.operation).toBe('level2');
      expect(events[2].key.operation).toBe('level3');

      // Check parent-child relationships
      expect(events[0].parentKey).toBeUndefined(); // level1 has no parent
      expect(events[1].parentKey?.operation).toBe('level1'); // level2's parent is level1
      expect(events[2].parentKey?.operation).toBe('level2'); // level3's parent is level2
    });

    test('should track parent-child relationships across async boundaries', async () => {
      const startedEvents: PhasedInvocation<'started'>[] = [];
      const completedEvents: PhasedInvocation<'completed'>[] = [];

      tracker.onStarted((invocation) => startedEvents.push(invocation));
      tracker.onCompleted((invocation) => completedEvents.push(invocation));

      const childFn = tracker.track('asyncChild', async (x: number) => {
        await jest.advanceTimersByTimeAsync(100);
        return x * 2;
      });

      const parentFn = tracker.track('asyncParent', async (x: number) => {
        const result = await childFn(x);
        return result + 1;
      });

      const promise = parentFn(5);

      // Check that parent started first, then child
      expect(startedEvents).toHaveLength(2);
      expect(startedEvents[0].key.operation).toBe('asyncParent');
      expect(startedEvents[1].key.operation).toBe('asyncChild');
      expect(startedEvents[1].parentKey?.operation).toBe('asyncParent');

      await promise;

      // Check that child completed first, then parent
      expect(completedEvents).toHaveLength(2);
      expect(completedEvents[0].key.operation).toBe('asyncChild');
      expect(completedEvents[1].key.operation).toBe('asyncParent');
      expect(completedEvents[0].parentKey?.operation).toBe('asyncParent');
    });
  });

  describe('stack behavior', () => {
    test('should correctly pop the stack after function completion', () => {
      // We'll track starts and completions to verify the stack behavior
      const events: (PhasedInvocation<'started'> | PhasedInvocation<'completed'>)[] = [];

      tracker.onStarted((invocation) => events.push(invocation));
      tracker.onCompleted((invocation) => events.push(invocation));

      const fn1 = tracker.track('function1', (x: number) => x * 2);
      const fn2 = tracker.track('function2', (x: number) => x + 3);

      fn1(10);
      fn2(20);

      // Should be 4 events in this order: fn1 start, fn1 complete, fn2 start, fn2 complete
      expect(events).toHaveLength(4);
      expect(events[0].phase).toBe('started');
      expect(events[0].key.operation).toBe('function1');
      expect(events[1].phase).toBe('completed');
      expect(events[1].key.operation).toBe('function1');
      expect(events[2].phase).toBe('started');
      expect(events[2].key.operation).toBe('function2');
      expect(events[3].phase).toBe('completed');
      expect(events[3].key.operation).toBe('function2');

      // The second function should not have a parent, which proves the stack was popped properly
      expect(events[2].parentKey).toBeUndefined();
    });

    test('should correctly pop the stack after error is thrown', () => {
      const events: PhasedInvocation<'started'>[] = [];
      tracker.onStarted((invocation) => events.push(invocation));

      const errorFn = tracker.track('errorFn', () => {
        throw new Error('Test error');
      });

      const normalFn = tracker.track('normalFn', (x: number) => x * 2);

      // Call errorFn, which will throw
      try {
        errorFn();
      } catch (_error) {
        // Ignore the error
      }

      // Call normalFn after errorFn - it should not have a parent
      normalFn(5);

      expect(events).toHaveLength(2);
      expect(events[0].key.operation).toBe('errorFn');
      expect(events[1].key.operation).toBe('normalFn');
      expect(events[1].parentKey).toBeUndefined(); // Proves stack was properly popped after error
    });

    test('should maintain correct parent references in parallel async calls', async () => {
      const events: PhasedInvocation<'started'>[] = [];
      tracker.onStarted((invocation) => events.push(invocation));

      const childFn = tracker.track('child', async (x: number) => {
        await jest.advanceTimersByTimeAsync(100);
        return x * 2;
      });

      const parent1Fn = tracker.track('parent1', async (x: number) => (await childFn(x)) + 1);

      const parent2Fn = tracker.track('parent2', async (x: number) => (await childFn(x)) + 2);

      // Start two parallel executions
      const promise1 = parent1Fn(10);
      const promise2 = parent2Fn(20);

      // Wait for both to complete
      await Promise.all([promise1, promise2]);

      // We should have 4 started events: parent1, child(from parent1), parent2, child(from parent2)
      expect(events).toHaveLength(4);

      // Find the parent1 and its child
      const parent1Event = events.find((e) => e.key.operation === 'parent1');
      const childFromParent1 = events.find((e) => e.key.operation === 'child' && e.parentKey?.operation === 'parent1');

      // Find the parent2 and its child
      const parent2Event = events.find((e) => e.key.operation === 'parent2');
      const childFromParent2 = events.find((e) => e.key.operation === 'child' && e.parentKey?.operation === 'parent2');

      // Verify all events were found
      expect(parent1Event).toBeDefined();
      expect(childFromParent1).toBeDefined();
      expect(parent2Event).toBeDefined();
      expect(childFromParent2).toBeDefined();

      // Verify parent-child relationships
      expect(childFromParent1?.parentKey?.id).toBe(parent1Event?.key.id);
      expect(childFromParent2?.parentKey?.id).toBe(parent2Event?.key.id);
    });
  });

  describe('invocation stack reuse', () => {
    test('should share the stack between trackers', () => {
      // Create a second tracker that shares the stack with the first one
      const stack = createBasicInvocationStack({ logger });
      const tracker1 = createInvocationTracker({ stack, logger });
      const tracker2 = createInvocationTracker({ stack, logger });

      const events1: PhasedInvocation<'started'>[] = [];
      const events2: PhasedInvocation<'started'>[] = [];

      tracker1.onStarted((invocation) => events1.push(invocation));
      tracker2.onStarted((invocation) => events2.push(invocation));

      // Create nested functions that cross tracker boundaries
      const innerFn = tracker2.track('inner', (x: number) => x * 2);
      const outerFn = tracker1.track('outer', (x: number) => innerFn(x) + 1);

      outerFn(5);

      // Check that tracker1's function runs with no parent
      expect(events1).toHaveLength(1);
      expect(events1[0].key.operation).toBe('outer');
      expect(events1[0].parentKey).toBeUndefined();

      // Check that tracker2's function has a parent from tracker1
      expect(events2).toHaveLength(1);
      expect(events2[0].key.operation).toBe('inner');
      expect(events2[0].parentKey).toBeDefined();
      expect(events2[0].parentKey?.operation).toBe('outer');
      expect(events2[0].parentKey?.trackerId).toBe(tracker1.id);

      // Clean up
      tracker1.close();
      tracker2.close();
    });
  });

  describe('stack lifetime management', () => {
    test('should automatically close the stack when tracker is closed', () => {
      // Create a stack with spies on its methods
      const stack = createBasicInvocationStack({ logger });
      const closeSpy = jest.spyOn(stack, 'close');

      // Create a tracker with this stack
      const trackerWithStack = createInvocationTracker({ stack, logger });

      // Close the tracker
      trackerWithStack.close();

      // Verify that stack.close was called
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
