import type { Logger, LogLevel } from '../definition.ts';

export type LogSink = {
  readonly sink: (level: LogLevel, message: string, args: readonly unknown[]) => void;
  readonly flush?: () => void | Promise<void>;
  readonly close?: () => void | Promise<void>;
};

export const asLogSink = (
  sink: LogSink['sink'],
  options?: { flush?: () => void | Promise<void>; close?: () => void | Promise<void> },
): LogSink => ({ sink, flush: options?.flush, close: options?.close });

export const asConditionalSink = (
  logSink: LogSink,
  predicate: (level: LogLevel, message: string, args: readonly unknown[]) => boolean,
): LogSink =>
  asLogSink((level, message, args) => {
    if (predicate(level, message, args)) {
      logSink.sink(level, message, args);
    }
  }, logSink);

export const asSingleSink = (...logSinks: LogSink[]): LogSink => {
  const flushables = logSinks.filter((logSink) => logSink.flush);
  let flush: (() => void | Promise<void>) | undefined;
  if (flushables.length) {
    flush = () => {
      const promises = flushables.map((logSink) => logSink.flush?.()).filter((result) => result instanceof Promise);
      return promises.length ? Promise.all(promises).then(() => undefined) : undefined;
    };
  }

  const closables = logSinks.filter((logSink) => logSink.close);
  let close: (() => void | Promise<void>) | undefined;
  if (closables.length) {
    close = () => {
      const promises = closables.map((logSink) => logSink.close?.()).filter((result) => result instanceof Promise);
      return promises.length ? Promise.all(promises).then(() => undefined) : undefined;
    };
  }

  return asLogSink(
    (level, message, args) => {
      for (const logSink of logSinks) {
        logSink.sink(level, message, args);
      }
    },
    { flush, close },
  );
};

export const asDelegatedSink = (logger: Logger): LogSink =>
  asLogSink((level, message, args) => {
    logger.log(level, message, ...args);
  }, logger);

export type LogEntry = {
  readonly level: LogLevel;
  readonly timestamp: number;
  readonly message: string;
  readonly args: readonly unknown[];
};

export const asLogEntry = (level: LogLevel, message: string, args: readonly unknown[]): LogEntry => ({
  level,
  timestamp: Date.now(),
  message,
  args,
});
