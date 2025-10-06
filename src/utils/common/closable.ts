import { errorify } from '../converter/errorify.ts';
import { isNotNullable } from './is-not-nullable.ts';

/**
 * A resource that can be closed synchronously.
 *
 * Objects implementing this interface provide a `close()` method that performs cleanup operations immediately and
 * returns `void`. This is typically used for resources that don't require asynchronous operations during cleanup, such
 * as event listeners, timers, or simple state cleanup.
 *
 * The closable protocol expects that a single invocation of close is sufficient to perform all required operations
 * (such as releasing resources), and that additional calls to close are safe and have no effect.
 */
export type SyncClosable = { readonly close: () => void };

/**
 * A resource that can be closed asynchronously.
 *
 * Objects implementing this interface provide a `close()` method that returns a `Promise<void>`. This is typically used
 * for resources that require asynchronous operations during cleanup, such as file handles, database connections, or
 * network resources.
 *
 * The closable protocol expects that a single invocation of close is sufficient to perform all required operations
 * (such as releasing resources), and that additional calls to close are safe and have no effect.
 */
export type AsyncClosable = { readonly close: () => Promise<void> };

/**
 * A resource that can be closed either synchronously or asynchronously.
 *
 * This union type represents any closable resource, whether it requires synchronous or asynchronous cleanup. It's the
 * most flexible type for accepting closable resources when the cleanup method is not known in advance.
 *
 * The closable protocol expects that a single invocation of close is sufficient to perform all required operations
 * (such as releasing resources), and that additional calls to close are safe and have no effect.
 */
export type Closable = SyncClosable | AsyncClosable;

/**
 * Closes all provided closables, returning a promise if at least one closable is asynchronous.
 *
 * This function ensures all closables are properly closed even if some throw errors during cleanup. Errors from
 * individual closables are accumulated and then thrown (for synchronous closables) or rejected (for asynchronous
 * closables) after all cleanup operations complete.
 *
 * The return type is automatically inferred based on the types of the provided closables:
 *
 * - All synchronous closables → returns `void`
 * - Any asynchronous closables → returns `Promise<void>`
 * - Ambiguous types → defaults to `Promise<void>` for safety
 *
 * @example Synchronous closables
 *
 * ```ts
 * import { closeAll } from 'emitnlog/utils';
 *
 * const fileHandle = { close: () => console.log('File closed') };
 * const eventListener = { close: () => console.log('Listener removed') };
 *
 * closeAll(fileHandle, eventListener); // Returns void immediately
 * ```
 *
 * @example Mixed synchronous and asynchronous closables
 *
 * ```ts
 * import { closeAll } from 'emitnlog/utils';
 *
 * const timer = { close: () => clearInterval(timerId) };
 * const dbConnection = { close: async () => await db.disconnect() };
 *
 * await closeAll(timer, dbConnection); // Returns Promise<void>
 * ```
 *
 * @example Error handling with single error
 *
 * ```ts
 * import { closeAll } from 'emitnlog/utils';
 *
 * const failing = {
 *   close: () => {
 *     throw new Error('Cleanup failed');
 *   },
 * };
 * const working = { close: () => console.log('Cleaned up successfully') };
 *
 * try {
 *   closeAll(failing, working);
 * } catch (error) {
 *   console.log(error.message); // 'Cleanup failed'
 *   // Both closables were called, but error was thrown after all completed
 * }
 * ```
 *
 * @example Error handling with multiple errors
 *
 * ```ts
 * import { closeAll } from 'emitnlog/utils';
 *
 * const failing1 = {
 *   close: () => {
 *     throw new Error('First error');
 *   },
 * };
 * const failing2 = {
 *   close: async () => {
 *     throw new Error('Second error');
 *   },
 * };
 *
 * try {
 *   await closeAll(failing1, failing2);
 * } catch (error) {
 *   console.log(error.message); // 'Multiple errors occurred while closing closables'
 *   console.log(error.cause); // Array containing both Error objects
 * }
 * ```
 *
 * @param closables - The closables to close
 * @returns `void` if all closables are synchronous, `Promise<void>` if any are asynchronous
 * @throws {Error} Single error if only one closable fails, or aggregate error with `cause` array if multiple fail
 */
export const closeAll = <T extends readonly ClosableLike[]>(...closables: T): CloseAllResult<T> => {
  if (closables.length === 0) {
    return undefined as CloseAllResult<T>;
  }

  if (closables.length === 1) {
    return closables[0].close?.() as CloseAllResult<T>;
  }

  const errors: Error[] = [];

  const onError = (index: number) => (error: unknown) => {
    errors[index] = errorify(error);
  };

  const handleErrors = () => {
    const prunedErrors = errors.filter(isNotNullable);
    if (prunedErrors.length) {
      if (prunedErrors.length === 1) {
        throw prunedErrors[0];
      }

      throw new Error('Multiple errors occurred while closing closables', { cause: prunedErrors });
    }
  };

  const promises: Promise<void>[] = closables
    .map((closable, index): unknown => closable.close && asSafeClosable(closable as Closable, onError(index)).close())
    .filter((result): result is Promise<void> => result instanceof Promise);

  if (promises.length) {
    return Promise.all(promises).then(() => {
      handleErrors();
      return undefined;
    }) as CloseAllResult<T>;
  }

  handleErrors();
  return undefined as CloseAllResult<T>;
};

/**
 * Creates a single closable from one or more cleanup operations.
 *
 * This function serves two purposes:
 *
 * 1. It transforms individual cleanup functions (or objects with optional `close` methods) into proper closables.
 * 2. It groups multiple such inputs into a single closable that performs all cleanup steps in order.
 *
 * All inputs are normalized to proper closables and closed when the returned `close()` is invoked. Errors are
 * accumulated and handled using the same strategy as {@link closeAll}.
 *
 * The returned closable guarantees:
 *
 * - It can be called only once (subsequent calls are no-ops).
 * - The return type of `close()` matches the most flexible input:
 *
 *   - All synchronous inputs → returns `SyncClosable`
 *   - Any asynchronous input → returns `AsyncClosable`
 *   - Ambiguous → defaults to `AsyncClosable` for safety
 *
 * See {@link createCloser} for a more convenient way to create a "live closable" that can be used to accumulate
 * closables as they are instantiated.
 *
 * @example Creating a closable from a single function
 *
 * ```ts
 * import { asClosable } from 'emitnlog/utils';
 *
 * const timerCleanup = () => clearTimeout(timerId);
 * const closable = asClosable(timerCleanup);
 * closable.close(); // Runs the cleanup
 * ```
 *
 * @example Combining multiple cleanup steps
 *
 * ```ts
 * import { asClosable } from 'emitnlog/utils';
 *
 * const db = { close: async () => await disconnect() };
 * const file = { close: () => console.log('Closed file') };
 * const cleanup = () => console.log('Manual cleanup');
 *
 * const combined = asClosable(db, file, cleanup);
 * await combined.close(); // Closes all in order
 * ```
 *
 * @example Error handling
 *
 * ```ts
 * import { asClosable } from 'emitnlog/utils';
 *
 * const failing = () => {
 *   throw new Error('Cleanup failed');
 * };
 * const working = () => console.log('Success');
 *
 * const combined = asClosable(failing, working);
 *
 * try {
 *   combined.close();
 * } catch (error) {
 *   console.log(error.message); // 'Cleanup failed'
 *   // Both functions were called despite the error
 * }
 * ```
 *
 * @param input - One or more functions, closables, or partial closables to wrap
 * @returns A closable that closes all specified inputs when `close()` is called
 */
export const asClosable = <T extends readonly ClosableInput[]>(...input: T): ClosableAllResult<T> => {
  const closables: readonly Closable[] = input
    .map((i): Closable | undefined => {
      if (typeof i === 'function') {
        const closable: Closable = {
          close: () => {
            const value = i();
            if (value instanceof Promise) {
              return value.then(() => undefined);
            }
            return undefined;
          },
        };
        return closable;
      }

      if (!i.close) {
        return undefined;
      }

      return i as Closable;
    })
    .filter(isNotNullable);

  let closed = false;
  const combined: Closable = {
    close: () => {
      if (closed) {
        return undefined;
      }

      closed = true;
      return closeAll(...closables);
    },
  };
  return combined as ClosableAllResult<T>;
};

/**
 * Wraps a closable to prevent errors during `close()` from propagating.
 *
 * This utility creates a "safe" version of a closable that catches both synchronous throws and asynchronous rejections
 * during the close operation. If an error occurs, the optional `onError` callback is invoked with the error, and the
 * error is then swallowed (the close operation completes normally).
 *
 * This is particularly useful for ensuring cleanup operations never fail, which is important in scenarios like
 * application shutdown, resource cleanup chains, or when combining multiple closables with {@link asClosable} or
 * {@link closeAll}.
 *
 * @example Basic usage
 *
 * ```ts
 * import { asSafeClosable } from 'emitnlog/utils';
 *
 * const failing = {
 *   close: () => {
 *     throw new Error('Will be ignored');
 *   },
 * };
 * const silent = asSafeClosable(failing);
 * silent.close(); // Error is silently swallowed
 * ```
 *
 * @example Basic usage with error handling
 *
 * ```ts
 * import { createConsoleLogLogger } from 'emitnlog/logger';
 * import { asSafeClosable } from 'emitnlog/utils';
 *
 * const unreliableResource = {
 *   close: () => {
 *     throw new Error('Cleanup failed');
 *   },
 * };
 *
 * const logger = createConsoleLogLogger();
 * const safeResource = asSafeClosable(unreliableResource, (error) => {
 *   logger.w`Cleanup error: ${error}'`;
 * });
 *
 * safeResource.close(); // Never throws, logs warning instead
 * ```
 *
 * @example With asynchronous closables
 *
 * ```ts
 * import { asSafeClosable } from 'emitnlog/utils';
 *
 * const asyncResource = {
 *   close: async () => {
 *     throw new Error('Async cleanup failed');
 *   },
 * };
 *
 * const safeAsync = asSafeClosable(asyncResource, (error) => {
 *   console.error('Async cleanup error:', error);
 * });
 *
 * await safeAsync.close(); // Never rejects, logs error instead
 * ```
 *
 * @example Combining with asClosable for robust cleanup
 *
 * ```ts
 * import { asClosable, asSafeClosable } from 'emitnlog/utils';
 *
 * const robustCleanup = asClosable(
 *   asSafeClosable(riskyResource1),
 *   asSafeClosable(riskyResource2),
 *   asSafeClosable(riskyResource3),
 * );
 *
 * await robustCleanup.close(); // Guaranteed to not throw/reject
 * ```
 *
 * @param closable - The closable to wrap with error protection
 * @param onError - Optional callback invoked when an error occurs during close
 * @returns A closable that never throws or rejects, matching the sync/async nature of the input
 */
export const asSafeClosable = <C extends Closable>(
  closable: C,
  onError?: (error: unknown) => void,
): MayBeAsyncClose<C> extends true ? AsyncClosable : SyncClosable => {
  let closed = false;
  const safe = {
    close: () => {
      if (closed) {
        return undefined;
      }

      closed = true;
      try {
        const value = closable.close();
        if (value instanceof Promise) {
          return value.catch((error: unknown) => {
            try {
              onError?.(error);
            } catch {
              // ignore
            }
            return undefined;
          });
        }
      } catch (error) {
        try {
          onError?.(error);
        } catch {
          // ignore
        }
      }

      return undefined;
    },
  };

  return safe as MayBeAsyncClose<C> extends true ? AsyncClosable : SyncClosable;
};

/**
 * A container for managing multiple closables with a single `close()` call.
 *
 * This utility type represents a composite closable that accumulates other closables over time via the `add()` method.
 * Once `close()` is called, all registered closables are closed in reverse order, and the internal collection is
 * cleared. Any subsequent calls to `add()` are still allowed, but the already-closed closables will not be invoked
 * again.
 *
 * Useful for ensuring cleanup logic is always executed, even in complex control flows with multiple return points.
 */
export type Closer = Closable & { readonly add: <T extends ClosableLike>(closable: T) => T };

/**
 * Creates a `Closer` that manages a group of closables as a single unit, simplifying resource management— especially in
 * functions with multiple return points or error paths.
 *
 * The returned object allows you to register closables via `add()`, and later invoke `close()` once to clean them all
 * up. Closables are executed in reverse order of registration (last in, first closed), which is useful when resources
 * depend on each other.
 *
 * After `close()` is called:
 *
 * - The internal list is cleared, so previously added closables won't be called again.
 * - Further `add()` calls are still allowed and track newly added closables.
 * - A subsequent call to `close()` will only affect those new closables.
 *
 * Any errors thrown or rejected by the closables are accumulated and handled using the same strategy as
 * {@link closeAll}.
 *
 * The difference between this utility and {@link asClosable} is that the object returned here is a "live closable" that
 * can be used to accumulate closables as they are instantiated, whereas `asClosable` is meant to be a "one time"
 * utility that produces a single closable. Additionally, `closer.add(...)` preserves and returns the original
 * closable’s type, making it easier to work with typed resources.
 *
 * @example Basic usage
 *
 * ```ts
 * import type { Logger } from 'emitnlog/logger';
 * import { createConsoleByLevelLogger } from 'emitnlog/logger';
 * import { asClosable, createCloser } from 'emitnlog/utils';
 *
 * const closer = createCloser();
 *
 * if (enableDB) {
 *   const db: DB = closer.add(asClosable(() => disconnect()));
 *   ...
 * }
 *
 * const logger: Logger = closer.add(createConsoleByLevelLogger());
 *
 * // When needed...
 * await closer.close(); // Closes logger first, then db
 * ```
 *
 * @param input - Optional initial set of closables
 * @returns A `Closer` that can register and close closables as a group
 */
export const createCloser = (...input: readonly Closable[]): Closer => {
  const closables = new Set<ClosableLike>(input);

  const closer: Closer = {
    add: (closable) => {
      closables.add(closable);
      return closable;
    },

    close: () => {
      if (!closables.size) {
        return undefined;
      }

      const array = Array.from(closables).reverse();
      closables.clear();

      return closeAll(...array);
    },
  };

  return closer;
};

type PartialSyncClosable = Partial<SyncClosable>;
type PartialAsyncClosable = Partial<AsyncClosable>;
type ClosableLike = SyncClosable | PartialSyncClosable | AsyncClosable | PartialAsyncClosable;
type ClosableInput = SyncClosable | PartialSyncClosable | AsyncClosable | PartialAsyncClosable | (() => unknown);

// Helper type to check if a type has a close method that could return Promise<void>
type MayBeAsyncClose<T> = [Extract<CloseReturnType<T>, Promise<unknown>>] extends [never] ? false : true;

type CloseFn<T> = T extends { close?: infer C } ? C : never;
type CloseReturnType<T> = CloseFn<T> extends (...args: unknown[]) => infer R ? R : never;

type ElementsOf<T extends readonly unknown[]> = T[number];
type FunctionReturnsPromise<T> = Extract<ReturnType<Extract<T, (...args: unknown[]) => unknown>>, Promise<unknown>>;
type CloseReturnsPromise<T> = Extract<CloseReturnType<Extract<T, ClosableLike>>, Promise<unknown>>;

// Type helper to determine if any closable is async
type OneMayBeAsyncClose<T extends readonly ClosableInput[]> = [ElementsOf<T>] extends [never]
  ? false
  : [FunctionReturnsPromise<ElementsOf<T>>] extends [never]
    ? [CloseReturnsPromise<ElementsOf<T>>] extends [never]
      ? false
      : true
    : true;

// Conditional return type
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type CloseAllResult<T extends readonly ClosableInput[]> = OneMayBeAsyncClose<T> extends true ? Promise<void> : void;

type ClosableAllResult<T extends readonly ClosableInput[]> =
  OneMayBeAsyncClose<T> extends true ? AsyncClosable : SyncClosable;
