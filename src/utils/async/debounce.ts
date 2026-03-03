import { CanceledError } from '../common/canceled-error.ts';
import { toNonNegativeInteger } from '../common/duration.ts';
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
   * If true, calls that arrive while an execution is in flight are held in a separate queue and re-executed (with their
   * accumulated args) after the current execution completes, rather than sharing its result. If false (default),
   * in-flight callers share the current execution's result.
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
 * `waitForPrevious: true` to wait for previous promises to complete before debouncing the next round.
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
 * sequentialDebounce('second'); // Held back; executes after 'first' completes + delay
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
  let nextDeferred: DeferredValue<TReturn> | undefined;
  let isExecuting = false;
  let hasLeadingBeenCalled = false;

  options =
    typeof options === 'number'
      ? { delay: toNonNegativeInteger(options), waitForPrevious: false }
      : { waitForPrevious: false, ...options, delay: toNonNegativeInteger(options.delay) };

  const executeFunction = async (args: TArgs): Promise<TReturn> => {
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

      // If waitForPrevious is enabled and calls arrived while we were executing, promote the
      // next deferred and schedule another execution with the accumulated args.
      if (options.waitForPrevious && nextDeferred && lastArgs) {
        pendingDeferred = nextDeferred;
        nextDeferred = undefined;
        const argsForNext = lastArgs;
        lastArgs = undefined;
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          timeoutId = undefined;
          if (!isExecuting) {
            void executeFunction(argsForNext).catch(() => void 0);
          }
        }, options.delay);
      } else {
        lastArgs = undefined;
      }
    }
  };

  const debouncedFunction = (...args: TArgs): Promise<TReturn> => {
    // Handle argument accumulation
    lastArgs = options.accumulator ? options.accumulator(lastArgs, args) : args;

    // If waitForPrevious is enabled and an execution is in flight, hold this call in a separate
    // deferred that will be fulfilled by the next execution round after the current one finishes.
    if (options.waitForPrevious && isExecuting) {
      nextDeferred ??= createDeferredValue<TReturn>();
      return nextDeferred.promise;
    }

    // If we already have a pending deferred, reuse it
    if (pendingDeferred) {
      return pendingDeferred.promise;
    }

    // Create a new deferred for this execution cycle
    pendingDeferred = createDeferredValue<TReturn>();

    // Handle leading edge execution
    if (options.leading && !hasLeadingBeenCalled && !isExecuting) {
      hasLeadingBeenCalled = true;
      // Execute immediately with the (potentially accumulated) args
      const promise = executeFunction(lastArgs);

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

    if (!silent) {
      // If a call is pending (i.e., a promise was returned to callers but the debounced function
      // has not yet executed), reject that promise to signal cancellation to all awaiting callers.
      if (pendingDeferred && !pendingDeferred.settled) {
        pendingDeferred.reject(new CanceledError('The debounced function call was cancelled'));
      }
      if (nextDeferred && !nextDeferred.settled) {
        nextDeferred.reject(new CanceledError('The debounced function call was cancelled'));
      }
      pendingDeferred = undefined;
      nextDeferred = undefined;
    } else {
      // In silent mode pendingDeferred is kept so an in-flight execution can still resolve it,
      // but nextDeferred must be cleared: its args were just wiped, so it would hang forever.
      nextDeferred = undefined;
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
