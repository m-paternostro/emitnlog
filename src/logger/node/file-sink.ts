import * as os from 'node:os';
import * as path from 'node:path';

import type { Simplify } from 'type-fest';

import { errorify } from '../../utils/converter/errorify.ts';
import { createFileWriter } from '../../utils/node/file-writer.ts';
import type { LogFormatter } from '../emitter/formatter.ts';
import { plainFormatter } from '../emitter/formatter.ts';
import type { LogSink } from '../emitter/sink.ts';
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
   * Whether to overwrite an existing file on the first emitted entry or not (the default is to always append new log
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
   * Error handler callback for file operations. If not provided, errors are ignored.
   */
  readonly errorHandler?: (error: unknown) => void;
};

export type FileSink = Simplify<
  AsyncFinalizer<LogSink> & {
    /**
     * The path to the log file.
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
  const config = {
    datePrefix: options?.datePrefix ?? false,
    overwrite: options?.overwrite ?? false,
    encoding: options?.encoding ?? 'utf8',
    mode: options?.mode ?? 0o666,
    errorHandler: options?.errorHandler ? (error: unknown) => options.errorHandler!(errorify(error)) : undefined,
  } as const satisfies FileSinkOptions;

  if (!filePath) {
    config.errorHandler?.(new Error('InvalidArgument: file path is required'));
    return { sink: () => void 0, filePath: '', flush: () => Promise.resolve(), close: () => Promise.resolve() };
  }

  let resolvedPath: string;
  if (filePath.includes('/') || filePath.includes('\\')) {
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
    const p = (n: number) => String(n).padStart(2, '0');
    const datePrefix = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
    resolvedPath = path.join(path.dirname(resolvedPath), `${datePrefix}_${path.basename(resolvedPath)}`);
  }

  const errorHandler = options?.errorHandler && ((error: unknown) => options.errorHandler!(errorify(error)));
  const writer = createFileWriter(resolvedPath, {
    overwrite: config.overwrite,
    errorHandler,
    encoding: options?.encoding ?? 'utf8',
    mode: options?.mode ?? 0o666,
  });

  return {
    sink: (level, message, args): void => {
      if (writer.isClosed()) {
        return;
      }

      // Format the message immediately to ensure correct timestamp
      writer.write(formatter(level, message, args));
    },

    filePath: resolvedPath,

    flush(): Promise<void> {
      return writer.flush();
    },

    close(): Promise<void> {
      return writer.close();
    },
  };
};
