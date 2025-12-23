import { describe, expect, test } from 'vitest';

import type { LogEntry } from '../../../src/logger/log-entry.ts';
import type { JsonSafe } from '../../../src/utils/index.ts';
import { parseLines } from '../../../src/utils/index.ts';

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
const assertType = <T extends true>(_value: T) => undefined;

describe('emitnlog.utils.parseLines', () => {
  test('parses multiple JSON lines into an array', () => {
    const value = [
      '{"level":"info","timestamp":1705312245123,"message":"Application started"}',
      '{"level":"error","timestamp":1705312246456,"message":"Connection failed","args":[{"host":"db.example.com"}]}',
    ].join('\n');

    const result = parseLines(value);

    expect(result).toStrictEqual([
      { level: 'info', timestamp: 1705312245123, message: 'Application started' },
      { level: 'error', timestamp: 1705312246456, message: 'Connection failed', args: [{ host: 'db.example.com' }] },
    ]);
  });

  test('parses typed JSON lines with proper type inference', () => {
    const value = [
      '{"level":"info","timestamp":1705312245123,"message":"Application started"}',
      '{"level":"warn","timestamp":1705312246456,"message":"Low memory"}',
    ].join('\n');

    const result = parseLines<LogEntry>(value);

    expect(result).toStrictEqual([
      { level: 'info', timestamp: 1705312245123, message: 'Application started' },
      { level: 'warn', timestamp: 1705312246456, message: 'Low memory' },
    ]);

    assertType<Equal<typeof result, readonly JsonSafe<LogEntry>[]>>(true);
  });

  test('returns empty array for empty string', () => {
    const result = parseLines('');

    expect(result).toStrictEqual([]);
    expect(result).toHaveLength(0);
  });

  test('returns empty array for whitespace-only string', () => {
    const result = parseLines('   \n\t\n   ');

    expect(result).toStrictEqual([]);
    expect(result).toHaveLength(0);
  });

  test('skips empty lines', () => {
    const value = ['{"name":"Alice"}', '', '{"name":"Bob"}', '   ', '{"name":"Charlie"}'].join('\n');

    const result = parseLines(value);

    expect(result).toStrictEqual([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }]);
  });

  test('parses a single JSON line', () => {
    const value = '{"status":"ok","code":200}';

    const result = parseLines(value);

    expect(result).toStrictEqual([{ status: 'ok', code: 200 }]);
  });

  test('ignores invalid lines when at least one valid line exists', () => {
    const value = ['{"valid":"first"}', 'invalid json here', '{"valid":"second"}', 'another bad line'].join('\n');

    const result = parseLines(value);

    expect(result).toStrictEqual([{ valid: 'first' }, { valid: 'second' }]);
  });

  test('throws when all lines are invalid', () => {
    const value = ['invalid json', 'another bad line', 'still not json'].join('\n');

    expect(() => parseLines(value)).toThrow();
  });

  test('throws when single line is invalid', () => {
    const value = 'not valid json at all';

    expect(() => parseLines(value)).toThrow(SyntaxError);
  });

  test('calls onError callback for each invalid line', () => {
    const errors: { error: Error; line: string }[] = [];
    const value = ['{"valid":"first"}', 'invalid json here', '{"valid":"second"}', 'another bad line'].join('\n');

    const result = parseLines(value, {
      onError: (error, line) => {
        errors.push({ error, line });
      },
    });

    expect(result).toStrictEqual([{ valid: 'first' }, { valid: 'second' }]);

    expect(errors).toHaveLength(2);
    expect(errors[0].line).toBe('invalid json here');
    expect(errors[0].error).toBeInstanceOf(SyntaxError);
    expect(errors[1].line).toBe('another bad line');
    expect(errors[1].error).toBeInstanceOf(SyntaxError);
  });

  test('propagates error thrown by onError callback', () => {
    const value = ['{"valid":"first"}', 'invalid json here', '{"valid":"second"}'].join('\n');

    class CustomError extends Error {
      public constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }

    expect(() =>
      parseLines(value, {
        onError: (error, line) => {
          throw new CustomError(`Failed to parse: ${line} - ${error.message}`);
        },
      }),
    ).toThrow(CustomError);
  });

  test('collects errors via onError but does not throw when valid lines exist', () => {
    const errors: string[] = [];
    const value = ['{"id":1}', 'bad', '{"id":2}', 'also bad'].join('\n');

    const result = parseLines(value, {
      onError: (_error, line) => {
        errors.push(line);
      },
    });

    expect(result).toStrictEqual([{ id: 1 }, { id: 2 }]);
    expect(errors).toStrictEqual(['bad', 'also bad']);
  });

  test('throws the last error when all lines fail and onError does not throw', () => {
    let lastError: Error | undefined;
    const value = ['bad line 1', 'bad line 2', 'bad line 3'].join('\n');

    expect(() =>
      parseLines(value, {
        onError: (error) => {
          lastError = error;
        },
      }),
    ).toThrow();

    expect(lastError).toBeInstanceOf(SyntaxError);
  });

  test('handles JSON primitives on each line', () => {
    const value = ['0', '"hello"', 'true', 'null'].join('\n');

    const result = parseLines(value);

    expect(result).toStrictEqual([0, 'hello', true]);
  });

  test('handles JSON primitives on each line with keepNull option', () => {
    const value = ['0', '"hello"', 'true', 'null'].join('\n');

    const result = parseLines(value, { keepNull: true });

    expect(result).toStrictEqual([0, 'hello', true, null]);
  });

  test('handles arrays on each line', () => {
    const value = ['[1,2,3]', '["a","b"]'].join('\n');

    const result = parseLines(value);

    expect(result).toStrictEqual([
      [1, 2, 3],
      ['a', 'b'],
    ]);
  });

  test('handles nested objects', () => {
    const value = ['{"user":{"name":"Alice","age":30}}', '{"user":{"name":"Bob","age":25}}'].join('\n');

    const result = parseLines(value);

    expect(result).toStrictEqual([{ user: { name: 'Alice', age: 30 } }, { user: { name: 'Bob', age: 25 } }]);
  });

  test('handles trailing newline', () => {
    const value = '{"id":1}\n{"id":2}\n';

    const result = parseLines(value);

    expect(result).toStrictEqual([{ id: 1 }, { id: 2 }]);
  });

  test('handles leading newline', () => {
    const value = '\n{"id":1}\n{"id":2}';

    const result = parseLines(value);

    expect(result).toStrictEqual([{ id: 1 }, { id: 2 }]);
  });

  test('handles multiple consecutive newlines', () => {
    const value = '{"id":1}\n\n\n{"id":2}';

    const result = parseLines(value);

    expect(result).toStrictEqual([{ id: 1 }, { id: 2 }]);
  });

  test('parses real NDJSON log format', () => {
    const value = [
      '{"level":"info","timestamp":1700000000000,"message":"Server started","args":[{"port":3000}]}',
      '{"level":"debug","timestamp":1700000001000,"message":"Processing request"}',
      '{"level":"error","timestamp":1700000002000,"message":"Database error","args":[{"code":"ECONNREFUSED"}]}',
      '{"level":"info","timestamp":1700000003000,"message":"Request completed","args":[{"duration":125}]}',
    ].join('\n');

    const result = parseLines<LogEntry>(value);

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ level: 'info', message: 'Server started' });
    expect(result[1]).toMatchObject({ level: 'debug', message: 'Processing request' });
    expect(result[2]).toMatchObject({ level: 'error', message: 'Database error' });
    expect(result[3]).toMatchObject({ level: 'info', message: 'Request completed' });
  });

  test('ignores lines with only null by default', () => {
    const value = 'null\nnull';

    const result = parseLines(value);

    expect(result).toStrictEqual([]);
  });

  test('keep lines with only null when keepNull option is true', () => {
    const value = 'null\nnull';

    const result = parseLines(value, { keepNull: true });

    expect(result).toStrictEqual([null, null]);
  });

  test('skips lines that parse to undefined or empty', () => {
    const value = ['{"valid":true}', '{}', '{"another":"valid"}'].join('\n');

    const result = parseLines(value);

    expect(result).toStrictEqual([{ valid: true }, {}, { another: 'valid' }]);
  });
});
