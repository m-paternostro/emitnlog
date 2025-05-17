import { exhaustiveCheck } from '../utils/common/exhaustive-check.ts';
import type { LogLevel } from './logger.ts';

/**
 * Converts a LogLevel to its corresponding numeric weight value for comparison operations.
 *
 * This function maps each log level to a numeric value according to its severity, with lower numbers representing
 * higher severity (more important) levels:
 *
 * - Emergency: 0 (highest severity)
 * - Alert: 1
 * - Critical: 2
 * - Error: 3
 * - Warning: 4
 * - Notice: 5
 * - Info: 6
 * - Debug: 7
 * - Trace: 8 (lowest severity)
 *
 * @example
 *
 * ```ts
 * const errorWeight = toLevelWeight('error'); // Returns 3
 * const debugWeight = toLevelWeight('debug'); // Returns 7
 *
 * // Compare severity levels
 * if (toLevelWeight('error') < toLevelWeight('debug')) {
 *   // This condition is true (3 < 7), meaning 'error' is more severe than 'debug'
 * }
 * ```
 *
 * @param level The log level to convert to a numeric weight
 * @returns The numeric weight corresponding to the specified log level
 */
export const toLevelWeight = (level: LogLevel): number => {
  switch (level) {
    case 'trace':
      return 8;

    case 'debug':
      return 7;

    case 'info':
      return 6;

    case 'notice':
      return 5;

    case 'warning':
      return 4;

    case 'error':
      return 3;

    case 'critical':
      return 2;

    case 'alert':
      return 1;

    case 'emergency':
      return 0;

    default:
      exhaustiveCheck(level);
      return 20;
  }
};

/**
 * Determines whether a log entry should be emitted based on the configured logger level and the entry's level.
 *
 * This function implements the severity filtering logic of the logger:
 *
 * - When the logger level is 'off', no entries will be emitted
 * - Otherwise, entries are emitted when their level's severity is equal to or greater than the logger's level
 *
 * For example, if the logger's level is set to 'warning', entries with levels 'warning', 'error', 'critical', 'alert',
 * and 'emergency' will be emitted, while entries with levels 'notice', 'info', 'debug', and 'trace' will be filtered
 * out.
 *
 * @example
 *
 * ```ts
 * // When logger level is 'warning'
 * shouldEmitEntry('warning', 'error'); // Returns true (error entries are emitted)
 * shouldEmitEntry('warning', 'info'); // Returns false (info entries are filtered out)
 *
 * // When logger is turned off
 * shouldEmitEntry('off', 'emergency'); // Returns false (nothing is emitted)
 * ```
 *
 * @param level The current configured level of the logger or 'off'
 * @param entryLevel The severity level of the log entry to be evaluated
 * @returns True if the entry should be emitted, false otherwise
 */
export const shouldEmitEntry = (level: LogLevel | 'off', entryLevel: LogLevel): boolean =>
  level !== 'off' && toLevelWeight(entryLevel) <= toLevelWeight(level);
