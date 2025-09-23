import { errorify } from '../converter/errorify.ts';
import { isNotNullable } from './is-not-nullable';

/**
 * A closeable that closes synchronously.
 */
export type SyncCloseable = { readonly close: () => void };

/**
 * A closeable that closes asynchronously.
 */
export type AsyncCloseable = { readonly close: () => Promise<void> };

/**
 * A closeable that closes either synchronously or asynchronously.
 */
export type Closeable = SyncCloseable | AsyncCloseable;

/**
 * Closes all provided closeables, returning a promise if at least one closeable is asynchronous.
 *
 * To ensure all closeables are actually closed, this method accumulates all errors thrown or rejected by the individual
 * handling of each closeable. The accumulated errors, if any, are then thrown if the all closeables are synchronous or
 * rejected if at least one closeable is asynchronous.
 *
 * Note on typing: the return type is `void` or `Promise<void>` depending on what TypeScript can infer about the
 * synchronicity of the provided closeables. In ambiguous cases, the safer `Promise<void>` may be inferred so that
 * callers remember to `await`.
 *
 * @example
 *
 * ```ts
 * import { closeAll } from 'emitnlog/utils';
 *
 * // All sync → returns void
 * const a = { close: () => {} };
 * const b = { close: () => {} };
 * closeAll(a, b);
 * ```
 *
 * @example
 *
 * ```ts
 * import { closeAll } from 'emitnlog/utils';
 *
 * // Mix of sync and async → returns Promise<void>
 * const a = { close: () => {} };
 * const b = { close: async () => {} };
 * await closeAll(a, b);
 * ```
 *
 * @example
 *
 * ```ts
 * import { closeAll } from 'emitnlog/utils';
 *
 * const a = {
 *   close: () => {
 *     throw new Error('fail');
 *   },
 * };
 * const b = { close: () => {} };
 *
 * try {
 *   // invokes both `close` methods
 *   closeAll(a, b);
 * } catch (error: Error) {
 *   // error is the error thrown by `a`
 * }
 * ```
 *
 * @example
 *
 * ```ts
 * import { asCloseable, closeAll } from 'emitnlog/utils';
 *
 * const a = asCloseable(() => { throw new Error('fail'); });
 * const b = asCloseable(() => Promise.reject('error') });
 *
 * try {
 *   // invokes both `close` methods
 *   await closeAll(a, b);
 * } catch (error) {
 *   // error.cause is an array with the errors from a and b
 * }
 * ```
 *
 * @param closeables The closeables to close @returns `void` or `Promise<void>` depending on the synchronicity of the
 *   provided closeables
 * @throws An Error if any closeable throws an error.
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
 * Produces a single closeable that, when closed, closes all the specified inputs.
 *
 * This method can be used to convert a function to a closable or to combine several of these functions, existing
 * closeables and even "partial closeables" (like loggers) into a single closeable. Like {@link closeAll}, then the close
 * method of the returned closeable is invoked, any error throw or rejected by an individual "closeable source" is
 * accumulated and then thrown (or rejected) after all sources are invoked.
 *
 * Note on typing: this function tries to yield a `SyncCloseable` whenever all inputs are known to be synchronous. In
 * ambiguous cases where TypeScript cannot infer synchronicity (e.g., unions or imprecise function types), the safer
 * `AsyncCloseable` may be inferred to encourage callers (and linters) to `await` the result.
 *
 * @example
 *
 * ```ts
 * import { asCloseable } from 'emitnlog/utils';
 *
 * const dispose = asCloseable(() => {...});
 * dispose.close();
 * ```
 *
 * @example
 *
 * ```ts
 * import { asCloseable } from 'emitnlog/utils';
 *
 * const c = asCloseable({ close: () => {} }, logger, async () => {});
 * await c.close();
 * ```
 *
 * @param input The closeables or functions to collapse into a single closeable
 * @returns A closeable that, when closed, closes all the specified inputs
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
 * Wraps a closeable so that errors during `close()` are ignored or captured.
 *
 * This utility returns a closeable but whose `close()` traps synchronous throws and async rejections. If an error
 * occurs, the optional `onError` callback is invoked and the error is swallowed (the returned value resolves to
 * `undefined`).
 *
 * This is particularly useful together with {@link asCloseable} or {@link closeAll} when you need to ensure that an
 * cleanup never throws.
 *
 * @example
 *
 * ```ts
 * const safe = asSafeCloseable(() => {...}),
 * await safe.close();
 * ```
 *
 * @example
 *
 * ```ts
 * const safe = asCloseable(
 *   asSafeCloseable(() => {}),
 *   asSafeCloseable(async () => {}),
 * );
 *
 * await safe.close();
 * ```
 *
 * @param closeable The closeable to wrap
 * @param onError Optional error handler invoked for thrown or rejected errors during `close()`
 * @returns A synchronous or asynchronous closeable that closes the specified input without throwing or rejecting.
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
            : U extends () => Promise<unknown>
              ? true
              : false
        : false;

// Conditional return type
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type CloseAllResult<T extends readonly CloseableLike[]> = HasAsyncCloseable<T> extends true ? Promise<void> : void;

type CloseableAllResult<T extends readonly CloseableLike[]> =
  HasAsyncCloseable<T> extends true ? AsyncCloseable : SyncCloseable;
