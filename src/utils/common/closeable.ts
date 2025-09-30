import { errorify } from '../converter/errorify.ts';
import { isNotNullable } from './is-not-nullable';

/**
 * A resource that can be closed synchronously.
 *
 * Objects implementing this interface provide a `close()` method that performs cleanup operations immediately and
 * returns `void`. This is typically used for resources that don't require asynchronous operations during cleanup, such
 * as event listeners, timers, or simple state cleanup.
 *
 * The closeable protocol expects that a single invocation of close is sufficient to perform all required operations
 * (such as releasing resources), and that additional calls to close are safe and have no effect.
 */
export type SyncCloseable = { readonly close: () => void };

/**
 * A resource that can be closed asynchronously.
 *
 * Objects implementing this interface provide a `close()` method that returns a `Promise<void>`. This is typically used
 * for resources that require asynchronous operations during cleanup, such as file handles, database connections, or
 * network resources.
 *
 * The closeable protocol expects that a single invocation of close is sufficient to perform all required operations
 * (such as releasing resources), and that additional calls to close are safe and have no effect.
 */
export type AsyncCloseable = { readonly close: () => Promise<void> };

/**
 * A resource that can be closed either synchronously or asynchronously.
 *
 * This union type represents any closeable resource, whether it requires synchronous or asynchronous cleanup. It's the
 * most flexible type for accepting closeable resources when the cleanup method is not known in advance.
 *
 * The closeable protocol expects that a single invocation of close is sufficient to perform all required operations
 * (such as releasing resources), and that additional calls to close are safe and have no effect.
 */
export type Closeable = SyncCloseable | AsyncCloseable;

/**
 * Closes all provided closeables, returning a promise if at least one closeable is asynchronous.
 *
 * This function ensures all closeables are properly closed even if some throw errors during cleanup. Errors from
 * individual closeables are accumulated and then thrown (for synchronous closeables) or rejected (for asynchronous
 * closeables) after all cleanup operations complete.
 *
 * The return type is automatically inferred based on the types of the provided closeables:
 *
 * - All synchronous closeables → returns `void`
 * - Any asynchronous closeables → returns `Promise<void>`
 * - Ambiguous types → defaults to `Promise<void>` for safety
 *
 * @example Synchronous closeables
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
 * @example Mixed synchronous and asynchronous closeables
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
 *   // Both closeables were called, but error was thrown after all completed
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
 *   console.log(error.message); // 'Multiple errors occurred while closing closeables'
 *   console.log(error.cause); // Array containing both Error objects
 * }
 * ```
 *
 * @param closeables - The closeables to close
 * @returns `void` if all closeables are synchronous, `Promise<void>` if any are asynchronous
 * @throws {Error} Single error if only one closeable fails, or aggregate error with `cause` array if multiple fail
 */
export const closeAll = <T extends readonly Closeable[]>(...closeables: T): CloseAllResult<T> => {
  if (closeables.length === 0) {
    return undefined as CloseAllResult<T>;
  }

  if (closeables.length === 1) {
    return closeables[0].close() as CloseAllResult<T>;
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

      throw new Error('Multiple errors occurred while closing closeables', { cause: prunedErrors });
    }
  };

  const promises: Promise<void>[] = closeables
    .map((closeable, index): unknown => asSafeCloseable(closeable, onError(index)).close())
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
 * Creates a single closeable from one or more cleanup operations.
 *
 * This function serves two purposes:
 *
 * 1. It transforms individual cleanup functions (or objects with optional `close` methods) into proper closeables.
 * 2. It groups multiple such inputs into a single closeable that performs all cleanup steps in order.
 *
 * All inputs are normalized to proper closeables and closed when the returned `close()` is invoked. Errors are
 * accumulated and handled using the same strategy as {@link closeAll}.
 *
 * The returned closeable guarantees:
 *
 * - It can be called only once (subsequent calls are no-ops).
 * - The return type of `close()` matches the most flexible input:
 *
 *   - All synchronous inputs → returns `SyncCloseable`
 *   - Any asynchronous input → returns `AsyncCloseable`
 *   - Ambiguous → defaults to `AsyncCloseable` for safety
 *
 * See {@link createCloser} for a more convenient way to create a "live closeable" that can be used to accumulate
 * closeables as they are instantiated.
 *
 * @example Creating a closeable from a single function
 *
 * ```ts
 * import { asCloseable } from 'emitnlog/utils';
 *
 * const timerCleanup = () => clearTimeout(timerId);
 * const closeable = asCloseable(timerCleanup);
 * closeable.close(); // Runs the cleanup
 * ```
 *
 * @example Combining multiple cleanup steps
 *
 * ```ts
 * import { asCloseable } from 'emitnlog/utils';
 *
 * const db = { close: async () => await disconnect() };
 * const file = { close: () => console.log('Closed file') };
 * const cleanup = () => console.log('Manual cleanup');
 *
 * const combined = asCloseable(db, file, cleanup);
 * await combined.close(); // Closes all in order
 * ```
 *
 * @example Error handling
 *
 * ```ts
 * import { asCloseable } from 'emitnlog/utils';
 *
 * const failing = () => {
 *   throw new Error('Cleanup failed');
 * };
 * const working = () => console.log('Success');
 *
 * const combined = asCloseable(failing, working);
 *
 * try {
 *   combined.close();
 * } catch (error) {
 *   console.log(error.message); // 'Cleanup failed'
 *   // Both functions were called despite the error
 * }
 * ```
 *
 * @param input - One or more functions, closeables, or partial closeables to wrap
 * @returns A closeable that closes all specified inputs when `close()` is called
 */
export const asCloseable = <T extends readonly CloseableLike[]>(...input: T): CloseableAllResult<T> => {
  const closeables: readonly Closeable[] = input
    .map((i): Closeable | undefined => {
      if (typeof i === 'function') {
        const closeable: Closeable = {
          close: () => {
            const value = i();
            if (value instanceof Promise) {
              return value.then(() => undefined);
            }
            return undefined;
          },
        };
        return closeable;
      }

      if (!i.close) {
        return undefined;
      }

      return i as Closeable;
    })
    .filter(isNotNullable);

  let closed = false;
  const combined: Closeable = {
    close: () => {
      if (closed) {
        return undefined;
      }

      closed = true;
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      return closeAll(...closeables);
    },
  };
  return combined as CloseableAllResult<T>;
};

/**
 * Wraps a closeable to prevent errors during `close()` from propagating.
 *
 * This utility creates a "safe" version of a closeable that catches both synchronous throws and asynchronous rejections
 * during the close operation. If an error occurs, the optional `onError` callback is invoked with the error, and the
 * error is then swallowed (the close operation completes normally).
 *
 * This is particularly useful for ensuring cleanup operations never fail, which is important in scenarios like
 * application shutdown, resource cleanup chains, or when combining multiple closeables with {@link asCloseable} or
 * {@link closeAll}.
 *
 * @example Basic usage
 *
 * ```ts
 * import { asSafeCloseable } from 'emitnlog/utils';
 *
 * const failing = {
 *   close: () => {
 *     throw new Error('Will be ignored');
 *   },
 * };
 * const silent = asSafeCloseable(failing);
 * silent.close(); // Error is silently swallowed
 * ```
 *
 * @example Basic usage with error handling
 *
 * ```ts
 * import { createConsoleLogLogger } from 'emitnlog/logger';
 * import { asSafeCloseable } from 'emitnlog/utils';
 *
 * const unreliableResource = {
 *   close: () => {
 *     throw new Error('Cleanup failed');
 *   },
 * };
 *
 * const logger = createConsoleLogLogger();
 * const safeResource = asSafeCloseable(unreliableResource, (error) => {
 *   logger.w`Cleanup error: ${error}'`;
 * });
 *
 * safeResource.close(); // Never throws, logs warning instead
 * ```
 *
 * @example With asynchronous closeables
 *
 * ```ts
 * import { asSafeCloseable } from 'emitnlog/utils';
 *
 * const asyncResource = {
 *   close: async () => {
 *     throw new Error('Async cleanup failed');
 *   },
 * };
 *
 * const safeAsync = asSafeCloseable(asyncResource, (error) => {
 *   console.error('Async cleanup error:', error);
 * });
 *
 * await safeAsync.close(); // Never rejects, logs error instead
 * ```
 *
 * @example Combining with asCloseable for robust cleanup
 *
 * ```ts
 * import { asCloseable, asSafeCloseable } from 'emitnlog/utils';
 *
 * const robustCleanup = asCloseable(
 *   asSafeCloseable(riskyResource1),
 *   asSafeCloseable(riskyResource2),
 *   asSafeCloseable(riskyResource3),
 * );
 *
 * await robustCleanup.close(); // Guaranteed to not throw/reject
 * ```
 *
 * @param closeable - The closeable to wrap with error protection
 * @param onError - Optional callback invoked when an error occurs during close
 * @returns A closeable that never throws or rejects, matching the sync/async nature of the input
 */
export const asSafeCloseable = <C extends Closeable>(
  closeable: C,
  onError?: (error: unknown) => void,
): HasPotentiallyAsyncClose<C> extends true ? AsyncCloseable : SyncCloseable => {
  let closed = false;
  const safe = {
    close: () => {
      if (closed) {
        return undefined;
      }

      closed = true;
      try {
        const value = closeable.close();
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

  return safe as HasPotentiallyAsyncClose<C> extends true ? AsyncCloseable : SyncCloseable;
};

/**
 * A container for managing multiple closeables with a single `close()` call.
 *
 * This utility type represents a composite closeable that accumulates other closeables over time via the `add()`
 * method. Once `close()` is called, all registered closeables are closed in reverse order, and the internal collection
 * is cleared. Any subsequent calls to `add()` are still allowed, but the already-closed closeables will not be invoked
 * again.
 *
 * Useful for ensuring cleanup logic is always executed, even in complex control flows with multiple return points.
 */
export type Closer = Closeable & { readonly add: <T extends Closeable>(closeable: T) => T };

/**
 * Creates a `Closer` that manages a group of closeables as a single unit, simplifying resource management— especially
 * in functions with multiple return points or error paths.
 *
 * The returned object allows you to register closeables via `add()`, and later invoke `close()` once to clean them all
 * up. Closeables are executed in reverse order of registration (last in, first closed), which is useful when resources
 * depend on each other.
 *
 * After `close()` is called:
 *
 * - The internal list is cleared, so previously added closeables won't be called again.
 * - Further `add()` calls are still allowed and track newly added closeables.
 * - A subsequent call to `close()` will only affect those new closeables.
 *
 * Any errors thrown or rejected by the closeables are accumulated and handled using the same strategy as
 * {@link closeAll}.
 *
 * The difference between this utility and {@link asCloseable} is that the object returned here is a "live closeable"
 * that can be used to accumulate closeables as they are instantiated, whereas `asCloseable` is meant to be a "one time"
 * utility that produces a single closeable. Additionally, `closer.add(...)` preserves and returns the original
 * closeable’s type, making it easier to work with typed resources.
 *
 * @example Basic usage
 *
 * ```ts
 * import type { Logger } from 'emitnlog/logger';
 * import { createConsoleByLevelLogger } from 'emitnlog/logger';
 * import { asCloseable, createCloser } from 'emitnlog/utils';
 *
 * const closer = createCloser();
 *
 * if (enableDB) {
 *   const db: DB = closer.add(asCloseable(() => disconnect()));
 *   ...
 * }
 *
 * const logger: Logger = closer.add(createConsoleByLevelLogger());
 *
 * // When needed...
 * await closer.close(); // Closes logger first, then db
 * ```
 *
 * @param input - Optional initial set of closeables
 * @returns A `Closer` that can register and close closeables as a group
 */
export const createCloser = (...input: readonly Closeable[]): Closer => {
  const closeables = new Set<Closeable>(input);

  const closer: Closer = {
    add: <T extends Closeable>(closeable: T): T => {
      closeables.add(closeable);
      return closeable;
    },

    close: () => {
      if (!closeables.size) {
        return undefined;
      }

      const array = Array.from(closeables).reverse();
      closeables.clear();

      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      return closeAll(...array);
    },
  };

  return closer;
};

type PartialSyncCloseable = Partial<SyncCloseable>;
type PartialAsyncCloseable = Partial<AsyncCloseable>;
type CloseableLike = SyncCloseable | PartialSyncCloseable | AsyncCloseable | PartialAsyncCloseable | (() => unknown);

// Helper type to check if a type has a close method that could return Promise<void>
type HasPotentiallyAsyncClose<T> = T extends { close?: (...args: unknown[]) => infer R }
  ? [R] extends [Promise<void>]
    ? true
    : // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
      [R] extends [void]
      ? false
      : [R] extends [void | Promise<void>]
        ? true
        : false
  : false;

// Type helper to determine if any closeable is async
type HasAsyncCloseable<T extends readonly CloseableLike[]> = T extends readonly []
  ? false
  : T extends readonly [infer First, ...infer Rest]
    ? First extends AsyncCloseable
      ? true
      : First extends PartialAsyncCloseable
        ? true
        : HasPotentiallyAsyncClose<First> extends true
          ? true
          : First extends () => never
            ? false
            : First extends () => Promise<unknown>
              ? true
              : Rest extends readonly CloseableLike[]
                ? HasAsyncCloseable<Rest>
                : false
    : T extends readonly (AsyncCloseable | PartialAsyncCloseable)[]
      ? true
      : T extends readonly (infer U)[]
        ? U extends AsyncCloseable | PartialAsyncCloseable
          ? true
          : HasPotentiallyAsyncClose<U> extends true
            ? true
            : U extends () => never
              ? false
              : U extends () => Promise<unknown>
                ? true
                : false
        : false;

// Conditional return type
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type CloseAllResult<T extends readonly CloseableLike[]> = HasAsyncCloseable<T> extends true ? Promise<void> : void;

type CloseableAllResult<T extends readonly CloseableLike[]> =
  HasAsyncCloseable<T> extends true ? AsyncCloseable : SyncCloseable;
