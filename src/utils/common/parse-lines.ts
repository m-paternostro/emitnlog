import { errorify } from '../converter/errorify.ts';
import { emptyArray } from './empty.ts';
import type { JsonSafe } from './serialization.ts';
import { jsonParse } from './serialization.ts';

/**
 * Parses each line of the specified value as a full serialized JSON value, returning all values as an array. This
 * method is useful when, for example, handling
 * [NDJSON](https://en.wikipedia.org/wiki/JSON_streaming#Newline-delimited_JSON) log entries.
 *
 * By default this method only throws when an error occurs while parsing a line _and_ no line yields contains a valid
 * serialized JSON value - in other words, if the parsing of a single line succeeds, all errors are ignored. This
 * behavior can be modified by using `options.onError` which is notified for every error and can be implemented to throw
 * a value that is then propagated to the caller.
 *
 * @example
 *
 * ```ts
 * import { parseLines } from 'emitnlog/logger';
 *
 * const value = [
 *   '{"level":"info","timestamp":1705312245123,"message":"Application started"}',
 *   '{"level":"error","timestamp":1705312246456,"message":"Connection failed","args":[{"host":"db.example.com"}]}',
 * ].join('\n');
 *
 * // Parses 2 objects
 * const objects = parseLines(value);
 * ```
 *
 * @param value A string containing one or more JSON objects, each on a separate line.
 * @param options Optional options for the parsing process.
 * @returns An array with the parsed objects or an empty array if there were no objects in the value.
 * @throws An error if is there are no objects in the value and an error were thrown or if `options.onError` throws.
 */
export const parseLines = <T = unknown>(
  value: string,
  options?: {
    /**
     * Callback invoked whenever an error occurs while parsing a line.
     *
     * Any value thrown by this method interrupts the parsing and is propagated to the caller.
     *
     * @param error The error thrown
     * @param line The line that caused the error
     */
    readonly onError?: (error: Error, line: string) => void;

    /**
     * By default parsed `null` values are ignored. Setting this option to true causes them to be added to the returned
     * array and considered as valid JSON values.
     *
     * @default false
     */
    readonly keepNull?: boolean;
  },
): readonly JsonSafe<T>[] => {
  if (!value.trim()) {
    return emptyArray();
  }

  let error: Error | undefined;
  const lines = value.split('\n');
  const objects = lines
    .map((line) => {
      if (!line.trim()) {
        return undefined;
      }

      try {
        const parsed = jsonParse<T>(line);
        if (parsed === null && !options?.keepNull) {
          return undefined;
        }

        return parsed;
      } catch (e: unknown) {
        error = errorify(e);
        options?.onError?.(error, line);
        return undefined;
      }
    })
    .filter((item): item is JsonSafe<T> => item !== undefined);

  if (objects.length) {
    return objects;
  }

  if (error) {
    throw error;
  }

  return emptyArray();
};
