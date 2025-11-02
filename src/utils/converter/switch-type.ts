/**
 * For the given type T, "deep-switches" the types specified in the Mappings tuples.
 *
 * This type can be used when it is desirable to ensure that a given structure (`T`) does not contain certain type. A
 * good example is serialization, where we want to ensure that "instance of classes" (like URIs) are not present.
 *
 * @example
 *
 * ```ts
 * // Switched1 is { a: number, b: number }
 * type Switched1 = SwitchType<{ a: string; b: number; c: boolean }, [string, number] | [boolean, number]>;
 *
 * // Switched2 is { a: number, b: { c: number[], d: number[] } }
 * type Switched2 = SwitchType<{ a: string; b: { c: number[]; d: string[] } }, [string, number]>;
 * ```
 */
export type SwitchType<T, Mappings extends [unknown, unknown]> = T extends Mappings[0] // Check if T matches the source type in Mappings
  ? Extract<MappingTarget<T, Mappings>, unknown> // Replace with the target type
  : T extends unknown[] // Handle arrays
    ? SwitchType<T[number], Mappings>[] // Recursively apply SwitchType to array elements
    : T extends readonly unknown[] // Handle arrays
      ? readonly SwitchType<T[number], Mappings>[] // Recursively apply SwitchType to array elements
      : T extends object // Handle objects
        ? { [K in keyof T]: SwitchType<T[K], Mappings> } // Recursively map object properties
        : T; // Otherwise, return the original type

type MappingTarget<Source, Mappings extends [unknown, unknown]> = Mappings extends [infer Src, infer Target]
  ? Source extends Src
    ? Target
    : never
  : never;
