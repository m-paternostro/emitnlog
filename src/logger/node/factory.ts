import type { Writable } from 'type-fest';

import { exhaustiveCheck } from '../../utils/common/exhaustive-check.ts';
import type { Logger, LogLevel } from '../definition.ts';
import type { BatchSinkOptions } from '../emitter/batch-sink.ts';
import { batchSink } from '../emitter/batch-sink.ts';
import { createLogger } from '../emitter/emitter-logger.ts';
import { plainArgAppendingFormatter } from '../emitter/formatter.ts';
import type { LogFormat } from '../factory.ts';
import { asExtendedLogger, toLogFormatter } from '../factory.ts';
import type { BaseLoggerOptions } from '../implementation/base-logger.ts';
import type { AsyncFinalizer } from '../implementation/finalizer.ts';
import { isLogLevel } from '../implementation/level-utils.ts';
import type { FileSink, FileSinkOptions } from './file-sink.ts';
import { fileSink } from './file-sink.ts';

/**
 * Configuration options for creating a file logger.
 *
 * Combines file sink options, batching options, and logger-specific settings to provide comprehensive control over file
 * logging behavior.
 */
export type FileLoggerOptions = Omit<FileSinkOptions, 'filePath' | 'formatter'> &
  BatchSinkOptions &
  BaseLoggerOptions & {
    /**
     * By default the log entry `args` array is written out to the file if the format supports it. Pass `true` so that
     * the array is never written out.
     *
     * @default false
     */
    readonly omitArgs?: boolean;

    /**
     * The log level to use.
     *
     * @default 'info'
     */
    readonly level?: LogLevel;

    /**
     * The log format to use.
     *
     * @default 'plain'
     */
    readonly format?: LogFormat;
  };

/**
 * A file-based logger with batching capabilities and access to the file path.
 */
export type FileLogger = AsyncFinalizer<Logger> & Pick<FileSink, 'filePath'>;

/**
 * Creates a file logger with basic level and format configuration.
 *
 * The file operations performed by the logger may fail, however no error is thrown to ensure that the logger does not
 * compromise the operation of the application. If necessary, use other overloads to provide a custom error handling.
 *
 * @example Basic usage
 *
 * ```ts
 * import { createFileLogger } from 'emitnlog/logger/node';
 *
 * const logger = createFileLogger('~/logs/app.log', 'info', 'plain');
 * logger.i`Application started`;
 * ```
 *
 * @param filePath Path to the log file
 * @param level The minimum log level to emit (default: 'info')
 * @param format The format for log entries (default: 'plain')
 * @returns A file logger with batching enabled
 */
export function createFileLogger(filePath: string, level?: LogLevel, format?: LogFormat): FileLogger;

/**
 * Creates a file logger with comprehensive configuration options.
 *
 * This overload provides full control over file operations, batching behavior, and formatting options including
 * argument handling.
 *
 * The file operations performed by the logger may fail, however no error is thrown to ensure that the logger does not
 * compromise the operation of the application. Use `options.errorHandler` to provide a custom error handling that
 * could, for example, throw the value passed as argument.
 *
 * @example With comprehensive options
 *
 * ```ts
 * import { createFileLogger } from 'emitnlog/logger/node';
 *
 * const logger = createFileLogger('~/logs/app.log', {
 *   level: 'debug',
 *   format: 'ndjson',
 *   maxBufferSize: 50,
 *   flushDelayMs: 2000,
 *   datePrefix: true,
 *   omitArgs: false,
 * });
 *
 * logger.d`Processing user request`;
 * ```
 *
 * @example With error handling
 *
 * ```ts
 * import { createFileLogger } from 'emitnlog/logger/node';
 *
 * const logger = createFileLogger('~/logs/app.log', {
 *   errorHandler: (error) => {
 *     console.error('Log file error:', error);
 *   },
 * });
 * ```
 *
 * @param filePath Path to the log file
 * @param options Configuration options for the file logger
 * @returns A file logger with batching enabled and the specified configuration
 */
export function createFileLogger(filePath: string, options?: FileLoggerOptions): FileLogger;
export function createFileLogger(
  filePath: string,
  option1?: LogLevel | FileLoggerOptions,
  option2?: LogFormat,
): FileLogger {
  let options: Writable<FileLoggerOptions>;
  if (isLogLevel(option1)) {
    options = {};
    options.level = option1;
    options.format = option2;
  } else {
    options = option1 ?? {};
  }

  if (!options.level) {
    options.level = 'info';
  }
  if (!options.format) {
    options.format = 'plain';
  }

  let formatter = toLogFormatter(options.format);
  if (!options.omitArgs) {
    switch (options.format) {
      case 'plain':
      case 'colorful':
        formatter = plainArgAppendingFormatter(formatter);
        break;

      case 'ndjson':
      case 'json-pretty':
        break;

      default:
        exhaustiveCheck(options.format);
    }
  }

  const fs = fileSink(filePath, formatter, options);
  return asExtendedLogger(createLogger(options.level, batchSink(fs, options), options), { filePath: fs.filePath });
}
