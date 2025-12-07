import { exhaustiveCheck } from '../common/exhaustive-check.ts';

/**
 * Options for the stringify function
 */
export type StringifyOptions = {
  /**
   * Whether to include stack traces for errors.
   *
   * @default false
   */
  readonly includeStack?: boolean;

  /**
   * Whether to prettify the output with indentation.
   *
   * @default false
   */
  readonly pretty?: boolean;

  /**
   * Maximum depth for recursive object serialization. Use a negative number to disable the depth limit.
   *
   * @default 5
   */
  readonly maxDepth?: number;

  /**
   * When true, uses `toLocaleString()` instead of `toISOString()` to format dates using the local locale instead of the
   * default ISO format.
   *
   * @default false
   */
  readonly useLocale?: boolean;

  /**
   * Maximum number of array elements to show before truncating. Use a negative number to disable the array element
   * limit.
   *
   * @default 100
   */
  readonly maxArrayElements?: number;

  /**
   * When true, excludes the array truncation element.
   *
   * By default, stringify adds a truncation element like `'...(4)'` to indicate that an array has been truncated due to
   * the `maxArrayElements` option.
   *
   * @default false
   */
  readonly excludeArrayTruncationElement?: boolean;

  /**
   * Maximum number of object properties to show before truncating. Use a negative number to disable the object property
   * limit.
   *
   * @default 50
   */
  readonly maxProperties?: number;

  /**
   * When true, excludes the object truncation property.
   *
   * By default, stringify adds a truncation property like `'...(4)':'...'` to indicate that an object has been
   * truncated due to the `maxProperties` option.
   *
   * @default false
   */
  readonly excludeObjectTruncationProperty?: boolean;
};

/**
 * Converts a given value into a string representation that is appropriate for log events. This function is guaranteed
 * to never throw an error, making it safe for logging contexts.
 *
 * @example Simple usage
 *
 * ```ts
 * import { stringify } from 'emitnlog/utils';
 * const str = stringify({ key: 'value' });
 * ```
 *
 * @example With options
 *
 * ```ts
 * import { stringify } from 'emitnlog/utils';
 *
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
  const {
    includeStack = false,
    pretty = false,
    maxDepth = 5,
    useLocale = false,
    maxArrayElements = 100,
    maxProperties = 50,
  } = options || {};

  const prepare = (val: unknown, depth = 0, seen = new WeakSet()): unknown => {
    const type = typeof val;
    switch (type) {
      case 'string':
      case 'number':
      case 'bigint':
      case 'boolean':
      case 'undefined':
      case 'symbol':
      case 'function':
        return val;

      case 'object': {
        if (val instanceof Date) {
          try {
            return useLocale ? val.toLocaleString() : val.toISOString();
          } catch {
            return '[Invalid Date]';
          }
        }

        if (val instanceof Error) {
          try {
            const message = val.message || val.name || '[unknown error]';
            return includeStack && val.stack ? `${message}\n${val.stack}` : message;
          } catch {
            return '[Invalid Error]';
          }
        }

        if (val instanceof Map) {
          if (maxDepth < 0 || depth < maxDepth) {
            try {
              return prepare(Object.fromEntries(val), depth + 1, seen);
            } catch {
              // ignore
            }
          }
          return `Map(${val.size})`;
        }

        if (val instanceof Set) {
          if (maxDepth < 0 || depth < maxDepth) {
            try {
              return prepare(Array.from(val), depth + 1, seen);
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

        /* eslint-disable no-undef */
        if (
          typeof Headers !== 'undefined' &&
          val instanceof Headers &&
          'forEach' in val &&
          typeof val.forEach === 'function'
        ) {
          const record: Record<string, string> = {};
          val.forEach((v, key) => {
            record[key] = v;
          });
          return prepare(record, depth + 1, seen);
        }
        /* eslint-enable no-undef */

        if (!val) {
          return val;
        }

        if (seen.has(val)) {
          return '[Circular Reference]';
        }
        seen.add(val);

        if (Array.isArray(val)) {
          if (maxDepth < 0 || depth < maxDepth) {
            if (maxArrayElements >= 0 && val.length > maxArrayElements) {
              const truncatedArray = val.slice(0, maxArrayElements);
              if (!options?.excludeArrayTruncationElement) {
                truncatedArray.push(`...(${val.length - maxArrayElements})`);
              }
              val = truncatedArray;
            }

            try {
              return (val as unknown[]).map((item) => prepare(item, depth + 1, seen));
            } catch {
              // ignore
            }
          }
          return `Array(${(val as unknown[]).length})`;
        }

        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const stringValue = String(val);
        if (stringValue !== '[object Object]') {
          return stringValue;
        }

        if (maxDepth < 0 || depth < maxDepth) {
          try {
            const keys = Object.keys(val);
            if (!keys.length) {
              return {};
            }

            const prepareValue = (key: string) => {
              const v = (val as Record<string, unknown>)[key];
              return prepare(v, depth + 1, seen);
            };

            if (maxProperties >= 0 && keys.length > maxProperties) {
              const length = keys.length;
              const truncatedObj: Record<string, unknown> = {};

              let max = maxProperties;
              for (let i = 0; i < max; i++) {
                const key = keys[i];
                try {
                  truncatedObj[key] = prepareValue(key);
                } catch {
                  if (max < length) {
                    max++;
                  }
                }
              }

              if (length > max && !options?.excludeObjectTruncationProperty) {
                const truncatedKey = `...(${length - max})`;
                truncatedObj[truncatedKey] = '...';
              }
              return truncatedObj;
            }

            const result: Record<string, unknown> = {};
            for (const key of keys) {
              try {
                result[key] = prepareValue(key);
              } catch {
                // ignore
              }
            }
            return result;
          } catch {
            // ignore
          }
        }

        return '[object Object]';
      }

      default:
        exhaustiveCheck(type);
        return val;
    }
  };

  const convert = (val: unknown): string => {
    const type = typeof val;
    switch (type) {
      case 'string':
        return val as string;

      case 'number':
      case 'bigint':
      case 'boolean':
      case 'undefined':
      case 'symbol':
      case 'function':
        return String(val);

      case 'object': {
        try {
          return pretty ? JSON.stringify(val, undefined, 2) : JSON.stringify(val);
        } catch {
          if (Array.isArray(val)) {
            return `Array(${val.length})`;
          }

          try {
            const keys = Object.keys(val as object);
            return `{${keys.join(', ')}}`;
          } catch {
            return String(val);
          }
        }
      }

      default:
        exhaustiveCheck(type);
        return String(val);
    }
  };

  try {
    const converted = prepare(value);
    return convert(converted);
  } catch {
    return '[Stringify Error]';
  }
};
