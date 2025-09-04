import type { Writable } from 'type-fest';

import type { LogLevel } from '../definition.ts';

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
