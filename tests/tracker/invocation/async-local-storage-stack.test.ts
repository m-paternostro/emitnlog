import { describe, expect, test } from '@jest/globals';

import type { InvocationKey } from '../../../src/tracker/index.ts';
import { createAsyncLocalStorageInvocationStack } from '../../../src/tracker/node/index.ts';
import { createTestLogger } from '../../jester.setup.ts';

// Simple function to check if we're in Node.js
const isNodeEnvironment = () =>
  typeof process !== 'undefined' &&
  typeof process.versions !== 'undefined' &&
  typeof process.versions.node === 'string';

describe('emitnlog.tracker.async-local-storage-stack', () => {
  describe('basic operations', () => {
    test('should create a stack with expected methods', () => {
      // Skip if not in Node.js environment
      if (!isNodeEnvironment()) {
        return;
      }

      const logger = createTestLogger();
      const stack = createAsyncLocalStorageInvocationStack({ logger });

      expect(stack).toBeDefined();
      expect(typeof stack.push).toBe('function');
      expect(typeof stack.peek).toBe('function');
      expect(typeof stack.pop).toBe('function');
      expect(typeof stack.close).toBe('function');

      stack.close();
    });

    test('should push and peek values correctly', () => {
      // Skip if not in Node.js environment
      if (!isNodeEnvironment()) {
        return;
      }

      const logger = createTestLogger();
      const stack = createAsyncLocalStorageInvocationStack({ logger });

      // Initially, peek should return undefined
      expect(stack.peek()).toBeUndefined();

      // Create some test keys
      const key1: InvocationKey = { id: 'test.op1.1', trackerId: 'test', operation: 'op1', index: 1 };
      const key2: InvocationKey = { id: 'test.op2.2', trackerId: 'test', operation: 'op2', index: 2 };

      // Push first key
      stack.push(key1);
      expect(stack.peek()).toEqual(key1);

      // Push second key
      stack.push(key2);
      expect(stack.peek()).toEqual(key2);

      stack.close();
    });

    test('should pop values correctly', () => {
      // Skip if not in Node.js environment
      if (!isNodeEnvironment()) {
        return;
      }

      const logger = createTestLogger();
      const stack = createAsyncLocalStorageInvocationStack({ logger });

      // Create some test keys
      const key1: InvocationKey = { id: 'test.op1.1', trackerId: 'test', operation: 'op1', index: 1 };
      const key2: InvocationKey = { id: 'test.op2.2', trackerId: 'test', operation: 'op2', index: 2 };

      // Push keys
      stack.push(key1);
      stack.push(key2);

      // Pop should return the last pushed key
      expect(stack.pop()).toEqual(key2);
      expect(stack.peek()).toEqual(key1);

      // Pop again should return the remaining key
      expect(stack.pop()).toEqual(key1);
      expect(stack.peek()).toBeUndefined();

      // Pop when empty should return undefined
      expect(stack.pop()).toBeUndefined();

      stack.close();
    });

    test('should handle close correctly', () => {
      // Skip if not in Node.js environment
      if (!isNodeEnvironment()) {
        return;
      }

      const logger = createTestLogger();
      const stack = createAsyncLocalStorageInvocationStack({ logger });

      // Push a key
      const key: InvocationKey = { id: 'test.op1.1', trackerId: 'test', operation: 'op1', index: 1 };
      stack.push(key);
      expect(stack.peek()).toEqual(key);

      // Close the stack
      stack.close();

      // After close, peek should still work but return undefined since storage is disabled
      expect(stack.peek()).toBeUndefined();
    });
  });

  describe('concurrency behavior', () => {
    test('should maintain separate contexts for concurrent operations', async () => {
      // Skip if not in Node.js environment
      if (!isNodeEnvironment()) {
        return;
      }

      const logger = createTestLogger();
      const stack = createAsyncLocalStorageInvocationStack({ logger });

      // Create test keys for different async contexts
      const key1: InvocationKey = { id: 'test.op1.1', trackerId: 'test', operation: 'op1', index: 1 };
      const key2: InvocationKey = { id: 'test.op2.2', trackerId: 'test', operation: 'op2', index: 2 };

      // Function that runs in its own async context
      const runInContext = (key: InvocationKey, delayMs: number) =>
        new Promise<InvocationKey | undefined>((resolve) => {
          // Create a new context with the given key
          stack.push(key);

          // Use setTimeout to simulate async operation
          setTimeout(() => {
            // Peek should return this context's key, even after the delay
            const result = stack.peek();
            resolve(result);
          }, delayMs);
        });

      // Start two concurrent async operations with different delays
      const promise1 = runInContext(key1, 50);
      const promise2 = runInContext(key2, 20);

      // Wait for both promises and check results
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Each context should maintain its own key
      expect(result1).toEqual(key1);
      expect(result2).toEqual(key2);

      stack.close();
    });

    test('should preserve stack across chained promises', async () => {
      // Skip if not in Node.js environment
      if (!isNodeEnvironment()) {
        return;
      }

      const logger = createTestLogger();
      const stack = createAsyncLocalStorageInvocationStack({ logger });

      // Create test keys for nested operations
      const key1: InvocationKey = { id: 'test.op1.1', trackerId: 'test', operation: 'op1', index: 1 };
      const key2: InvocationKey = { id: 'test.op2.2', trackerId: 'test', operation: 'op2', index: 2 };
      const key3: InvocationKey = { id: 'test.op3.3', trackerId: 'test', operation: 'op3', index: 3 };

      // Define a function that returns a promise
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      // Start with key1
      stack.push(key1);

      const nestedAsyncOperations = async () => {
        // Should still have key1 at the beginning
        expect(stack.peek()).toEqual(key1);

        // Add key2 and start an async operation
        stack.push(key2);
        await delay(20);

        // Should still have key2 after the delay
        expect(stack.peek()).toEqual(key2);

        // Add key3 and start another async operation
        stack.push(key3);
        await delay(10);

        // Should have key3 after the nested delay
        expect(stack.peek()).toEqual(key3);

        // Pop should revert to key2
        stack.pop();
        expect(stack.peek()).toEqual(key2);

        // Another async operation
        await delay(5);

        // Should still have key2
        return stack.peek();
      };

      const result = await nestedAsyncOperations();

      // Should get key2 as the result
      expect(result).toEqual(key2);

      stack.close();
    });

    test('should handle parallel async operations with isolated contexts', async () => {
      // Skip if not in Node.js environment
      if (!isNodeEnvironment()) {
        return;
      }

      const logger = createTestLogger();
      const stack = createAsyncLocalStorageInvocationStack({ logger });

      // Create child keys for parallel operations
      const childKeys = Array.from({ length: 5 }, (_, i) => ({
        id: `test.child.${i + 1}`,
        trackerId: 'test',
        operation: 'child',
        index: i + 1,
      }));

      // Create a function that simulates an async operation with its own isolated context
      const asyncOperation = async (childKey: InvocationKey, delayMs: number) => {
        // Each operation gets its own fresh context
        stack.push(childKey);

        // Ensure the child key is at the top of the stack
        expect(stack.peek()).toEqual(childKey);

        // Simulate async work
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

        // The child key should still be at the top in this context
        const currentKey = stack.peek();

        // Return the key for verification
        return { childKey, currentKey };
      };

      // Start multiple parallel operations with different delays
      const promises = childKeys.map((key, index) => asyncOperation(key, 10 + index * 5));

      // Wait for all operations to complete
      const results = await Promise.all(promises);

      // Verify each result maintains its own isolated context
      results.forEach((result, index) => {
        expect(result.childKey).toEqual(childKeys[index]); // Child should match the input
        expect(result.currentKey).toEqual(childKeys[index]); // Current should still be the child key
      });

      // Clean up any possibly lingering context in the main thread
      while (stack.peek()) {
        stack.pop();
      }

      // After cleanup, the stack should be empty
      expect(stack.peek()).toBeUndefined();

      stack.close();
    });
  });
});
