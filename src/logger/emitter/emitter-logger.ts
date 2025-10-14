import type { Logger, LogLevel } from '../definition.ts';
import type { BaseLoggerOptions } from '../implementation/base-logger.ts';
import { BaseLogger } from '../implementation/base-logger.ts';
import type { LogSink } from './sink.ts';

/**
 * Creates a logger that emits entries to the specified log sink.
 *
 * This is the core logger factory function that powers all other logger creation functions. It accepts either a sink
 * function directly or a full LogSink object with optional flush/close methods.
 *
 * @example Basic usage with sink function
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const logger = emitter.createLogger('info', (level, message, args) => {
 *   console.log(`[${level.toUpperCase()}] ${message}`, ...args);
 * });
 *
 * logger.i`Hello world`;
 * ```
 *
 * @example Usage with full LogSink object
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const sink = emitter.consoleLogSink();
 * const logger = emitter.createLogger('info', sink);
 * logger.i`Hello world`;
 * ```
 *
 * @param level The minimum log level or a function that returns the level
 * @param logSink The sink function or LogSink object to emit entries to
 * @param options Additional logger configuration options
 * @returns A logger instance that emits to the specified sink
 */
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
