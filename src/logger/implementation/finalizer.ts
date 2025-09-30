import type { Simplify, Writable } from 'type-fest';

import type { Closable } from '../../utils/common/closable.ts';
import { asClosable } from '../../utils/common/closable.ts';

/**
 * Base interface for objects that support resource cleanup operations.
 *
 * Defines optional `flush` and `close` methods that can be either synchronous or asynchronous, providing a foundation
 * for proper resource management.
 */
export type Finalizer = { readonly flush?: () => void | Promise<void>; readonly close?: () => void | Promise<void> };

/**
 * Transforms a Finalizer to have synchronous flush and close methods.
 *
 * Used for resources that don't require asynchronous cleanup operations, such as in-memory buffers or simple data
 * structures.
 *
 * @example
 *
 * ```ts
 * // Memory sink uses synchronous operations
 * export type MemorySink = SyncFinalizer<LogSink> & MemoryStore;
 * ```
 */
export type SyncFinalizer<T extends Finalizer> = Omit<T, 'close'> & {
  readonly flush: () => void;
  readonly close: () => void;
};

/**
 * Transforms a Finalizer to have asynchronous flush and close methods.
 *
 * Used for resources that require asynchronous cleanup operations, such as file operations, network connections, or
 * database transactions.
 *
 * @example
 *
 * ```ts
 * // File sink uses asynchronous operations
 * export type FileSink = AsyncFinalizer<LogSink> & { readonly filePath: string };
 * ```
 */
export type AsyncFinalizer<T extends Finalizer> = Simplify<
  MergeFinalizer<T, { readonly flush: () => Promise<void>; readonly close: () => Promise<void> }>
>;

/**
 * Merges two Finalizer types, combining their flush and close method signatures.
 *
 * This utility type is used internally to properly compose finalizer behaviors when combining different resource
 * management patterns.
 */
export type MergeFinalizer<TBase extends Finalizer, TFinalizer extends Finalizer> = Simplify<
  Omit<TBase, 'flush' | 'close'> & ForgeFinalizer<[TBase, TFinalizer]>
>;

/**
 * Combines multiple finalizers into a single finalizer that manages all of them.
 *
 * This function creates a unified finalizer that:
 *
 * - Calls `flush()` on all provided finalizers that have a flush method
 * - Calls `close()` on all provided finalizers that have a close method
 * - Automatically handles both synchronous and asynchronous operations
 * - Returns synchronous methods if all finalizers are synchronous, otherwise async
 *
 * @example Basic usage
 *
 * ```ts
 * import { asSingleFinalizer } from 'emitnlog/logger/implementation';
 *
 * const fileSink = fileSink('app.log');
 * const memorySink = memorySink();
 * const combinedFinalizer = asSingleFinalizer(fileSink, memorySink);
 *
 * // Flushes both file and memory sinks
 * await combinedFinalizer.flush?.();
 *
 * // Closes both sinks
 * await combinedFinalizer.close?.();
 * ```
 *
 * @example Used in tee logger
 *
 * ```ts
 * // The tee logger uses this to manage multiple underlying loggers
 * const finalizer = asSingleFinalizer(...loggers);
 * const teeLogger = {
 *   // ... other logger methods
 *   ...finalizer, // Adds combined flush/close methods
 * };
 * ```
 *
 * @param finalizers Array of finalizers to combine
 * @returns A single finalizer that manages all the provided finalizers
 */
export const asSingleFinalizer = <Fs extends readonly Finalizer[]>(...finalizers: Fs): Simplify<ForgeFinalizer<Fs>> => {
  const finalizer: Writable<Finalizer> = {};

  const flushables = finalizers.filter((logSink) => logSink.flush);
  if (flushables.length) {
    finalizer.flush = () => {
      const promises = flushables.map((logSink) => logSink.flush?.()).filter((result) => result instanceof Promise);
      return promises.length ? Promise.all(promises).then(() => undefined) : undefined;
    };
  }

  const closables: Closable[] = finalizers.filter((logSink): logSink is Closable => !!logSink.close);
  if (closables.length) {
    const combined = asClosable(...closables);
    finalizer.close = () => combined.close();
  }

  return finalizer as ForgeFinalizer<Fs>;
};

type FinalizerKey = 'flush' | 'close';

type _FnsOf<T, K extends FinalizerKey> = T extends { [P in K]?: infer V }
  ? Extract<V, () => void | Promise<void>>
  : never;

type _MethodUnion<Fs extends readonly unknown[], K extends FinalizerKey> = _FnsOf<Fs[number], K>;

type _MergeOne<Fs extends readonly unknown[], K extends FinalizerKey> = [_MethodUnion<Fs, K>] extends [never]
  ? { readonly [P in K]?: () => void }
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Extract<ReturnType<_MethodUnion<Fs, K>>, Promise<any>> extends never
    ? { readonly [P in K]: () => void }
    : { readonly [P in K]: () => Promise<void> };

/**
 * Creates a finalizer type by analyzing an array of objects and determining the appropriate flush and close method
 * signatures.
 *
 * This advanced TypeScript utility:
 *
 * - Examines all objects in the array for flush/close methods
 * - Returns sync methods if all methods are synchronous
 * - Returns async methods if any method is asynchronous
 * - Makes methods optional if not all objects have them
 *
 * Used internally by `asSingleFinalizer` and `MergeFinalizer` to ensure proper type safety when combining multiple
 * finalizers.
 *
 * @example Type behavior
 *
 * ```ts
 * // All sync -> sync finalizer
 * type SyncResult = ForgeFinalizer<[{ flush: () => void }, { close: () => void }]>;
 * // Result: { flush: () => void; close: () => void }
 *
 * // Mixed sync/async -> async finalizer
 * type AsyncResult = ForgeFinalizer<[{ flush: () => Promise<void> }, { close: () => void }]>;
 * // Result: { flush: () => Promise<void>; close: () => Promise<void> }
 * ```
 */
export type ForgeFinalizer<Fs extends readonly unknown[]> = _MergeOne<Fs, 'flush'> & _MergeOne<Fs, 'close'>;
