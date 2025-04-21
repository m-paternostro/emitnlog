/**
 * Options for the stringify function
 */
export type StringifyOptions = {
  /**
   * Whether to include stack traces for errors (default: false)
   */
  includeStack?: boolean;

  /**
   * Whether to prettify the output with indentation (default: false)
   */
  pretty?: boolean;

  /**
   * Maximum depth for recursive object serialization (default: 5)
   */
  maxDepth?: number;

  /**
   * Format dates using the local locale instead of ISO format (default: false) When true, uses `toLocaleString()`
   * instead of `toISOString()`
   */
  useLocale?: boolean;
};

/**
 * Converts a given value into a string representation that is appropriate for log events. This function is guaranteed
 * to never throw an error, making it safe for logging contexts.
 *
 * @example Simple usage
 *
 * ```ts
 * const str = stringify({ key: 'value' });
 * ```
 *
 * @example With options
 *
 * ```ts
 * // Include stack trace for errors
 * const error = new Error('Something went wrong');
 * const strWithStack = stringify(error, { includeStack: true });
 *
 * // Pretty format objects
 * const strPretty = stringify(complexObject, { pretty: true });
 *
 * // Format dates using locale
 * const date = new Date();
 * const localDate = stringify(date, { useLocale: true });
 * ```
 *
 * @param {unknown} value - The value to convert into a string.
 * @param {StringifyOptions} [options] - Optional configuration for stringification.
 * @returns {string} The string representation of the value.
 */
export const stringify = (value: unknown, options?: StringifyOptions): string => {
  try {
    const { includeStack = false, pretty = false, maxDepth = 5, useLocale = false } = options || {};

    const stringifyInternal = (val: unknown, depth = 0): string => {
      try {
        if (depth > maxDepth && typeof val === 'object' && val !== null) {
          return Array.isArray(val) ? `Array(${val.length})` : '[object Object]';
        }

        if (val === undefined) {
          return 'undefined';
        }

        if (val === null) {
          return 'null';
        }

        if (val instanceof Date) {
          try {
            return useLocale ? val.toLocaleString() : val.toISOString().replace('T', ' ').slice(0, -1);
          } catch {
            return '[Invalid Date]';
          }
        }

        if (val instanceof Error) {
          const message = val.message || val.name || '[unknown error]';
          return includeStack && val.stack ? `${message}\n${val.stack}` : message;
        }

        if (val instanceof Map) {
          if (depth < maxDepth) {
            try {
              const entries: unknown = Object.fromEntries(val);
              return pretty ? JSON.stringify(entries, undefined, 2) : JSON.stringify(entries);
            } catch {
              // ignore
            }
          }
          return `Map(${val.size})`;
        }

        if (val instanceof Set) {
          if (depth < maxDepth) {
            try {
              const array = Array.from(val);
              return pretty ? JSON.stringify(array, undefined, 2) : JSON.stringify(array);
            } catch {
              // ignore
            }
          }
          return `Set(${val.size})`;
        }

        if (val instanceof RegExp) {
          try {
            return val.toString();
          } catch {
            return '[RegExp]';
          }
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          const stringValue = String(val);
          const type = typeof val;
          switch (type) {
            case 'boolean':
            case 'number':
            case 'string':
            case 'bigint':
            case 'symbol':
            case 'function':
              return stringValue;

            default: {
              // Handle objects (including arrays)
              if (depth >= maxDepth) {
                return Array.isArray(val) ? `Array(${val.length})` : '[object Object]';
              }

              if (stringValue === '[object Object]' || Array.isArray(val)) {
                try {
                  // For depth limiting and circular references
                  const seen = new WeakSet();
                  const replacer = (key: string, val2: unknown) => {
                    try {
                      if (key === '') return val2;

                      if (typeof val2 === 'object' && val2 !== null) {
                        if (seen.has(val2)) {
                          return '[Circular]';
                        }
                        seen.add(val2);

                        if (depth + 1 >= maxDepth) {
                          if (Array.isArray(val2)) {
                            return `Array(${val2.length})`;
                          }
                          return '[object Object]';
                        }
                      }
                      return val2;
                    } catch {
                      return '[Error in replacer]';
                    }
                  };

                  return pretty ? JSON.stringify(val, replacer, 2) : JSON.stringify(val, replacer);
                } catch {
                  if (Array.isArray(val)) {
                    return `Array(${val.length})`;
                  }

                  try {
                    const keys = Object.keys(val as object);
                    return `{${keys.join(', ')}}`;
                  } catch {
                    return stringValue;
                  }
                }
              }
              return stringValue;
            }
          }
        } catch {
          return '[Non-stringifiable value]';
        }
      } catch {
        return '[Stringify error]';
      }
    };

    return stringifyInternal(value);
  } catch {
    // Absolute last resort fallback
    return '[Stringify fatal error]';
  }
};
