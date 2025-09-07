import { CanceledError } from '../common/canceled-error.ts';
import type { DeferredValue } from './deferred-value.ts';
import { createDeferredValue } from './deferred-value.ts';
import type { Timeout } from './types.ts';

/**
 * Configuration options for the debounce utility.
 */
export type DebounceOptions<TArgs extends unknown[] = unknown[]> = {
  /**
   * The delay in milliseconds to wait before executing the debounced function.
   */
  readonly delay: number;

  /**
   * If true, the function will be called immediately, i.e., on the leading edge of the timeout. If false (default), the
   * function will be called on the trailing edge.
   *
   * @default false
   */
  readonly leading?: boolean;

  /**
   * If true, the debounce will wait for the previous promise to complete before processing new calls. If false
   * (default), new calls will be debounced immediately regardless of previous promise state.
   *
   * @default false
   */
  readonly waitForPrevious?: boolean;

  /**
   * Optional function to accumulate arguments from multiple calls before execution. If provided, instead of using only
   * the last call's arguments, this function will be called to combine the previous accumulated arguments with the new
   * call's arguments.
   *
   * **Important**: The accumulator function is called immediately on every debounced function call (it is NOT
   * debounced). Therefore, it should be fast and free of side effects to avoid performance issues.
   *
   * @param previousArgs - The previously accumulated arguments (undefined for the first call)
   * @param currentArgs - The arguments from the current call
   * @returns The accumulated arguments to use for the next call or final execution
   */
  readonly accumulator?: (previousArgs: TArgs | undefined, currentArgs: TArgs) => [...TArgs];
};

/**
 * A debounced function that returns a promise.
 *
 * @template TArgs - The arguments type of the original function.
 * @template TReturn - The return type of the original function.
 */
export type DebouncedFunction<TArgs extends unknown[], TReturn> = {
  /**
   * Calls the debounced function and returns a promise that resolves to the result. If the function is called multiple
   * times within the debounce delay, only the last call will be executed, and all callers will receive the same
   * result.
   */
  (...args: TArgs): Promise<TReturn>;

  /**
   * Cancels any pending debounced function calls.
   *
   * Behavior on cancel:
   *
   * - If there is a pending debounced call that has not executed yet, the promise returned to all callers of the
   *   debounced function will be rejected with a `emitnlog/utils/CanceledError`. This behavior can be changed by
   *   passing `true` as the value of `silent`.
   * - If there is no pending call, or the last call has already been executed and its promise settled, calling `cancel()`
   *   has no effect on already resolved/rejected promises.
   * - Internal timers and accumulated arguments are cleared, so subsequent calls start fresh.
   *
   * @param silent If true, pending promises are not rejected; they remain unsettled until callers time out or ignore
   *   them.
   */
  cancel(silent?: boolean): void;

  /**
   * Immediately executes the debounced function with the last provided arguments, bypassing the delay.
   */
  flush(): Promise<TReturn> | undefined;
};

/**
 * Creates a debounced version of a function that supports promises.
 *
 * When the debounced function is called multiple times within the delay period, only the last call will be executed.
 * All callers will receive the same result through their returned promises.
 *
 * By default, if the original function returns a promise, new calls will be debounced immediately without waiting. Set
 * `waitForPrevious: true` to wait for previous promises to complete.
 *
 * @example Basic usage
 *
 * ```ts
 * import { debounce } from 'emitnlog/utils';
 *
 * const search = debounce(async (query: string) => {
 *   const response = await fetch(`/api/search?q=${query}`);
 *   return response.json();
 * }, 300);
 *
 * // These calls will be debounced - only the last one will execute
 * const result1 = search('hello');
 * const result2 = search('hello world');
 * const result3 = search('hello world!');
 *
 * // All three promises will resolve to the same result
 * const [r1, r2, r3] = await Promise.all([result1, result2, result3]);
 * console.log(r1 === r2 && r2 === r3); // true
 * ```
 *
 * @example With leading edge execution
 *
 * ```ts
 * import { debounce } from 'emitnlog/utils';
 *
 * const saveData = debounce(
 *   async (data: any) => {
 *     return await api.save(data);
 *   },
 *   { delay: 1000, leading: true },
 * );
 *
 * // First call executes immediately, subsequent calls are debounced
 * await saveData({ id: 1 }); // Executes immediately
 * await saveData({ id: 2 }); // Debounced
 * ```
 *
 * @example With argument accumulation
 *
 * ```ts
 * import { debounce } from 'emitnlog/utils';
 *
 * const batchProcessor = debounce(
 *   async (ids: number[]) => {
 *     return await api.processBatch(ids);
 *   },
 *   {
 *     delay: 300,
 *     // Accumulator is fast and pure - just combines arrays
 *     accumulator: (prev, current) => {
 *       const prevIds = prev?.[0] || [];
 *       const currentIds = current[0];
 *       return [[...prevIds, ...currentIds]];
 *     },
 *   },
 * );
 *
 * batchProcessor([1, 2]);
 * batchProcessor([3, 4]);
 * batchProcessor([5]);
 * // Eventually processes [1, 2, 3, 4, 5] in a single call
 * ```
 *
 * @example With waiting for previous promises
 *
 * ```ts
 * import { debounce } from 'emitnlog/utils';
 *
 * const sequentialDebounce = debounce(
 *   async (value: string) => {
 *     await longRunningOperation(value);
 *     return `processed: ${value}`;
 *   },
 *   { delay: 300, waitForPrevious: true },
 * );
 *
 * sequentialDebounce('first'); // Starts long operation
 * sequentialDebounce('second'); // Waits for first to complete before debouncing
 * ```
 *
 * @template TArgs - The arguments type of the original function.
 * @template TReturn - The return type of the original function.
 * @param fn - The function to debounce.
 * @param options - The debounce delay in millisecond or the configuration options.
 * @returns A debounced version of the function that returns a promise.
 */
export const debounce = <TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn | Promise<TReturn>,
  options: number | DebounceOptions<TArgs>,
): DebouncedFunction<TArgs, TReturn> => {
  let timeoutId: Timeout | undefined;
  let lastArgs: TArgs | undefined;
  let pendingDeferred: DeferredValue<TReturn> | undefined;
  let isExecuting = false;
  let hasLeadingBeenCalled = false;

  options =
    typeof options === 'number'
      ? { delay: Math.max(0, Math.ceil(options)), waitForPrevious: false }
      : { waitForPrevious: false, ...options, delay: Math.max(0, Math.ceil(options.delay)) };

  const executeFunction = async (args: TArgs): Promise<TReturn> => {
    if (isExecuting && options.waitForPrevious) {
      // If we're already executing a promise and waitForPrevious is true,
      // wait for it to complete and return the result to all pending callers
      return pendingDeferred!.promise;
    }

    isExecuting = true;
    try {
      const result = await fn(...args);

      if (pendingDeferred) {
        pendingDeferred.resolve(result);
      }

      return result;
    } catch (error) {
      if (pendingDeferred) {
        pendingDeferred.reject(error);
      }
      throw error;
    } finally {
      isExecuting = false;
      pendingDeferred = undefined;
      lastArgs = undefined;
    }
  };

  const debouncedFunction = (...args: TArgs): Promise<TReturn> => {
    // Handle argument accumulation
    lastArgs = options.accumulator ? options.accumulator(lastArgs, args) : args;

    // If we already have a pending deferred, reuse it
    if (pendingDeferred) {
      return pendingDeferred.promise;
    }

    // Create a new deferred for this execution cycle
    pendingDeferred = createDeferredValue<TReturn>();

    // Handle leading edge execution
    if (options.leading && !hasLeadingBeenCalled && !isExecuting) {
      hasLeadingBeenCalled = true;
      // Execute immediately but still set up the timeout for trailing edge reset
      const promise = executeFunction(args);

      // Set up timeout to reset leading edge flag
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        hasLeadingBeenCalled = false;
        timeoutId = undefined;
      }, options.delay);

      return promise;
    }

    // Clear any existing timeout
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    const debouncedExecution = async () => {
      timeoutId = undefined;
      hasLeadingBeenCalled = false;

      if (lastArgs && !isExecuting) {
        try {
          await executeFunction(lastArgs);
        } catch {
          // Error is already handled by executeFunction through pendingDeferred.reject
          // No need to re-throw here as it would create an unhandled rejection
        }
      }
    };

    timeoutId = setTimeout(() => void debouncedExecution(), options.delay);

    return pendingDeferred.promise;
  };

  debouncedFunction.cancel = (silent?: boolean) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    hasLeadingBeenCalled = false;
    lastArgs = undefined;

    // If a call is pending (i.e., a promise was returned to callers but the debounced function
    // has not yet executed), reject that promise to signal cancellation to all awaiting callers,
    // unless `silent` is true.
    if (!silent && pendingDeferred && !pendingDeferred.settled) {
      pendingDeferred.reject(new CanceledError('The debounced function call was cancelled'));
      pendingDeferred = undefined;
    }
  };

  debouncedFunction.flush = (): Promise<TReturn> | undefined => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    if (lastArgs && !isExecuting) {
      hasLeadingBeenCalled = false;
      return executeFunction(lastArgs);
    }

    return undefined;
  };

  return debouncedFunction;
};
