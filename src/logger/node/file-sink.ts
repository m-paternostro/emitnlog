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
};

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
    sink: (level, message, args): void => {
      if (closed) {
        return;
      }

      // Format the message immediately to ensure correct timestamp
      const formattedMessage = formatter(level, message, args);

      // Queue the write to maintain order, catching errors to prevent unhandled rejections
      writeQueue = writeQueue.then(() =>
        writeMessage(formattedMessage).catch((error: unknown) => config.errorHandler(error)),
      );
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
      await writeQueue;
    },
  };
};
