/**
 * Check if a value is not undefined or null. A non-nullable return is typed as such.
 *
 * @example
 *
 * ```ts
 * const arr: (string | undefined | null)[] = ['a', null, 'b', undefined, 'c'];
 * const result: string[] = arr.filter(isNotNullable);
 * ```
 *
 * @param value - The value to check.
 * @returns `true` if the value is not undefined or null, `false` otherwise.
 */
export const isNotNullable = <T>(value: T | undefined | null): value is NonNullable<T> =>
  value !== undefined && value !== null;
