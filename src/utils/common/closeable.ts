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
 * Closes all provided closeables.
 *
 * - If at least one `close()` returns a promise (or the types indicate it may), the function returns a `Promise<void>`
 *   that resolves when all async closures complete. Otherwise it returns `void`.
 * - Errors thrown synchronously by a `close()` implementation or rejections from an async `close()` are not handled here
 *   and will propagate to the caller. Use {@link asSafeCloseable} when you need errors to be captured and optionally
 *   reported.
 *
 * Note on typing: the return type is `void` or `Promise<void>` depending on what TypeScript can infer about the
 * synchronicity of the provided closeables. In ambiguous cases, the safer `Promise<void>` may be inferred so that
 * callers remember to `await`.
 *
 * @example
 *
 * ```ts
 * // All sync → returns void
 * const a = { close: () => {} };
 * const b = { close: () => {} };
 * closeAll(a, b);
 *
 * // Mix of sync/async → returns Promise<void>
 * const c = { close: async () => {} };
 * await closeAll(a, c);
 * ```
 *
 * @param closeables The closeables to close
 * @returns `void` or `Promise<void>` depending on the synchronicity of the provided closeables
 */
export const closeAll = <T extends readonly Closeable[]>(...closeables: T): CloseAllResult<T> => {
  if (closeables.length === 0) {
    return undefined as CloseAllResult<T>;
  }

  if (closeables.length === 1) {
    return closeables[0].close() as CloseAllResult<T>;
  }

  const promises = closeables.map((closeable) => closeable.close()).filter((result) => result instanceof Promise);
  if (promises.length) {
    return Promise.all(promises).then(() => undefined) as CloseAllResult<T>;
  }

  return undefined as CloseAllResult<T>;
};

/**
 * Produces a single closeable that, when closed, closes all the specified inputs.
 *
 * You can:
 *
 * - Provide existing closeables
 * - Provide functions (sync or async), which are treated as close operations and will be invoked on `close()`
 * - Errors thrown by any underlying `close()` or by provided functions, and rejections from async functions, are not
 *   handled and will propagate. Wrap the result with {@link asSafeCloseable} if you need to swallow or report errors.
 *
 * Note on typing: this function tries to yield a `SyncCloseable` whenever all inputs are known to be synchronous. In
 * ambiguous cases where TypeScript cannot infer synchronicity (e.g., unions or imprecise function types), the safer
 * `AsyncCloseable` may be inferred to encourage callers (and linters) to `await` the result.
 *
 * @example
 *
 * ```ts
 * // 1) Create a closeable from a function
 * const dispose = asCloseable(() => {});
 * dispose.close();
 *
 * // 2) Collapse several closeables and functions into one
 * const a: SyncCloseable = { close: () => {} };
 * const b: AsyncCloseable = { close: async () => {} };
 * const c = asCloseable(a, b, () => {});
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
 * This utility returns a closeable with the same type as the input, but whose `close()` traps synchronous throws and
 * async rejections. If an error occurs, the optional `onError` callback is invoked and the error is swallowed (the
 * returned value resolves to `undefined`).
 *
 * This is particularly useful together with {@link asCloseable} or {@link closeAll} when you need to ensure that an
 * cleanup never throws.
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
 * @returns The same type of the specified closeable, made safe (errors are caught and ignored after `onError`)
 */
export const asSafeCloseable = <C extends Closeable>(closeable: C, onError?: (error: unknown) => void): C => {
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

  return safe as C;
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
