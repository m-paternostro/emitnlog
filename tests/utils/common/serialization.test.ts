import { describe, expect, test } from 'vitest';

import type { LogEntry } from '../../../src/logger/log-entry.ts';
import type { JsonSafe, JsonValue } from '../../../src/utils/index.ts';
import { jsonParse } from '../../../src/utils/index.ts';

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
      message: 'Operation completed',
      args: [{ foo: 'bar' }, 42, ['nested']] as const,
    };

    const serialized = JSON.stringify(entry);
    const parsed = jsonParse<LogEntry>(serialized);

    expect(parsed).toStrictEqual({
      level: 'info',
      timestamp: 1700000000000,
      message: 'Operation completed',
      args: [{ foo: 'bar' }, 42, ['nested']],
    });

    type Expected = {
      readonly level: LogEntry['level'];
      readonly timestamp: number;
      readonly message: string;
      readonly args?: JsonValue[];
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
      readonly meta: { readonly value: unknown };
      readonly onInit?: () => void;
      readonly token?: symbol;
      readonly nested: { readonly values: readonly [Date, { readonly when?: Date | undefined }] };
    };

    const complex: Complex = {
      id: 'abc',
      createdAt: new Date('2024-01-02T03:04:05.006Z'),
      optional: 7,
      note: 'hello there',
      meta: { value: { ok: true } },
      onInit: () => {
        // noop
      },
      token: Symbol('secret'),
      nested: { values: [new Date('2023-04-05T06:07:08.009Z'), { when: new Date('2022-10-11T12:13:14.015Z') }] },
    };

    const parsed = jsonParse<Complex>(JSON.stringify(complex));

    expect(parsed).toStrictEqual({
      id: 'abc',
      createdAt: '2024-01-02T03:04:05.006Z',
      optional: 7,
      note: 'hello there',
      meta: { value: { ok: true } },
      nested: { values: ['2023-04-05T06:07:08.009Z', { when: '2022-10-11T12:13:14.015Z' }] },
    });

    const parsedComplex: JsonSafe<Complex> = parsed;
    void parsedComplex;

    type ParsedComplexType = typeof parsed;

    assertType<Equal<ParsedComplexType, JsonSafe<Complex>>>(true);
    assertType<Equal<ParsedComplexType['createdAt'], string>>(true);
    assertType<Equal<ParsedComplexType['note'], string | undefined>>(true);
    assertType<Equal<ParsedComplexType['nested']['values'][number] extends JsonValue ? true : false, true>>(true);

    // @ts-expect-error onInit is omitted because functions are not preserved by JSON.parse
    expect(parsed.onInit).toBeUndefined();
    expect(parsed).not.toHaveProperty('onInit');

    // @ts-expect-error token is omitted because symbols cannot be serialized
    expect(parsed.token).toBeUndefined();
    expect(parsed).not.toHaveProperty('token');

    // @ts-expect-error skip is omitted because undefined-only properties are dropped
    expect(parsed.skip).toBeUndefined();
    expect(parsed).not.toHaveProperty('skip');
  });
});
