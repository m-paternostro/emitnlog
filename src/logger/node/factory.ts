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

export type FileLoggerOptions = Omit<FileSinkOptions, 'filePath' | 'formatter'> &
  BatchSinkOptions &
  BaseLoggerOptions & {
    /**
     * By default the log entry `args` array is written out to the file if the format supports it. Pass `true` so that
     * the array is never written out.
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

export type FileLogger = AsyncFinalizer<Logger> & Pick<FileSink, 'filePath'>;

export function createFileLogger(filePath: string, level?: LogLevel, format?: LogFormat): FileLogger;
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

      case 'json-compact':
      case 'json-pretty':
        break;

      default:
        exhaustiveCheck(options.format);
    }
  }

  const fs = fileSink(filePath, formatter, options);
  return asExtendedLogger(createLogger(options.level, batchSink(fs, options), options), { filePath: fs.filePath });
}
