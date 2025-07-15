/**
 * Converts a given value into an instance of Error.
 *
 * @example
 *
 * ```ts
 * import { errorify } from 'emitnlog/utils';
 * const error = errorify('An error occurred');
 * ```
 *
 * @param {unknown} value - The value to convert into an Error.
 * @returns {Error} The converted Error object.
 */
export const errorify = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value), { cause: value });
