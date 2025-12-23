/**
 * A typed wrapper around `JSON.parse()` that returns a {@link JsonSafe} version of the expected type.
 *
 * This helper gives the parsed output the static type you would expect after serializing and parsing a given `T`,
 * automatically removing functions and non-JSON-safe properties. The returned value is guaranteed to be safe to pass
 * back into `JSON.stringify()`, but no runtime validation is performed — the cast assumes the JSON content already
 * matches `T`.
 *
 * @example
 *
 * ```ts
 * import { jsonParse } from 'emitnlog/utils';
 *
 * interface Config {
 *   name: string;
 *   version?: number;
 *   onInit?: () => void;
 * }
 *
 * const config = { name: 'app', version: 2, onInit: () => console.log('here') };
 * const json = JSON.stringify(config);
 *
 * // `parsed` is a JsonSafe<Config> (i.e., `{ name: string; version?: number }`)
 * const parsed = jsonParse<Config>(config);
 * ```
 *
 * @example
 *
 * ```ts
 * import { jsonParse } from 'emitnlog/utils';
 *
 * // `parsed` is a JsonSafe<unknown> (i.e., JsonValue)
 * const parsed = jsonParse('{"items":[1,2,3]}');
 * ```
 *
 * @param value A JSON string to parse.
 * @returns The parsed JSON content typed as `JsonSafe<T>`.
 * @throw Error if value cannot be parsed.
 */
export const jsonParse = <T = unknown>(value: string): JsonSafe<T> => JSON.parse(value) as JsonSafe<T>;

/**
 * A type-safe wrapper around `JSON.stringify()` that only accepts {@link JsonSafe} values.
 *
 * By constraining the input to `JsonSafe`, this helper ensures the value has already been stripped of functions,
 * symbols, and other non-serializable structures, eliminating most runtime failures you'd otherwise see when calling
 * `JSON.stringify()` directly.
 *
 * @example
 *
 * ```ts
 * import { jsonParse, jsonStringify } from 'emitnlog/utils';
 *
 * const config = jsonParse<{ name: string }>('{"name":"app"}');
 * const json = jsonStringify(config);
 * // json === '{"name":"app"}'
 * ```
 *
 * @param value A {@link JsonSafe} value to serialize, usually an object or array.
 * @param replacer A function that transforms the results.
 * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier
 *   to read.
 * @returns The serialized JSON string.
 */
export const jsonStringify = (
  value: JsonSafe,
  replacer?: ((key: string, value: unknown) => unknown) | null,
  space?: string | number,
): string => JSON.stringify(value, replacer ?? undefined, space);

/**
 * A type that maps to a structure of a value after it has been serialized with `JSON.stringify()` and then parsed with
 * `JSON.parse()`.
 *
 * `JsonSafe<T>` represents the _parsed form_ of a given type `T` - that is, how it appears once converted to JSON and
 * read back. It recursively:
 *
 * - Preserves JSON-compatible primitives (`string`, `number`, `boolean`, `null`).
 * - Converts `Date` instances to their ISO string representation.
 * - Expands arrays (including readonly arrays and tuples) to arrays of parsed elements.
 * - Removes properties that are undefined or never, since such properties are omitted during JSON serialization.
 * - Converts `unknown` fields into {@link JsonValue}.
 * - Removes functions and symbols.
 *
 * This type is especially useful for typing data that originates from JSON sources or APIs, while still relating it
 * back to a known TypeScript type and ensuring the result can be serialized again without runtime surprises. The
 * transformation happens at the type level only; `jsonParse()` does not verify that the input actually conforms to
 * `T`.
 *
 * @example
 *
 * ```ts
 * import type { JsonSafe } from 'emitnlog/utils';
 * import { jsonParse } from 'emitnlog/utils';
 *
 * interface Person {
 *   name: string;
 *   age?: number;
 *   greet(): void;
 *   meta: unknown;
 * }
 *
 * const person: Person = { name: 'Marcelo', age: 30, greet: () => {}, meta: { tags: ['friend'] } };
 * const json = JSON.stringify(person);
 *
 * // `parsed` is a JsonSafe<Person> (i.e., `{ name: string; age?: number; meta: JsonValue }`)
 * const parsed = jsonParse<Person>(json);
 * ```
 */
export type JsonSafe<T = unknown> = T extends JsonPrimitive
  ? T
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? JsonSafe<U>[]
      : T extends readonly (infer U)[]
        ? readonly JsonSafe<U>[]
        : unknown extends T
          ? JsonValue
          : T extends JsonNonSerializable
            ? never
            : T extends object
              ? {
                  [K in keyof T as JsonSerializableValue<T[K]> extends never ? never : K]: JsonSafe<
                    JsonSerializableValue<T[K]>
                  >;
                }
              : never;

type JsonPrimitive = string | number | boolean | null;
type JsonNonSerializable = symbol | undefined | ((...args: never[]) => unknown);
type JsonSerializableValue<T> = Exclude<T, JsonNonSerializable>;

/**
 * Represents any valid JSON value that can result from `JSON.parse()` or be safely passed to `JSON.stringify()`.
 *
 * This includes:
 *
 * - Primitive values (`string`, `number`, `boolean`, `null`)
 * - Arrays of JSON values
 * - Objects whose property values are JSON values
 *
 * This type serves as a canonical, lossless description of JSON-compatible data in TypeScript. All values properly
 * assignable to `JsonValue` are safe to pass to `JSON.stringify()` without throwing.
 *
 * @example
 *
 * ```ts
 * import type { JsonValue } from 'emitnlog/utils';
 *
 * const value: JsonValue = { message: 'hello', count: 42, nested: [true, null, 'world'] };
 * const json = JSON.stringify(value); // safe
 * const parsed: JsonValue = JSON.parse(json); // safe
 * ```
 */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { [key: string]: JsonValue };
