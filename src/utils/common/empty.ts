/**
 * An immutable empty array.
 */
export const EMPTY_ARRAY: readonly unknown[] = Object.freeze([]);

/**
 * A function that returns {@link EMPTY_ARRAY the immutable empty array}, useful when type inference is needed.
 *
 * @example:
 * ```ts
 * import { emptyArray } from 'emitnlog/utils';
 *
 * const accounts: readonly Account[] = getAccounts() ?? emptyArray();
 * console.log(accounts.length);
 * ```
 */
export const emptyArray = <T>(): readonly T[] => EMPTY_ARRAY as readonly T[];

/**
 * An immutable empty record.
 */
export const EMPTY_RECORD: { readonly [key: string | number | symbol]: unknown } = Object.freeze({});

/**
 * A function that returns {@link EMPTY_RECORD the immutable empty record}, useful when type inference is needed.
 *
 * @example:
 * ```ts
 * import { emptyRecord } from 'emitnlog/utils';
 *
 * const record: Readonly<Record<string, number>> = emptyRecord();
 * console.log(record.a);
 * ```
 */
export const emptyRecord = <K extends string | number | symbol, V>(): { readonly [key in K]: V } =>
  EMPTY_RECORD as { readonly [key in K]: V };

const createImmutableSet = <T>(target = new Set<T>()): ReadonlySet<T> => {
  const add: Set<T>['add'] = () => {
    throw new TypeError('Cannot modify an immutable set.');
  };

  const deleteFn: Set<T>['delete'] = () => false;

  const clear: Set<T>['clear'] = () => {
    throw new TypeError('Cannot modify an immutable set.');
  };

  Object.defineProperties(target, {
    add: { value: add, writable: false, enumerable: false, configurable: false },
    delete: { value: deleteFn, writable: false, enumerable: false, configurable: false },
    clear: { value: clear, writable: false, enumerable: false, configurable: false },
  });

  return Object.freeze(target);
};

/**
 * An immutable empty set.
 */
export const EMPTY_SET: ReadonlySet<unknown> = createImmutableSet();

/**
 * A function that returns {@link EMPTY_SET the immutable empty set}, useful when type inference is needed.
 *
 * @example:
 * ```ts
 * import { emptySet } from 'emitnlog/utils';
 *
 * const names: ReadonlySet<string> = getNameSet() ?? emptySet();
 * console.log(names.size);
 * ```
 */
export const emptySet = <T>(): ReadonlySet<T> => EMPTY_SET as ReadonlySet<T>;

const createImmutableMap = <K, V>(target = new Map<K, V>()): ReadonlyMap<K, V> => {
  const setValue: Map<K, V>['set'] = () => {
    throw new TypeError('Cannot modify an immutable map.');
  };

  const deleteFn: Map<K, V>['delete'] = () => false;

  const clear: Map<K, V>['clear'] = () => {
    throw new TypeError('Cannot modify an immutable map.');
  };

  Object.defineProperties(target, {
    set: { value: setValue, writable: false, enumerable: false, configurable: false },
    delete: { value: deleteFn, writable: false, enumerable: false, configurable: false },
    clear: { value: clear, writable: false, enumerable: false, configurable: false },
  });

  return Object.freeze(target);
};

/**
 * An immutable empty map.
 */
export const EMPTY_MAP: ReadonlyMap<unknown, unknown> = createImmutableMap();

/**
 * A function that returns {@link EMPTY_MAP the immutable empty map}, useful when type inference is needed.
 *
 * @example:
 * ```ts
 * import { emptyMap } from 'emitnlog/utils';
 *
 * const map: ReadonlyMap<string, number> = emptyMap();
 * console.log(map.size);
 * ```
 */
export const emptyMap = <K, V>(): ReadonlyMap<K, V> => EMPTY_MAP as ReadonlyMap<K, V>;
