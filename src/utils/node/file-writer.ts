import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { stringify } from '../converter/stringify.ts';

/**
 * A sequential, queue-based file writer. Writes are buffered in order and flushed asynchronously. The writer is safe to
 * use from concurrent call sites — all writes are serialized through an internal queue.
 */
export type FileWriter = {
  /**
   * The resolved absolute path of the file being written to.
   */
  readonly filePath: string;

  /**
   * Tagged template shorthand for {@link write}. Interpolated values are converted to strings via `stringify`. No-op
   * after {@link close} has been called.
   *
   * @example
   *
   * ```typescript
   * writer.w`entry ${index}: ${payload}`;
   * ```
   */
  readonly w: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Enqueues content to be written to the file. Returns the writer for fluent chaining. No-op after {@link close} has
   * been called.
   *
   * @param content The content to write.
   * @returns The writer for fluent chaining.
   */
  readonly write: (content: string) => FileWriter;

  /**
   * Waits for all previously enqueued writes to complete.
   */
  readonly flush: () => Promise<void>;

  /**
   * Returns true if the writer is closed.
   *
   * @returns A boolean indicating if the writer is closed.
   */
  readonly isClosed: () => boolean;

  /**
   * Marks the writer as closed and waits for all pending writes to complete. Subsequent writes are ignored.
   */
  readonly close: () => Promise<void>;
};

/**
 * Options for {@link createFileWriter}.
 */
type FileWriterOptions = {
  /**
   * Whether to overwrite the file on the first write. Subsequent writes always append.
   *
   * @default false
   */
  readonly overwrite?: boolean;

  /**
   * By default a newline is appended to every write. Set to `true` to disable this behavior.
   *
   * @default false
   */
  readonly skipNewLine?: boolean;

  /**
   * Base directory used when `file` is a relative path. Ignored if the `file` path is already absolute or if this value
   * is not itself absolute.
   *
   * @default the directory yielded by Node's `path.resolve`.
   */
  readonly directory?: string;

  /**
   * Character encoding for file operations.
   *
   * @default Node's default (`'utf8'`).
   */
  readonly encoding?: BufferEncoding;

  /**
   * File mode (permission bits) applied when creating the file.
   *
   * @default Node's default.
   */
  readonly mode?: number;

  /**
   * Error handler callback for file operations. If not provided, errors are silently ignored.
   */
  readonly errorHandler?: (error: unknown) => void;
};

/**
 * Creates a {@link FileWriter} that writes to the given file path. The parent directory is created on the first write if
 * it does not already exist.
 *
 * If `file` is empty or falsy, returns a no-op writer (closed immediately, `filePath` is `''`) and, if provided,
 * invokes `options.errorHandler` with an error before returning.
 *
 * @param file The file path. May be absolute, relative, or start with `~/` (expanded to the user's home directory).
 * @param options Writer configuration.
 * @returns A new file writer.
 */
export const createFileWriter = (file: string, options?: FileWriterOptions): FileWriter => {
  if (!file) {
    options?.errorHandler?.(new Error('InvalidArgument: file path is required'));

    const writer: FileWriter = {
      filePath: '',
      w: () => void 0,
      write: () => writer,
      flush: () => Promise.resolve(),
      isClosed: () => true,
      close: () => Promise.resolve(),
    };
    return writer;
  }

  const resolvedPath = resolvePath(file, options?.directory);

  let initPromise: Promise<void> | undefined;
  const ensureDirectory = (): Promise<void> =>
    (initPromise ??= mkdir(dirname(resolvedPath), { recursive: true }).then(() => void 0));

  let needsOverwrite = options?.overwrite;
  const fileOptions = { encoding: options?.encoding, mode: options?.mode };
  const writeMessage = async (message: string): Promise<void> => {
    await ensureDirectory();

    if (needsOverwrite) {
      await writeFile(resolvedPath, message, fileOptions);
      needsOverwrite = false;
    } else {
      await appendFile(resolvedPath, message, fileOptions);
    }
  };

  let writeQueue = Promise.resolve();
  const queueMessage = (message: string): void => {
    writeQueue = writeQueue.then(() => writeMessage(message).catch((error: unknown) => options?.errorHandler?.(error)));
  };

  let closed = false;

  const writer: FileWriter = {
    filePath: resolvedPath,

    w: (strings, ...values) => {
      const content = String.raw(strings, ...values.map((v) => stringify(v)));
      writer.write(content);
    },

    write: (content) => {
      if (!closed) {
        if (!options?.skipNewLine) {
          content += '\n';
        }
        queueMessage(content);
      }
      return writer;
    },

    flush(): Promise<void> {
      return writeQueue;
    },

    isClosed: () => closed,

    close(): Promise<void> {
      closed = true;
      return writeQueue;
    },
  };

  return writer;
};

/**
 * Resolves a file path to an absolute path. Supports `~/` expansion (user home directory) and an optional base
 * directory for relative paths.
 *
 * @param path The file path to resolve.
 * @param directory Optional base directory for relative paths. Ignored if not absolute.
 * @returns The resolved absolute path.
 */
export const resolvePath = (path: string, directory?: string): string => {
  if (path.startsWith('~/')) {
    path = join(homedir(), path.slice(2));
  }

  if (!isAbsolute(path)) {
    path = directory && isAbsolute(directory) ? resolve(directory, path) : resolve(path);
  }

  return path;
};
