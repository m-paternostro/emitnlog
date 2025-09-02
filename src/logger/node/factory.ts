import type { Logger, LogLevel } from '../definition.ts';
import { batchSink, type BatchSinkOptions } from '../emitter/batch-sink.ts';
import { createLogger } from '../emitter/emitter-logger.ts';
import type { LogFormat } from '../factory.ts';
import { toLogSink } from '../factory.ts';
import type { BaseLoggerOptions } from '../implementation/base-logger.ts';
import type { FileSinkOptions } from './file-sink.ts';
import { fileSink } from './file-sink.ts';

type FileFormat = Exclude<LogFormat, 'colorful'>;

export const createFileLogger = (
  options: string | (Omit<FileSinkOptions, 'formatter'> & BatchSinkOptions & BaseLoggerOptions),
  level: LogLevel = 'info',
  format: FileFormat = 'plain',
): Logger => {
  if (typeof options === 'string') {
    options = { filePath: options };
  }

  const sink = batchSink(fileSink({ ...options, formatter: toLogSink(format) }), options);
  return createLogger(level, sink, options);
};
