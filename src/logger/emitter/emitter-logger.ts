import type { Logger, LogLevel } from '../definition.ts';
import type { BaseLoggerOptions } from '../implementation/base-logger.ts';
import { BaseLogger } from '../implementation/base-logger.ts';
import type { LogSink } from './common.ts';

export function createLogger(
  level: LogLevel | 'off' | (() => LogLevel | 'off'),
  logSink: LogSink['sink'],
  options?: BaseLoggerOptions,
): Logger;

export function createLogger<S extends LogSink>(
  level: LogLevel | 'off' | (() => LogLevel | 'off'),
  logSink: S,
  options?: BaseLoggerOptions,
): Exclude<Logger, 'flush' | 'close'> & Pick<S, 'flush' | 'close'>;

export function createLogger(
  level: LogLevel | 'off' | (() => LogLevel | 'off'),
  logSink: LogSink | LogSink['sink'],
  options?: BaseLoggerOptions,
): Logger {
  return new EmitterLogger(level, logSink, options);
}

class EmitterLogger extends BaseLogger {
  private readonly logSink: LogSink;

  public readonly flush: (() => void | Promise<void>) | undefined;
  public readonly close: (() => void | Promise<void>) | undefined;

  public constructor(
    level: LogLevel | 'off' | (() => LogLevel | 'off'),
    logSink: LogSink | LogSink['sink'],
    options?: BaseLoggerOptions,
  ) {
    super(level, options);

    if (typeof logSink === 'function') {
      logSink = { sink: logSink };
    }

    this.logSink = logSink;
    this.flush = logSink.flush && (() => logSink.flush?.());
    this.close = logSink.close && (() => logSink.close?.());
  }

  protected override emit(level: LogLevel, message: string, args: readonly unknown[]): void {
    this.logSink.sink(level, message, args);
  }
}
