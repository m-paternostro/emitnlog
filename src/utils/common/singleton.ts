/**
 * A singleton array that is used to represent an empty array.
 */
export const EMPTY_ARRAY: readonly unknown[] = Object.freeze([]);

/**
 * A function that returns a singleton array that is used to represent an empty array.
 *
 * @example:
 * ```ts
 * const emptyArray = emptyArray<number>();
 * console.log(emptyArray); // []
 * ```
 */
export const emptyArray = <T>(): readonly T[] => EMPTY_ARRAY as readonly T[];
