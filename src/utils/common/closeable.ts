import { errorify } from '../converter/errorify.ts';
import { isNotNullable } from './is-not-nullable';

/**
 * A resource that can be closed synchronously.
 *
 * Objects implementing this interface provide a `close()` method that performs cleanup operations immediately and
 * returns `void`. This is typically used for resources that don't require asynchronous operations during cleanup, such
 * as event listeners, timers, or simple state cleanup.
 */
export type SyncCloseable = { readonly close: () => void };

/**
 * A resource that can be closed asynchronously.
 *
 * Objects implementing this interface provide a `close()` method that returns a `Promise<void>`. This is typically used
 * for resources that require asynchronous operations during cleanup, such as file handles, database connections, or
 * network resources.
 */
export type AsyncCloseable = { readonly close: () => Promise<void> };

/**
 * A resource that can be closed either synchronously or asynchronously.
 *
 * This union type represents any closeable resource, whether it requires synchronous or asynchronous cleanup. It's the
 * most flexible type for accepting closeable resources when the cleanup method is not known in advance.
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
 * Creates a single closeable that, when closed, closes all the specified inputs.
 *
 * This function is useful to create closeables from functions or for combining multiple cleanup operations into a
 * single closeable object. It accepts various types of inputs including existing closeables, cleanup functions, and
 * "partial closeables" like loggers with optional `close` methods. When the returned closeable is closed, all inputs
 * are processed and any errors are accumulated using the same error handling strategy as {@link closeAll}.
 *
 * The return type is automatically inferred:
 *
 * - All synchronous inputs → returns `SyncCloseable`
 * - Any asynchronous inputs → returns `AsyncCloseable`
 * - Ambiguous types → defaults to `AsyncCloseable` for safety
 *
 * @example Converting functions to closeables
 *
 * ```ts
 * import { asCloseable } from 'emitnlog/utils';
 *
 * const cleanup1 = () => clearTimeout(timerId);
 * const cleanup2 = () => removeEventListener('resize', handler);
 *
 * const disposer = asCloseable(cleanup1, cleanup2);
 * disposer.close(); // Calls both cleanup functions
 * ```
 *
 * @example Combining mixed closeable types
 *
 * ```ts
 * import { asCloseable } from 'emitnlog/utils';
 *
 * const syncCloseable = { close: () => console.log('Sync cleanup') };
 * const asyncFunction = async () => await db.disconnect();
 * const logger = createLogger(); // Has optional close?: () => void | Promise<void>
 *
 * const combined = asCloseable(syncCloseable, asyncFunction, logger);
 * await combined.close(); // Returns AsyncCloseable due to async input
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
 * @example With empty input
 *
 * ```ts
 * import { asCloseable } from 'emitnlog/utils';
 *
 * const noop = asCloseable(); // Creates a no-op closeable
 * noop.close(); // Does nothing, returns void
 * ```
 *
 * @param input - The closeables, functions, or partial closeables to combine
 * @returns A closeable that closes all specified inputs when its `close()` method is called
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

  const combined: Closeable = { close: () => closeAll(...closeables) };
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
  const safe = {
    close: () => {
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
