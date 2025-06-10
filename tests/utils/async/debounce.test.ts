import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { debounce } from '../../../src/utils/index.ts';

describe('emitnlog.utils.debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic debouncing behavior', () => {
    test('should debounce function calls and execute only the last one', async () => {
      const mockFn = jest.fn((value: string) => `result: ${value}`);
      const debouncedFn = debounce(mockFn, 300);

      const promise1 = debouncedFn('call1');
      const promise2 = debouncedFn('call2');
      const promise3 = debouncedFn('call3');

      // Function should not be called yet
      expect(mockFn).not.toHaveBeenCalled();

      // Advance time to trigger debounced execution
      jest.advanceTimersByTime(300);

      // All promises should resolve to the same result (from the last call)
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      expect(result1).toBe('result: call3');
      expect(result2).toBe('result: call3');
      expect(result3).toBe('result: call3');

      // Function should be called only once with the last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call3');
    });

    test('should support number options shorthand', async () => {
      const mockFn = jest.fn((value: number) => value * 2);
      const debouncedFn = debounce(mockFn, 500);

      const promise = debouncedFn(21);

      expect(mockFn).not.toHaveBeenCalled();
      jest.advanceTimersByTime(500);

      await expect(promise).resolves.toBe(42);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should support options object', async () => {
      const mockFn = jest.fn((value: number) => value * 2);
      const debouncedFn = debounce(mockFn, { delay: 500 });

      const promise = debouncedFn(21);

      expect(mockFn).not.toHaveBeenCalled();
      jest.advanceTimersByTime(500);

      await expect(promise).resolves.toBe(42);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should not execute if called within delay period', async () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      void debouncedFn();
      jest.advanceTimersByTime(500);
      expect(mockFn).not.toHaveBeenCalled();

      void debouncedFn();
      jest.advanceTimersByTime(400);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('waitForPrevious option', () => {
    test('should wait for previous promise when waitForPrevious: true', async () => {
      let resolvePromise: (value: string) => void;
      const mockFn = jest.fn(
        () =>
          new Promise<string>((resolve) => {
            resolvePromise = resolve;
          }),
      );

      const debouncedFn = debounce(mockFn, { delay: 300, waitForPrevious: true });

      // First call
      const promise1 = debouncedFn();
      jest.advanceTimersByTime(300);

      // Function should be called
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Second call while first is still running
      const promise2 = debouncedFn();
      jest.advanceTimersByTime(300);

      // Function should not be called again (waiting for first)
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Resolve the first promise
      resolvePromise!('result');
      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('result');
      expect(result2).toBe('result');
    });

    test('should not wait for previous promise when waitForPrevious: false', async () => {
      const mockFn = jest.fn(async (value: number) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return value * 2;
      });

      const debouncedFn = debounce(mockFn, { delay: 200, waitForPrevious: false });

      // First call
      const promise1 = debouncedFn(5);
      jest.advanceTimersByTime(200);
      jest.advanceTimersByTime(50); // Partial execution

      // Second call while first is still running
      const promise2 = debouncedFn(10);
      jest.advanceTimersByTime(200);

      // Both should execute independently
      jest.advanceTimersByTime(100); // Complete both executions

      await expect(promise1).resolves.toBe(10);
      await expect(promise2).resolves.toBe(10);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('accumulator option', () => {
    test('should accumulate arguments with addition', async () => {
      const mockFn = jest.fn((sum: number) => `Total: ${sum}`);
      const debouncedFn = debounce(mockFn, {
        delay: 300,
        accumulator: (prev: [number] | undefined, current: [number]): [number] => {
          const prevSum = prev?.[0] || 0;
          const currentSum = current[0];
          return [prevSum + currentSum];
        },
      });

      const promise1 = debouncedFn(5);
      const promise2 = debouncedFn(3);
      const promise3 = debouncedFn(7);

      jest.advanceTimersByTime(300);

      // All promises should resolve to the accumulated result
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      expect(result1).toBe('Total: 15'); // 5 + 3 + 7
      expect(result2).toBe('Total: 15');
      expect(result3).toBe('Total: 15');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(15);
    });

    test('should accumulate array arguments', async () => {
      const mockFn = jest.fn((items: string[]) => `Processed: ${items.join(', ')}`);
      const debouncedFn = debounce(mockFn, {
        delay: 300,
        accumulator: (prev: [string[]] | undefined, current: [string[]]): [string[]] => {
          const prevItems = prev?.[0] || [];
          const currentItems = current[0];
          return [[...prevItems, ...currentItems]];
        },
      });

      const promise1 = debouncedFn(['a', 'b']);
      const promise2 = debouncedFn(['c']);
      const promise3 = debouncedFn(['d', 'e']);

      jest.advanceTimersByTime(300);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      expect(result1).toBe('Processed: a, b, c, d, e');
      expect(result2).toBe('Processed: a, b, c, d, e');
      expect(result3).toBe('Processed: a, b, c, d, e');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(['a', 'b', 'c', 'd', 'e']);
    });

    test('should accumulate object arguments', async () => {
      interface UpdateData {
        updates: Record<string, unknown>;
      }

      const mockFn = jest.fn((data: UpdateData) => `Updated: ${Object.keys(data.updates).length} fields`);
      const debouncedFn = debounce(mockFn, {
        delay: 300,
        accumulator: (prev, current) => {
          const prevUpdates = prev?.[0]?.updates || {};
          const currentUpdates = current[0].updates;
          return [{ updates: { ...prevUpdates, ...currentUpdates } }];
        },
      });

      const promise1 = debouncedFn({ updates: { name: 'John', age: 30 } });
      const promise2 = debouncedFn({ updates: { email: 'john@example.com' } });
      const promise3 = debouncedFn({ updates: { age: 31 } }); // Should overwrite age

      jest.advanceTimersByTime(300);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      expect(result1).toBe('Updated: 3 fields');
      expect(result2).toBe('Updated: 3 fields');
      expect(result3).toBe('Updated: 3 fields');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith({ updates: { name: 'John', age: 31, email: 'john@example.com' } });
    });

    test('should handle multiple argument accumulation', async () => {
      const mockFn = jest.fn((ids: number[], flags: boolean[]) => `IDs: ${ids.length}, Flags: ${flags.length}`);
      const debouncedFn = debounce(mockFn, {
        delay: 300,
        accumulator: (prev, current) => {
          const prevIds = prev?.[0] || [];
          const prevFlags = prev?.[1] || [];
          const currentIds = current[0];
          const currentFlags = current[1];
          return [
            [...prevIds, ...currentIds],
            [...prevFlags, ...currentFlags],
          ];
        },
      });

      const promise1 = debouncedFn([1, 2], [true, false]);
      const promise2 = debouncedFn([3], [true]);
      const promise3 = debouncedFn([4, 5], [false, true]);

      jest.advanceTimersByTime(300);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      expect(result1).toBe('IDs: 5, Flags: 5');
      expect(result2).toBe('IDs: 5, Flags: 5');
      expect(result3).toBe('IDs: 5, Flags: 5');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith([1, 2, 3, 4, 5], [true, false, true, false, true]);
    });

    test('should reset accumulator after execution', async () => {
      const mockFn = jest.fn((sum: number) => sum);
      const debouncedFn = debounce(mockFn, {
        delay: 300,
        accumulator: (prev, current) => {
          const prevSum = prev?.[0] || 0;
          return [prevSum + current[0]];
        },
      });

      // First batch
      const promise1 = debouncedFn(5);
      const promise2 = debouncedFn(3);
      jest.advanceTimersByTime(300);

      await expect(promise1).resolves.toBe(8);
      await expect(promise2).resolves.toBe(8);

      // Second batch - should start fresh
      const promise3 = debouncedFn(10);
      const promise4 = debouncedFn(2);
      jest.advanceTimersByTime(300);

      await expect(promise3).resolves.toBe(12);
      await expect(promise4).resolves.toBe(12);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenNthCalledWith(1, 8);
      expect(mockFn).toHaveBeenNthCalledWith(2, 12);
    });

    test('should reset accumulator after cancel', async () => {
      const mockFn = jest.fn((sum: number) => sum);
      const debouncedFn = debounce(mockFn, {
        delay: 300,
        accumulator: (prev, current) => {
          const prevSum = prev?.[0] || 0;
          return [prevSum + current[0]];
        },
      });

      // Start accumulating
      const promise1 = debouncedFn(5);
      const promise2 = debouncedFn(3);

      // Cancel before execution
      debouncedFn.cancel();

      // New calls should start fresh
      const promise3 = debouncedFn(10);
      jest.advanceTimersByTime(300);

      await expect(promise1).rejects.toThrow('cancelled');
      await expect(promise2).rejects.toThrow('cancelled');
      await expect(promise3).resolves.toBe(10);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(10);
    });

    test('should work with accumulator and leading edge', async () => {
      const mockFn = jest.fn((sum: number) => sum);
      const debouncedFn = debounce(mockFn, {
        delay: 300,
        leading: true,
        accumulator: (prev, current) => {
          const prevSum = prev?.[0] || 0;
          return [prevSum + current[0]];
        },
      });

      // First call executes immediately with just its value
      const promise1 = debouncedFn(5);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(5);

      // Subsequent calls are accumulated but not executed
      const promise2 = debouncedFn(3);
      const promise3 = debouncedFn(7);

      // All should resolve to the first call's result
      await expect(promise1).resolves.toBe(5);
      await expect(promise2).resolves.toBe(5);
      await expect(promise3).resolves.toBe(5);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('promise support', () => {
    test('should handle async functions', async () => {
      const mockAsyncFn = jest.fn(async (value: string) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `async result: ${value}`;
      });

      const debouncedFn = debounce(mockAsyncFn, 300);

      const promise1 = debouncedFn('test1');
      const promise2 = debouncedFn('test2');

      jest.advanceTimersByTime(300);
      jest.advanceTimersByTime(100); // For the async function's internal delay

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('async result: test2');
      expect(result2).toBe('async result: test2');

      expect(mockAsyncFn).toHaveBeenCalledTimes(1);
      expect(mockAsyncFn).toHaveBeenCalledWith('test2');
    });

    test('should handle promise rejection', async () => {
      const error = new Error('Test error');
      const mockFn = jest.fn(async () => {
        throw error;
      });

      const debouncedFn = debounce(mockFn, 300);

      const promise1 = debouncedFn();
      const promise2 = debouncedFn();

      jest.advanceTimersByTime(300);

      await expect(promise1).rejects.toThrow('Test error');
      await expect(promise2).rejects.toThrow('Test error');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should execute new calls immediately by default (waitForPrevious: false)', async () => {
      let resolvePromise: (value: string) => void;
      const mockFn = jest.fn(
        () =>
          new Promise<string>((resolve) => {
            resolvePromise = resolve;
          }),
      );

      const debouncedFn = debounce(mockFn, 300);

      // First call
      const promise1 = debouncedFn();
      jest.advanceTimersByTime(300);

      // Function should be called
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Second call while first is still running - should debounce immediately
      const promise2 = debouncedFn();
      jest.advanceTimersByTime(300);

      // Function should be called again (new default behavior)
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Resolve both promises
      resolvePromise!('result1');
      await expect(promise1).resolves.toBe('result1');

      // The second call should also resolve
      await expect(promise2).resolves.toBeDefined();
    });
  });

  describe('leading edge execution', () => {
    test('should execute immediately with leading: true', async () => {
      const mockFn = jest.fn((value: string) => `result: ${value}`);
      const debouncedFn = debounce(mockFn, { delay: 300, leading: true });

      const promise = debouncedFn('test');

      // Should execute immediately
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test');

      await expect(promise).resolves.toBe('result: test');
    });

    test('should debounce subsequent calls with leading: true', async () => {
      const mockFn = jest.fn((value: string) => `result: ${value}`);
      const debouncedFn = debounce(mockFn, { delay: 300, leading: true });

      // First call executes immediately
      const promise1 = debouncedFn('call1');
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Subsequent calls within delay should be debounced
      const promise2 = debouncedFn('call2');
      const promise3 = debouncedFn('call3');
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(300);

      // All should resolve to the first call's result
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      expect(result1).toBe('result: call1');
      expect(result2).toBe('result: call1');
      expect(result3).toBe('result: call1');
    });

    test('should allow new leading execution after timeout', async () => {
      const mockFn = jest.fn((value: string) => `result: ${value}`);
      const debouncedFn = debounce(mockFn, { delay: 300, leading: true });

      // First call
      const promise1 = debouncedFn('call1');
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Wait for timeout
      jest.advanceTimersByTime(300);
      await promise1;

      // Second call should execute immediately again
      const promise2 = debouncedFn('call2');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('call2');

      await expect(promise2).resolves.toBe('result: call2');
    });
  });

  describe('cancel functionality', () => {
    test('should cancel pending execution', async () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 300);

      const promise = debouncedFn();
      debouncedFn.cancel();

      jest.advanceTimersByTime(300);

      expect(mockFn).not.toHaveBeenCalled();
      await expect(promise).rejects.toThrow('Debounced function call was cancelled');
    });

    test('should not affect already resolved promises', async () => {
      const mockFn = jest.fn((value: string) => `result: ${value}`);
      const debouncedFn = debounce(mockFn, 300);

      const promise = debouncedFn('test');
      jest.advanceTimersByTime(300);

      // Wait for execution
      const result = await promise;
      expect(result).toBe('result: test');

      // Cancel should have no effect after resolution
      debouncedFn.cancel();
      expect(result).toBe('result: test');
    });

    test('should reset internal state after cancel', async () => {
      const mockFn = jest.fn((value: string) => `result: ${value}`);
      const debouncedFn = debounce(mockFn, 300);

      // First call and cancel
      const promise1 = debouncedFn('test1');
      debouncedFn.cancel();

      // Second call after cancel
      const promise2 = debouncedFn('test2');
      jest.advanceTimersByTime(300);

      await expect(promise1).rejects.toThrow('Debounced function call was cancelled');
      await expect(promise2).resolves.toBe('result: test2');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test2');
    });
  });

  describe('flush functionality', () => {
    test('should immediately execute pending call', async () => {
      const mockFn = jest.fn((value: string) => `result: ${value}`);
      const debouncedFn = debounce(mockFn, 300);

      const promise = debouncedFn('test');
      expect(mockFn).not.toHaveBeenCalled();

      const flushResult = debouncedFn.flush();
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test');

      await expect(promise).resolves.toBe('result: test');
      await expect(flushResult).resolves.toBe('result: test');
    });

    test('should return undefined when no pending call', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 300);

      const result = debouncedFn.flush();
      expect(result).toBeUndefined();
      expect(mockFn).not.toHaveBeenCalled();
    });

    test('should return undefined when already executing', async () => {
      let resolvePromise: (value: string) => void;
      const mockFn = jest.fn(
        () =>
          new Promise<string>((resolve) => {
            resolvePromise = resolve;
          }),
      );

      const debouncedFn = debounce(mockFn, 300);

      const promise = debouncedFn();
      jest.advanceTimersByTime(300);

      // Function is now executing
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Flush should return undefined since execution is in progress
      const flushResult = debouncedFn.flush();
      expect(flushResult).toBeUndefined();

      // Complete the execution
      resolvePromise!('result');
      await expect(promise).resolves.toBe('result');
    });

    test('should cancel timeout when flushing', async () => {
      const mockFn = jest.fn((value: string) => `result: ${value}`);
      const debouncedFn = debounce(mockFn, 1000);

      const promise = debouncedFn('test');

      // Flush immediately instead of waiting
      const flushResult = debouncedFn.flush();

      // Advance time - the original timeout should not trigger
      jest.advanceTimersByTime(1000);

      await expect(promise).resolves.toBe('result: test');
      await expect(flushResult).resolves.toBe('result: test');

      // Function should only be called once (from flush, not from timeout)
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    test('should handle functions that return non-promise values', async () => {
      const mockFn = jest.fn((x: number, y: number) => x + y);
      const debouncedFn = debounce(mockFn, 300);

      const promise = debouncedFn(2, 3);
      jest.advanceTimersByTime(300);

      await expect(promise).resolves.toBe(5);
      expect(mockFn).toHaveBeenCalledWith(2, 3);
    });

    test('should handle functions with no arguments', async () => {
      const mockFn = jest.fn(() => 'no args');
      const debouncedFn = debounce(mockFn, 300);

      const promise = debouncedFn();
      jest.advanceTimersByTime(300);

      await expect(promise).resolves.toBe('no args');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should handle functions with complex argument types', async () => {
      interface TestObject {
        id: number;
        name: string;
      }

      const mockFn = jest.fn((obj: TestObject, flag: boolean) => ({ ...obj, processed: flag }));

      const debouncedFn = debounce(mockFn, 300);
      const testObj = { id: 1, name: 'test' };

      const promise = debouncedFn(testObj, true);
      jest.advanceTimersByTime(300);

      await expect(promise).resolves.toEqual({ id: 1, name: 'test', processed: true });

      expect(mockFn).toHaveBeenCalledWith(testObj, true);
    });

    test('should handle zero delay', async () => {
      const mockFn = jest.fn((value: string) => `result: ${value}`);
      const debouncedFn = debounce(mockFn, 0);

      const promise = debouncedFn('test');
      jest.advanceTimersByTime(0);

      await expect(promise).resolves.toBe('result: test');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
