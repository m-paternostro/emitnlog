import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { errorify } from '../../utils/converter/errorify.ts';
import type { LogLevel } from '../definition';
import { type LogFormatter, type LogSink, plainFormatter } from '../emitter';
import type { AsyncFinalizer } from '../implementation/types.ts';

/**
 * Configuration options for the file sink.
 */
export type FileSinkOptions = {
  /**
   * The path to the log file.
   *
   * - Absolute paths are used as-is
   * - Relative paths are resolved from current working directory
   * - Paths starting with ~ are expanded to home directory
   * - Simple filenames without path separators are placed in OS temp directory
   */
  readonly filePath: string;

  /**
   * Whether to prepend a local date (yyyyMMdd-hhmmss_) to the file name.
   *
   * @default false
   */
  readonly datePrefix?: boolean;

  /**
   * Whether to append to existing file (true) or overwrite (false).
   *
   * @default true
   */
  readonly append?: boolean;

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
   * The formatter to use for the log entries. Defaults to 'plainFormatter'.
   *
   * @default plainFormatter
   */
  readonly formatter?: LogFormatter;

  /**
   * Error handler callback for file operations If not provided, errors will be thrown
   */
  readonly errorHandler?: (error: unknown) => void;
};

export type FileSink = AsyncFinalizer<LogSink> & { readonly filePath: string };

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
 * Note: This sink only writes the formatted message to the file. Use formatters like plainFormatter() and
 * jsonCompactFormatter() to include timestamps and log levels in your output.
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
 */
export const fileSink = (options: FileSinkOptions | string): FileSink => {
  if (typeof options === 'string') {
    options = { filePath: options };
  }

  const config = {
    filePath: options.filePath,
    datePrefix: options.datePrefix ?? false,
    append: options.append ?? true,
    encoding: options.encoding ?? 'utf8',
    mode: options.mode ?? 0o666,
    formatter: options.formatter ?? plainFormatter,
    errorHandler:
      options.errorHandler ??
      ((error) => {
        throw errorify(error);
      }),
  } as const satisfies FileSinkOptions;

  let resolvedPath: string;
  if (config.filePath.includes(path.sep)) {
    if (config.filePath.startsWith('~')) {
      resolvedPath = path.join(os.homedir(), config.filePath.substring(1));
    } else if (path.isAbsolute(config.filePath)) {
      resolvedPath = config.filePath;
    } else {
      resolvedPath = path.resolve(config.filePath);
    }
  } else {
    resolvedPath = path.join(os.tmpdir(), config.filePath);
  }

  if (config.datePrefix) {
    const now = new Date();
    const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    resolvedPath = path.join(path.dirname(resolvedPath), `${datePrefix}_${path.basename(resolvedPath)}`);
  }

  let initialized = false;
  let isAppending = config.append;
  let writeQueue = Promise.resolve();

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
      await fs.appendFile(resolvedPath, message + '\n', { encoding: config.encoding, mode: config.mode });
    } else {
      await fs.writeFile(resolvedPath, message + '\n', { encoding: config.encoding, mode: config.mode });
      // After first write, always append
      isAppending = true;
    }
  };

  return {
    sink: (_level: LogLevel, message: string): void => {
      // Queue the write to maintain order, catching errors to prevent unhandled rejections
      writeQueue = writeQueue.then(() => writeMessage(message).catch((error: unknown) => config.errorHandler(error)));
    },

    filePath: resolvedPath,

    async flush(): Promise<void> {
      await writeQueue;
    },

    async close(): Promise<void> {
      await writeQueue;
    },
  };
};
