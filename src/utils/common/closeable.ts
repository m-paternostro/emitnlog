export type SyncCloseable = { readonly close: () => void };
export type AsyncCloseable = { readonly close: () => Promise<void> };
export type Closeable = SyncCloseable | AsyncCloseable;

type CloseableLike = SyncCloseable | AsyncCloseable | (() => unknown);

// Type helper to determine if any closeable is async
type HasAsyncCloseable<T extends readonly CloseableLike[]> = T extends readonly []
  ? false
  : T extends readonly [infer First, ...infer Rest]
    ? First extends AsyncCloseable
      ? true
      : First extends () => Promise<unknown>
        ? true
        : Rest extends readonly CloseableLike[]
          ? HasAsyncCloseable<Rest>
          : false
    : T extends readonly AsyncCloseable[]
      ? true
      : T extends readonly (infer U)[]
        ? U extends AsyncCloseable
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

// Returns a closeable that combines all specified closeables or close functions
export const asCloseable = <T extends readonly CloseableLike[]>(...input: T): CloseableAllResult<T> => {
  const closeables: readonly Closeable[] = input.map((i) => {
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

    return i;
  });

  const combined: Closeable = { close: () => closeAll(...closeables) };
  return combined as CloseableAllResult<T>;
};

export const asSafeCloseable = <C extends Closeable>(closeable: C): C => {
  const safe = {
    close: () => {
      try {
        const value = closeable.close();
        if (value instanceof Promise) {
          return value.catch(() => undefined);
        }
      } catch {
        // ignore
      }
      return undefined;
    },
  };

  return safe as C;
};
