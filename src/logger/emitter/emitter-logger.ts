import type { Logger, LogLevel } from '../definition.ts';
import type { BaseLoggerOptions } from '../implementation/base-logger.ts';
import { BaseLogger } from '../implementation/base-logger.ts';
import type { LogSink } from './common.ts';

export const createLogger = (
  level: LogLevel | 'off' | (() => LogLevel | 'off'),
  logSink: LogSink,
  options?: BaseLoggerOptions,
): Logger => new EmitterLogger(level, logSink, options);

class EmitterLogger extends BaseLogger {
  private readonly _level: LogLevel | 'off' | (() => LogLevel | 'off');
  private readonly logSink: LogSink;

  public readonly flush: (() => void | Promise<void>) | undefined;
  public readonly close: (() => void | Promise<void>) | undefined;

  public constructor(
    level: LogLevel | 'off' | (() => LogLevel | 'off'),
    logSink: LogSink,
    options?: BaseLoggerOptions,
  ) {
    super('info', options);
    this._level = level;
    this.logSink = logSink;
    this.flush = logSink.flush && (() => logSink.flush?.());
    this.close = logSink.close && (() => logSink.close?.());
  }

  public override get level(): LogLevel | 'off' {
    return typeof this._level === 'function' ? this._level() : this._level;
  }

  protected override emit(level: LogLevel, message: string, args: readonly unknown[]): void {
    this.logSink.sink(level, message, args);
  }
}
