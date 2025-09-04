import type { Simplify, Writable } from 'type-fest';

export type Finalizer = { readonly flush?: () => void | Promise<void>; readonly close?: () => void | Promise<void> };

export type SyncFinalizer<T extends Finalizer> = Omit<T, 'close'> & {
  readonly flush: () => void;
  readonly close: () => void;
};

export type AsyncFinalizer<T extends Finalizer> = Simplify<
  MergeFinalizer<T, { readonly flush: () => Promise<void>; readonly close: () => Promise<void> }>
>;

export type MergeFinalizer<TBase extends Finalizer, TFinalizer extends Finalizer> = Simplify<
  Omit<TBase, 'flush' | 'close'> & ForgeFinalizer<[TBase, TFinalizer]>
>;

export const asSingleFinalizer = <Fs extends readonly Finalizer[]>(...finalizers: Fs): Simplify<ForgeFinalizer<Fs>> => {
  const finalizer: Writable<Finalizer> = {};

  const flushables = finalizers.filter((logSink) => logSink.flush);
  if (flushables.length) {
    finalizer.flush = () => {
      const promises = flushables.map((logSink) => logSink.flush?.()).filter((result) => result instanceof Promise);
      return promises.length ? Promise.all(promises).then(() => undefined) : undefined;
    };
  }

  const closables = finalizers.filter((logSink) => logSink.close);
  if (closables.length) {
    finalizer.close = () => {
      const promises = closables.map((logSink) => logSink.close?.()).filter((result) => result instanceof Promise);
      return promises.length ? Promise.all(promises).then(() => undefined) : undefined;
    };
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

export type ForgeFinalizer<Fs extends readonly unknown[]> = _MergeOne<Fs, 'flush'> & _MergeOne<Fs, 'close'>;
