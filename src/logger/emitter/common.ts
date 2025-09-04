import type { Writable } from 'type-fest';

import type { Logger, LogLevel } from '../definition.ts';

export type LogSink = {
  readonly sink: (level: LogLevel, message: string, args: readonly unknown[]) => void;
  readonly flush?: () => void | Promise<void>;
  readonly close?: () => void | Promise<void>;
};

export function asLogSink(sink: LogSink['sink']): LogSink;
export function asLogSink<F extends LogSink['flush'], C extends LogSink['close']>(
  sink: LogSink['sink'],
  options: { flush?: F; close?: C },
): LogSink & { flush: F; close: C };
export function asLogSink(
  sink: LogSink['sink'],
  options?: { flush?: LogSink['flush']; close?: LogSink['close'] },
): LogSink {
  const logSink: Writable<LogSink> = { sink };
  if (options?.flush) {
    logSink.flush = options.flush;
  }
  if (options?.close) {
    logSink.close = options.close;
  }
  return logSink;
}

export const asConditionalSink = <S extends LogSink>(
  logSink: S,
  predicate: (level: LogLevel, message: string, args: readonly unknown[]) => boolean,
): S =>
  asLogSink((level, message, args) => {
    if (predicate(level, message, args)) {
      logSink.sink(level, message, args);
    }
  }, logSink) as S;

export const asSingleSink = (...logSinks: readonly LogSink[]): LogSink => {
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
