import { describe, expect, test } from 'vitest';

import type { LogEntry } from '../../../src/logger/log-entry.ts';
import type { JsonSafe, JsonValue } from '../../../src/utils/index.ts';
import { jsonParse, jsonStringify } from '../../../src/utils/index.ts';

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
const assertType = <T extends true>(_value: T) => undefined;

describe('emitnlog.utils.serialization', () => {
  test('parses JSON without explicit type parameter as JsonValue', () => {
    const parsed = jsonParse('{"foo": 1, "bar": [true, null]}');

    expect(parsed).toStrictEqual({ foo: 1, bar: [true, null] });

    const roundTrip: JsonValue = parsed;
    void roundTrip;

    assertType<Equal<typeof parsed, JsonValue>>(true);
  });

  test('parses serialized LogEntry without exposing unknown types', () => {
    const entry: LogEntry = {
      level: 'info',
      timestamp: 1700000000000,
      iso: '2024-01-01T00:00:00.000Z',
      message: 'Operation completed',
      args: [{ foo: 'bar' }, 42, ['nested']] as const,
    };

    const serialized = JSON.stringify(entry);
    const parsed = jsonParse<LogEntry>(serialized);

    expect(parsed).toStrictEqual(entry);

    type Expected = {
      readonly level: LogEntry['level'];
      readonly timestamp: number;
      readonly iso: string;
      readonly message: string;
      readonly args?: readonly JsonValue[];
    };

    const parsedLogEntry: JsonSafe<LogEntry> = parsed;
    void parsedLogEntry;

    assertType<Equal<typeof parsed, JsonSafe<LogEntry>>>(true);
    assertType<Equal<typeof parsed, Expected>>(true);
  });

  test('drops non-JSON-safe properties while converting dates to strings', () => {
    type Complex = {
      readonly id: string;
      readonly createdAt: Date;
      readonly optional?: number;
      readonly skip?: undefined;
      readonly note?: string | (() => string);
      readonly meta: { value: unknown };
      readonly readonlyMeta: { readonly value: unknown };
      readonly onInit?: () => void;
      readonly token?: symbol;
      readonly nested: { readonly values: readonly [Date, { readonly when?: Date | undefined }] };
      array: string[];
      readonly notHere?: undefined;
      readonly readonlyArray: readonly string[];
    };

    const complex: Complex = {
      id: 'abc',
      createdAt: new Date('2024-01-02T03:04:05.006Z'),
      optional: 7,
      note: 'hello there',
      meta: { value: { ok: true } },
      readonlyMeta: { value: { regex: /test/gi } },
      onInit: () => {
        // noop
      },
      token: Symbol('secret'),
      nested: { values: [new Date('2023-04-05T06:07:08.009Z'), { when: new Date('2022-10-11T12:13:14.015Z') }] },
      array: ['foo', 'bar'],
      readonlyArray: ['1', '2'],
    };

    const parsed = jsonParse<Complex>(JSON.stringify(complex));

    expect(parsed).toStrictEqual({
      id: 'abc',
      createdAt: '2024-01-02T03:04:05.006Z',
      optional: 7,
      note: 'hello there',
      meta: { value: { ok: true } },
      readonlyMeta: { value: { regex: {} } },
      nested: { values: ['2023-04-05T06:07:08.009Z', { when: '2022-10-11T12:13:14.015Z' }] },
      array: ['foo', 'bar'],
      readonlyArray: ['1', '2'],
    });

    const parsedComplex: JsonSafe<Complex> = parsed;
    void parsedComplex;

    type ParsedComplexType = typeof parsed;

    assertType<Equal<ParsedComplexType, JsonSafe<Complex>>>(true);
    assertType<Equal<ParsedComplexType['createdAt'], string>>(true);
    assertType<Equal<ParsedComplexType['note'], string | undefined>>(true);
    assertType<Equal<ParsedComplexType['nested']['values'][number] extends JsonValue ? true : false, true>>(true);
    assertType<Equal<ParsedComplexType['skip'], undefined>>(true);

    // @ts-expect-error onInit is omitted because functions are not preserved by JSON.parse
    expect(parsed.onInit).toBeUndefined();
    expect(parsed).not.toHaveProperty('onInit');

    // @ts-expect-error token is omitted because symbols cannot be serialized
    expect(parsed.token).toBeUndefined();
    expect(parsed).not.toHaveProperty('token');

    expect(parsed.skip).toBeUndefined();
    expect(parsed).not.toHaveProperty('skip');
  });

  test('stringifies JsonSafe values without throwing', () => {
    const parsed = jsonParse<{ readonly foo: string; readonly count?: number }>('{"foo":"bar","count":1}');

    expect(jsonStringify(parsed)).toBe('{"foo":"bar","count":1}');

    const json: string = jsonStringify(parsed);
    void json;
  });

  test('supports replacer and space formatting options', () => {
    const parsed = jsonParse<{ readonly foo: string; readonly secret?: string }>('{"foo":"bar","secret":"nope"}');

    const replacer = (key: string, value: unknown) => (key === 'secret' ? undefined : value);
    const formatted = jsonStringify(parsed, replacer, 2);

    expect(formatted).toBe('{\n  "foo": "bar"\n}');
  });

  test('round trips JsonSafe values', () => {
    type SimpleObject = { readonly name: string };
    const objects = [{ name: 'Alice' }, { name: 'Bob' }];
    const roundTrip = jsonParse<readonly SimpleObject[]>(jsonStringify(objects));
    expect(roundTrip).toStrictEqual(objects);
  });

  test('type assignments with JsonSafe', () => {
    const load = <T extends JsonSafe>(value: T): T => value;

    const array = load<string[]>(['a', 'b', 'c']);
    assertType<Equal<typeof array, string[]>>(true);
    // @ts-expect-error array is writable
    assertType<Equal<typeof array, readonly string[]>>(true);
    void array;

    const readonlyArray = load<readonly string[]>(['a', 'b', 'c']);
    assertType<Equal<typeof readonlyArray, readonly string[]>>(true);
    // @ts-expect-error readonlyArray is readonly
    assertType<Equal<typeof readonlyArray, string[]>>(true);
    void readonlyArray;

    const object = load<{ foo: string }>({ foo: 'bar' });
    assertType<Equal<typeof object, { foo: string }>>(true);
    // @ts-expect-error object is writable
    assertType<Equal<typeof object, { readonly foo: string }>>(true);
    // @ts-expect-error object is required
    assertType<Equal<typeof object, { foo?: string }>>(true);
    void object;

    const partialObject = load<{ foo?: string }>({ foo: 'bar' });
    assertType<Equal<typeof partialObject, { foo?: string }>>(true);
    // @ts-expect-error object is writable
    assertType<Equal<typeof partialObject, { readonly foo: string }>>(true);
    // @ts-expect-error partialObject is partial
    assertType<Equal<typeof partialObject, { foo: string }>>(true);
    void partialObject;

    const readonlyObject = load<{ readonly foo: string }>({ foo: 'bar' });
    assertType<Equal<typeof readonlyObject, { readonly foo: string }>>(true);
    // @ts-expect-error readonlyObject is readonly
    assertType<Equal<typeof readonlyObject, { foo: string }>>(true);
    // @ts-expect-error object is required
    assertType<Equal<typeof readonlyObject, { readonly foo?: string }>>(true);
    void readonlyObject;

    const readonlyPartialObject = load<{ readonly foo?: string }>({ foo: 'bar' });
    assertType<Equal<typeof readonlyPartialObject, { readonly foo?: string }>>(true);
    // @ts-expect-error readonlyPartialObject is readonly
    assertType<Equal<typeof readonlyPartialObject, { foo?: string }>>(true);
    // @ts-expect-error readonlyPartialObject is required
    assertType<Equal<typeof readonlyPartialObject, { readonly foo: string }>>(true);
    void readonlyPartialObject;
  });

  test('type assignments with JsonValue', () => {
    const load = <T extends JsonValue>(value: T): T => value;

    const array = load<string[]>(['a', 'b', 'c']);
    assertType<Equal<typeof array, string[]>>(true);
    // @ts-expect-error array is writable
    assertType<Equal<typeof array, readonly string[]>>(true);
    void array;

    const readonlyArray = load<readonly string[]>(['a', 'b', 'c']);
    assertType<Equal<typeof readonlyArray, readonly string[]>>(true);
    // @ts-expect-error readonlyArray is readonly
    assertType<Equal<typeof readonlyArray, string[]>>(true);
    void readonlyArray;

    const object = load<{ foo: string }>({ foo: 'bar' });
    assertType<Equal<typeof object, { foo: string }>>(true);
    // @ts-expect-error object is writable
    assertType<Equal<typeof object, { readonly foo: string }>>(true);
    // @ts-expect-error object is required
    assertType<Equal<typeof object, { foo?: string }>>(true);
    void object;

    const partialObject = load<{ foo?: string }>({ foo: 'bar' });
    assertType<Equal<typeof partialObject, { foo?: string }>>(true);
    // @ts-expect-error object is writable
    assertType<Equal<typeof partialObject, { readonly foo: string }>>(true);
    // @ts-expect-error partialObject is partial
    assertType<Equal<typeof partialObject, { foo: string }>>(true);
    void partialObject;

    const readonlyObject = load<{ readonly foo: string }>({ foo: 'bar' });
    assertType<Equal<typeof readonlyObject, { readonly foo: string }>>(true);
    // @ts-expect-error readonlyObject is readonly
    assertType<Equal<typeof readonlyObject, { foo: string }>>(true);
    // @ts-expect-error object is required
    assertType<Equal<typeof readonlyObject, { readonly foo?: string }>>(true);
    void readonlyObject;

    const readonlyPartialObject = load<{ readonly foo?: string }>({ foo: 'bar' });
    assertType<Equal<typeof readonlyPartialObject, { readonly foo?: string }>>(true);
    // @ts-expect-error readonlyPartialObject is readonly
    assertType<Equal<typeof readonlyPartialObject, { foo?: string }>>(true);
    // @ts-expect-error readonlyPartialObject is required
    assertType<Equal<typeof readonlyPartialObject, { readonly foo: string }>>(true);
    void readonlyPartialObject;
  });

  test('should handle jsonStringify and jsonParse with JsonValue', () => {
    const data: Record<string, JsonValue> = {};
    data.key = 'value1';

    const content = jsonStringify(data);
    const parsed = jsonParse<Record<string, JsonValue>>(content);
    expect(parsed).not.toBe(data);
    expect(parsed).toEqual(data);
    assertType<Equal<typeof parsed, Record<string, JsonValue>>>(true);

    assertType<Equal<JsonSafe<string[]>, string[]>>(true);
  });

  test('should yield the right type for JsonSafe<...>', () => {
    assertType<Equal<JsonSafe<string[]>, string[]>>(true);
    assertType<Equal<JsonSafe<readonly string[]>, readonly string[]>>(true);
  });
});
