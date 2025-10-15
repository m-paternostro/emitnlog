import type { Writable } from 'type-fest';

import type { LogLevel } from './definition.ts';

/**
 * Represents a structured log entry with timestamp and metadata.
 *
 * This type is used internally by formatters and sinks that need to work with structured log data. The timestamp is
 * stored as milliseconds since epoch.
 */
export type LogEntry = {
  /**
   * The severity level of the log entry.
   */
  readonly level: LogLevel;

  /**
   * Timestamp when the entry was created (milliseconds since epoch).
   */
  readonly timestamp: number;

  /**
   * The formatted message content.
   */
  readonly message: string;

  /**
   * Additional arguments provided with the log entry.
   */
  readonly args?: readonly unknown[];
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
 * import { asLogEntry } from 'emitnlog/logger';
 *
 * const entry = asLogEntry('info', 'Operation completed', [{ duration: 150 }]);
 * console.log(entry.timestamp); // Current timestamp in milliseconds
 * ```
 *
 * @param level The log level
 * @param message The log message
 * @param args Additional arguments
 * @returns A LogEntry object with current timestamp
 */
export const asLogEntry = (level: LogLevel, message: string, args?: readonly unknown[]): LogEntry => {
  const entry: Writable<LogEntry> = { level, timestamp: Date.now(), message };
  if (args?.length) {
    entry.args = args;
  }
  return entry;
};
