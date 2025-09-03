import { exhaustiveCheck } from '../../utils/common/exhaustive-check.ts';
import type { Logger, LogLevel } from '../definition.ts';
import type { BatchSinkOptions } from '../emitter/batch-sink.ts';
import { batchSink } from '../emitter/batch-sink.ts';
import { createLogger } from '../emitter/emitter-logger.ts';
import { plainArgAppendingFormatter } from '../emitter/formatter.ts';
import type { LogFormat } from '../factory.ts';
import { asExtendedLogger, toLogFormatter } from '../factory.ts';
import type { BaseLoggerOptions } from '../implementation/base-logger.ts';
import type { AsyncFinalizer } from '../implementation/types.ts';
import type { FileSink, FileSinkOptions } from './file-sink.ts';
import { fileSink } from './file-sink.ts';

export type FileLoggerOptions = Omit<FileSinkOptions, 'formatter'> &
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

export const createFileLogger = (
  input: string | FileLoggerOptions,
  level?: LogLevel,
  format?: LogFormat,
): FileLogger => {
  if (typeof input === 'string') {
    input = { filePath: input };
  }

  if (level === undefined) {
    level = input.level || 'info';
  }
  if (format === undefined) {
    format = input.format || 'plain';
  }

  let formatter = toLogFormatter(format);
  if (!input.omitArgs) {
    switch (format) {
      case 'plain':
      case 'colorful':
        formatter = plainArgAppendingFormatter(formatter);
        break;

      case 'json-compact':
      case 'json-pretty':
        break;

      default:
        exhaustiveCheck(format);
    }
  }

  const fs = fileSink({ ...input, formatter });
  return asExtendedLogger(createLogger(level, batchSink(fs, input), input), { filePath: fs.filePath });
};
