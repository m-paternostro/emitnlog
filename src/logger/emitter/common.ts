import type { Writable } from 'type-fest';

import type { LogLevel } from '../definition.ts';

/**
 * Defines the interface for log sinks - destinations where log entries are written.
 *
 * A log sink is the core abstraction for where logs are sent. It can represent console output, files, network
 * endpoints, or any other destination. The optional flush and close methods allow for proper resource management and
 * buffering control.
 */
export type LogSink = {
  /**
   * The main sink function that receives and processes log entries
   */
  readonly sink: (level: LogLevel, message: string, args: readonly unknown[]) => void;

  /**
   * Optional method to flush any buffered entries
   */
  readonly flush?: () => void | Promise<void>;

  /**
   * Optional method to clean up resources when the sink is no longer needed
   */
  readonly close?: () => void | Promise<void>;
};

/**
 * Converts a sink function into a basic LogSink object.
 *
 * @example Basic conversion
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const basicSink = emitter.asLogSink((level, message, args) => {
 *   console.log(`[${level}] ${message}`, ...args);
 * });
 * ```
 *
 * @param sink The sink function to wrap
 * @returns A LogSink object with only the sink function
 */
export function asLogSink(sink: LogSink['sink']): LogSink;
/**
 * Converts a sink function into a LogSink object with flush and close methods.
 *
 * The returned LogSink will have the same flush and close method types as provided in the options (synchronous or
 * asynchronous).
 *
 * @example With flush and close methods
 *
 * ```ts
 * const fileBuffer: string[] = [];
 *
 * const fileSink = asLogSink((level, message) => fileBuffer.push(`[${level}] ${message}`), {
 *   flush: () => {
 *     fs.writeFileSync('log.txt', fileBuffer.join('\n'));
 *     fileBuffer.length = 0;
 *   },
 *   close: () => {
 *     // Clean up resources
 *   },
 * });
 * ```
 *
 * @param sink The sink function to wrap
 * @param options Flush and close methods to add
 * @returns A LogSink object with the provided flush and close methods
 */
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

/**
 * Represents a structured log entry with timestamp and metadata.
 *
 * This type is used internally by formatters and sinks that need to work with structured log data. The timestamp is
 * stored as milliseconds since epoch.
 */
export type LogEntry = {
  /**
   * The severity level of the log entry
   */
  readonly level: LogLevel;

  /**
   * Timestamp when the entry was created (milliseconds since epoch)
   */
  readonly timestamp: number;

  /**
   * The formatted message content
   */
  readonly message: string;

  /**
   * Additional arguments provided with the log entry
   */
  readonly args: readonly unknown[];
};

/**
 * Creates a LogEntry object with the current timestamp.
 *
 * This utility function is used by formatters that need to work with structured log data including timestamps. The
 * timestamp is automatically set to the current time.
 *
 * @example
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const entry = emitter.asLogEntry('info', 'Operation completed', [{ duration: 150 }]);
 * console.log(entry.timestamp); // Current timestamp in milliseconds
 * ```
 *
 * @param level The log level
 * @param message The log message
 * @param args Additional arguments
 * @returns A LogEntry object with current timestamp
 */
export const asLogEntry = (level: LogLevel, message: string, args: readonly unknown[]): LogEntry => ({
  level,
  timestamp: Date.now(),
  message,
  args,
});
