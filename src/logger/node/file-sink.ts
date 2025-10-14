import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { Simplify } from 'type-fest';

import { errorify } from '../../utils/converter/errorify.ts';
import type { LogSink } from '../emitter/common.ts';
import type { LogFormatter } from '../emitter/formatter.ts';
import { plainFormatter } from '../emitter/formatter.ts';
import type { AsyncFinalizer } from '../implementation/finalizer.ts';

/**
 * Configuration options for the file sink.
 */
export type FileSinkOptions = {
  /**
   * Whether to prepend a local date (yyyyMMdd-hhmmss_) to the file name.
   *
   * @default false
   */
  readonly datePrefix?: boolean;

  /**
   * Whether to overwrite an existing file on the first emitted or not (the default is to always append new log
   * entries).
   *
   * @default false
   */
  readonly overwrite?: boolean;

  /**
   * File encoding.
   *
   * @default 'utf8'
   */
  readonly encoding?: BufferEncoding;

  /**
   * File mode (permissions) for new files.
   *
   * @default 0o666
   */
  readonly mode?: number;

  /**
   * Error handler callback for file operations If not provided, errors will be thrown
   */
  readonly errorHandler?: (error: unknown) => void;

  /**
   * A options to customize the content of the file.
   */
  readonly layout?: {
    /**
     * The content to write right before the first log entry written by the logger.
     *
     * The first log entry is appended immediately after this value, so this value should include any line break or
     * other formatting needed.
     *
     * Important: the header is always written before the first entry, regardless of the value of the `overwrite`
     * property.
     */
    readonly header?: string;

    /**
     * The content to write right after the last log entry written by the logger.
     *
     * The footer is appended immediately after the last log entry when the file sink is closed so this value should
     * include any line break or other formatting needed.
     *
     * Important: the footer is only written if the sink is closed.
     *
     * @default '\n'
     */
    readonly footer?: string;

    /**
     * The delimiter to use between entries.
     *
     * @default '\n'
     */
    readonly entryLineDelimiter?: string;
  };
};

/**
 * A layout to be used as `FileSinkOptions.layout` to output a valid JSON-like content if each entry is itself a valid
 * JSON object - like the entries provided by the `jsonCompactFormatter` and `jsonPrettyFormatter` formatters.
 */
export const JSON_LAYOUT = { header: '[\n', footer: '\n]', entryLineDelimiter: ',\n' } as const satisfies NonNullable<
  FileSinkOptions['layout']
>;

export type FileSink = Simplify<
  AsyncFinalizer<LogSink> & {
    /**
     * The path to the log file
     */
    readonly filePath: string;
  }
>;

/**
 * Creates a file log sink that writes logs directly to a file.
 *
 * This sink writes each log entry immediately without buffering. For better performance with high-volume logging, wrap
 * this with batchSink.
 *
 * Features:
 *
 * - Immediate writes (no buffering)
 * - Automatic directory creation
 * - Home directory expansion
 * - Graceful error handling
 *
 * Regarding the `filePath` argument:
 *
 * - Absolute paths are used as-is
 * - Relative paths are resolved from current working directory
 * - Paths starting with ~ are expanded to home directory
 * - Simple filenames without path separators are placed in OS temp directory
 *
 * @example Basic usage
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 * import { fileSink } from 'emitnlog/logger/node';
 *
 * const logger = emitter.createLogger('info', fileSink('/var/log/app.log'));
 * ```
 *
 * @example With batching for performance
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 * import { fileSink } from 'emitnlog/logger/node';
 *
 * const logger = emitter.createLogger(
 *   'info',
 *   emitter.batchSink(fileSink('/logs/app.log'), { maxBufferSize: 100, flushDelayMs: 1000 }),
 * );
 * ```
 *
 * @param filePath The path to the log file.
 */
export const fileSink = (
  filePath: string,
  formatter: LogFormatter = plainFormatter,
  options?: FileSinkOptions,
): FileSink => {
  if (!filePath) {
    throw new Error('InvalidArgument: file path is required');
  }

  const config = {
    datePrefix: options?.datePrefix ?? false,
    overwrite: options?.overwrite ?? false,
    encoding: options?.encoding ?? 'utf8',
    mode: options?.mode ?? 0o666,
    errorHandler:
      options?.errorHandler ??
      ((error) => {
        throw errorify(error);
      }),
    layout: { entryLineDelimiter: '\n', footer: '\n', ...options?.layout } as const,
  } as const satisfies FileSinkOptions;

  let resolvedPath: string;
  if (filePath.includes(path.sep)) {
    if (filePath.startsWith('~')) {
      resolvedPath = path.join(os.homedir(), filePath.substring(1));
    } else if (path.isAbsolute(filePath)) {
      resolvedPath = filePath;
    } else {
      resolvedPath = path.resolve(filePath);
    }
  } else {
    resolvedPath = path.join(os.tmpdir(), filePath);
  }

  if (config.datePrefix) {
    const now = new Date();
    const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    resolvedPath = path.join(path.dirname(resolvedPath), `${datePrefix}_${path.basename(resolvedPath)}`);
  }

  let initialized = false;
  let closed = false;
  let isAppending = !config.overwrite;
  let writeQueue = Promise.resolve();
  let isFirstEntry = true;

  const ensureDirectory = async (): Promise<void> => {
    if (initialized) {
      return;
    }

    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });
    initialized = true;
  };

  const writeMessage = async (message: string): Promise<void> => {
    await ensureDirectory();

    if (isAppending) {
      await fs.appendFile(resolvedPath, message, { encoding: config.encoding, mode: config.mode });
    } else {
      await fs.writeFile(resolvedPath, message, { encoding: config.encoding, mode: config.mode });
      // After first write, always append
      isAppending = true;
    }
  };

  const queueMessage = (message: string): void => {
    writeQueue = writeQueue.then(() => writeMessage(message).catch((error: unknown) => config.errorHandler(error)));
  };

  const header = config.layout.header;
  if (header) {
    queueMessage(header);
  }

  const lineDelimiter = config.layout.entryLineDelimiter;

  return {
    sink: (level, message, args): void => {
      if (closed) {
        return;
      }

      // Format the message immediately to ensure correct timestamp
      const formattedMessage = formatter(level, message, args);

      // Prepend delimiter to all entries except the first
      if (isFirstEntry) {
        queueMessage(formattedMessage);
        isFirstEntry = false;
      } else {
        queueMessage(lineDelimiter + formattedMessage);
      }
    },

    filePath: resolvedPath,

    async flush(): Promise<void> {
      await writeQueue;
    },

    async close(): Promise<void> {
      if (closed) {
        return;
      }

      closed = true;

      const footer = config.layout.footer;
      if (footer) {
        queueMessage(footer);
      }
      await writeQueue;
    },
  };
};
