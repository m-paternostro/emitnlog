import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { mkdir, readFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { FileWriter } from '../../../src/utils/index-node.ts';
import { createFileWriter, resolvePath } from '../../../src/utils/index-node.ts';

describe('emitnlog.utils.node.file-writer', () => {
  describe('resolvePath', () => {
    test('absolute path returns as-is', () => {
      expect(resolvePath('/absolute/path/file.txt')).toBe('/absolute/path/file.txt');
    });

    test('relative path resolved against cwd when no directory option', () => {
      expect(resolvePath('relative/file.txt')).toBe(resolve('relative/file.txt'));
    });

    test('relative path resolved against absolute directory option', () => {
      expect(resolvePath('file.txt', '/base/dir')).toBe(resolve('/base/dir', 'file.txt'));
    });

    test('relative directory option is ignored — falls back to cwd resolve', () => {
      expect(resolvePath('file.txt', 'relative/dir')).toBe(resolve('file.txt'));
    });

    test('~/ expands to home directory', () => {
      expect(resolvePath('~/file.txt')).toBe(join(homedir(), 'file.txt'));
    });

    test('~/ with nested path', () => {
      expect(resolvePath('~/foo/bar/file.txt')).toBe(join(homedir(), 'foo/bar/file.txt'));
    });

    test('absolute path ignores directory option', () => {
      expect(resolvePath('/absolute/file.txt', '/other/dir')).toBe('/absolute/file.txt');
    });
  });

  describe('createFileWriter', () => {
    let base: string;

    let counter = 0;
    const dir = () => join(base, `test-${counter}`);

    beforeAll(async () => {
      base = join(tmpdir(), `file-writer-test-${Date.now()}`);
      await mkdir(dir(), { recursive: true });
    });

    beforeEach(() => {
      counter++;
    });

    afterAll(async () => {
      await rm(base, { recursive: true, force: true });
    });

    test('filePath reflects the resolved path', () => {
      const writer = createFileWriter(join(dir(), 'test.log'));
      expect(writer.filePath).toBe(join(dir(), 'test.log'));
    });

    describe('empty path', () => {
      test('returns no-op writer with empty filePath and closed', () => {
        const writer = createFileWriter('');
        expect(writer.filePath).toBe('');
        expect(writer.isClosed()).toBe(true);
      });

      test('write and w are no-ops, flush and close resolve', async () => {
        const writer = createFileWriter('');
        writer.write('ignored');
        writer.w`also ${'ignored'}`;
        await expect(writer.flush()).resolves.toBeUndefined();
        await expect(writer.close()).resolves.toBeUndefined();
      });

      test('invokes errorHandler with error when provided', () => {
        const errorHandler = vi.fn();
        createFileWriter('', { errorHandler });
        expect(errorHandler).toHaveBeenCalledOnce();
        expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
        expect((errorHandler.mock.calls[0][0] as Error).message).toContain('file path is required');
      });

      test('does not throw when no errorHandler and path is empty', () => {
        expect(() => createFileWriter('')).not.toThrow();
      });
    });

    test('writes content with trailing newline by default', async () => {
      const writer = createFileWriter(join(dir(), 'test.log'));

      writer.write('hello');
      await writer.close();

      expect(await readFile(join(dir(), 'test.log'), 'utf-8')).toBe('hello\n');
    });

    test('skipNewLine omits trailing newline', async () => {
      const writer = createFileWriter(join(dir(), 'test.log'), { skipNewLine: true });

      writer.write('hello');
      await writer.close();

      expect(await readFile(join(dir(), 'test.log'), 'utf-8')).toBe('hello');
    });

    test('overwrite replaces on first write, appends on subsequent writes', async () => {
      const filePath = join(dir(), 'test.log');

      // First writer: seed the file
      const seed = createFileWriter(filePath);
      seed.write('seed');
      await seed.close();

      // Second writer with overwrite: first write replaces, second appends
      const writer = createFileWriter(filePath, { overwrite: true });
      writer.write('first');
      writer.write('second');
      await writer.close();

      expect(await readFile(filePath, 'utf-8')).toBe('first\nsecond\n');
    });

    test('default (no overwrite) always appends', async () => {
      const filePath = join(dir(), 'test.log');

      const first = createFileWriter(filePath);
      first.write('line1');
      await first.close();

      const second = createFileWriter(filePath);
      second.write('line2');
      await second.close();

      expect(await readFile(filePath, 'utf-8')).toBe('line1\nline2\n');
    });

    test('multiple writes are serialized and appear in order', async () => {
      const writer = createFileWriter(join(dir(), 'test.log'));

      for (let i = 0; i < 10; i++) {
        writer.write(`line ${i}`);
      }
      await writer.close();

      const content = await readFile(join(dir(), 'test.log'), 'utf-8');
      const lines = content.trimEnd().split('\n');
      expect(lines).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(lines[i]).toBe(`line ${i}`);
      }
    });

    test('write returns the writer for fluent chaining', () => {
      const writer = createFileWriter(join(dir(), 'test.log'));
      const result = writer.write('hello');
      expect(result).toBe(writer);
    });

    test('write is a no-op after close', async () => {
      const filePath = join(dir(), 'test.log');
      const writer = createFileWriter(filePath);

      writer.write('before');
      await writer.close();

      writer.write('after');
      await writer.flush();

      expect(await readFile(filePath, 'utf-8')).toBe('before\n');
    });

    test('isClosed returns false before close and true after', async () => {
      const writer = createFileWriter(join(dir(), 'test.log'));

      expect(writer.isClosed()).toBe(false);
      await writer.close();
      expect(writer.isClosed()).toBe(true);
    });

    test('close is idempotent', async () => {
      const writer = createFileWriter(join(dir(), 'test.log'));

      writer.write('content');
      await writer.close();
      await writer.close(); // second close should not throw

      expect(writer.isClosed()).toBe(true);
      expect(await readFile(join(dir(), 'test.log'), 'utf-8')).toBe('content\n');
    });

    test('flush waits for pending writes', async () => {
      const filePath = join(dir(), 'test.log');
      const writer = createFileWriter(filePath);

      writer.write('line1');
      writer.write('line2');
      await writer.flush();

      expect(await readFile(filePath, 'utf-8')).toBe('line1\nline2\n');

      writer.write('line3');
      await writer.close();

      expect(await readFile(filePath, 'utf-8')).toBe('line1\nline2\nline3\n');
    });

    test('creates parent directory if it does not exist', async () => {
      const filePath = join(dir(), 'nested', 'deep', 'test.log');
      const writer = createFileWriter(filePath);

      writer.write('hello');
      await writer.close();

      expect(await readFile(filePath, 'utf-8')).toBe('hello\n');
    });

    test('w writes a tagged template with stringify for interpolated values', async () => {
      const filePath = join(dir(), 'test.log');
      const writer = createFileWriter(filePath);

      const obj = { key: 'value' };
      writer.w`entry: ${obj}`;
      await writer.close();

      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('entry: {"key":"value"}\n');
    });

    test('w handles multiple interpolated values', async () => {
      const filePath = join(dir(), 'test.log');
      const writer = createFileWriter(filePath);

      writer.w`${1} + ${2} = ${3}`;
      await writer.close();

      expect(await readFile(filePath, 'utf-8')).toBe('1 + 2 = 3\n');
    });

    test('w is a no-op after close', async () => {
      const filePath = join(dir(), 'test.log');
      const writer = createFileWriter(filePath);

      writer.w`before`;
      await writer.close();

      writer.w`after`;
      await writer.flush();

      expect(await readFile(filePath, 'utf-8')).toBe('before\n');
    });

    test('errorHandler receives write errors', async () => {
      // Use the directory path itself as the file — writing to a directory causes EISDIR
      const errorHandler = vi.fn();
      const writer = createFileWriter(base, { errorHandler });

      writer.write('hello');
      await writer.flush();

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test('errors are swallowed when no errorHandler is provided', async () => {
      // Writing to a directory path causes an error, but it should not throw
      const writer = createFileWriter(dir());

      writer.write('hello');
      await expect(writer.flush()).resolves.toBeUndefined();
    });

    describe('with relative path and directory option', () => {
      let writer: FileWriter;

      afterAll(async () => {
        await writer.close();
      });

      test('resolves file path using directory option', async () => {
        writer = createFileWriter('output.log', { directory: dir() });

        expect(writer.filePath).toBe(join(dir(), 'output.log'));

        writer.write('content');
        await writer.flush();

        expect(await readFile(join(dir(), 'output.log'), 'utf-8')).toBe('content\n');
      });
    });
  });
});
