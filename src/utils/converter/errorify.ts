import { stringify } from './stringify.ts';

/**
 * Converts a given value into an instance of Error if needed.
 *
 * If a new error is created, the message is computed using {@link stringify}.
 *
 * @example
 *
 * ```ts
 * import { errorify } from 'emitnlog/utils';
 * const error = errorify('An error occurred');
 * ```
 *
 * @param {unknown} value - The value to convert into an Error.
 * @returns {Error} An error object, either the specified input or a new one created by this method.
 */
export const errorify = (value: unknown): Error =>
  value instanceof Error ? value : new Error(stringify(value), { cause: value });
