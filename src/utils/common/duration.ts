/**
 * Returns a string representation of the duration.
 *
 * The returned stringified number for the duration is guaranteed to be non-negative and is formatted as milliseconds.
 * By default, the number of decimal places adapts to the magnitude of the value to avoid noisy or misleading precision
 * in logs:
 *
 * - Values below `100` include `2` decimal places
 * - Values below `1000` include `1` decimal place
 * - Values `>= 1000` are rendered without a fractional part
 *
 * A fixed decimal precision can be enforced via the `precision` option. By default, the `"ms"` unit suffix is included.
 *
 * @example
 *
 * ```ts
 * import { stringifyDuration } from 'emitnlog/utils';
 *
 * stringifyDuration(12.345); // "12.35ms"
 * stringifyDuration(123.45); // "123.5ms"
 * stringifyDuration(2500.34); // "2500ms"
 *
 * stringifyDuration(2500.34, { precision: 2 }); // "2500.34ms"
 * stringifyDuration(12.345, { suppressUnit: true }); // "12.35"
 * ```
 *
 * @param duration The duration, typically obtained from `performance.now() - start`.
 * @param options Optional formatting options.
 * @returns A string representing the duration.
 */
export const stringifyDuration = (duration: number, options?: StringifyDurationOptions): string => {
  const value = Math.max(0, duration);
  const precision =
    options?.precision !== undefined
      ? toNonNegativeInteger(options.precision, 2)
      : value < 100
        ? 2
        : value < 1000
          ? 1
          : 0;
  const text = value.toFixed(precision);
  return options?.suppressUnit ? text : `${text}ms`;
};

/**
 * Returns a string representation of the elapsed time, in milliseconds, since the specified performance start.
 *
 * The elapsed time is computed using `performance.now()` and is guaranteed to be non-negative. The result is formatted
 * with a configurable decimal precision and, by default, includes the `"ms"` unit suffix. By default, the number of
 * decimal places adapts to the magnitude of the value to avoid noisy or misleading precision in logs:
 *
 * - Elapsed time below `100` include `2` decimal places
 * - Elapsed time below `1000` include `1` decimal place
 * - Elapsed time `>= 1000` are rendered without a fractional part
 *
 * A fixed decimal precision can be enforced via the `precision` option. By default, the `"ms"` unit suffix is included.
 *
 * @example
 *
 * ```ts
 * import { stringifyElapsed } from 'emitnlog/utils';
 *
 * const start = performance.now();
 *
 * // ... do some work ...
 *
 * stringifyElapsed(start); // "12.34ms"
 * stringifyElapsed(start, { precision: 0 }); // "12ms"
 * stringifyElapsed(start, { suppressUnit: true }); // "12.34"
 * ```
 *
 * @param performanceStart The start timestamp, typically obtained from `performance.now()`.
 * @param options Optional formatting options.
 * @returns A string representing the elapsed time in milliseconds.
 */
export const stringifyElapsed = (performanceStart: number, options?: StringifyDurationOptions): string =>
  stringifyDuration(performance.now() - Math.max(0, performanceStart), options);

type StringifyDurationOptions = {
  /**
   * Number of decimal places to include.
   *
   * The default value varies based on the magnitude of the duration:
   *
   * - Duration below `100` include `2` decimal places
   * - Duration below `1000` include `1` decimal place
   * - Duration `>= 1000` are rendered without a fractional part
   *
   * @default 2, 1, or 0
   */
  readonly precision?: number;

  /**
   * When true, omits the `"ms"` unit suffix.
   *
   * @default false
   */
  readonly suppressUnit?: boolean;
};
/**
 * Returns a non negative integer for the specified value.
 *
 * If the value is undefined, returns the specified `defaultValue`. If lower than 0, the return is zero. Otherwise the
 * return is the number, rounded down to the nearest integer.
 *
 * @example
 *
 * ```ts
 * import { toNonNegativeInteger } from 'emitnlog/utils';
 *
 * const value = toNonNegativeInteger(undefined); // 0
 * const value = toNonNegativeInteger(undefined, 2); // 2
 * const value = toNonNegativeInteger(undefined, -2); // 0
 * const value = toNonNegativeInteger(1.5); // 1
 * const value = toNonNegativeInteger(-1, 2); // 0
 * const value = toNonNegativeInteger(10); // 10
 * ```
 *
 * @param value
 * @param [defaultValue] The default value to be used if the value is undefined
 * @returns An integer greater or equal than zero, _regardless_ of the default value.
 */
export const toNonNegativeInteger = (value: number | undefined, defaultValue = 0): number =>
  value === undefined ? Math.max(0, Math.floor(defaultValue)) : Math.max(0, Math.floor(value));
