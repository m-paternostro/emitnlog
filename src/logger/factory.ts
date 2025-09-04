import type { Simplify } from 'type-fest';

import { exhaustiveCheck } from '../utils/common/exhaustive-check.ts';
import type { Logger, LogLevel } from './definition.ts';
import { asDelegatedSink } from './emitter/common.ts';
import { consoleByLevelSink, consoleErrorSink, consoleLogSink } from './emitter/console-sink.ts';
import { createLogger } from './emitter/emitter-logger.ts';
import type { LogFormatter } from './emitter/formatter.ts';
import {
  basicFormatter,
  colorfulFormatter,
  jsonCompactFormatter,
  jsonPrettyFormatter,
  plainFormatter,
} from './emitter/formatter.ts';
import type { BaseLoggerOptions } from './implementation/base-logger.ts';

/**
 * The format of the emitted lines. The possible values are:
 *
 * - 'plain': The line is emitted as a plain string.
 * - 'colorful': The line is emitted with ANSI color codes.
 * - 'json-compact': The line is emitted as a JSON string.
 * - 'json-pretty': The line is emitted as a formatted JSON string.
 */
export type LogFormat = 'plain' | 'colorful' | 'json-compact' | 'json-pretty';

/**
 * Creates a logger that matches the behavior of ConsoleLogger. Emits log messages to standard output (console.log) with
 * optional formatting.
 *
 * @example Basic usage
 *
 * ```ts
 * import { createConsoleLogger } from 'emitnlog/logger/plugin';
 *
 * const logger = createConsoleLogger();
 * logger.info('Application started');
 * ```
 *
 * @example With custom level and format
 *
 * ```ts
 * const logger = createConsoleLogger('debug', 'json');
 * logger.debug('Debug information', { userId: 123 });
 * ```
 *
 * @example Building upon the created logger
 *
 * ```ts
 * import { PluggableLoggerBuilder } from 'emitnlog/logger/plugin';
 *
 * const baseLogger = createConsoleLogger();
 * const enhancedLogger = PluggableLoggerBuilder.from(baseLogger).filter(rateLimit(100)).build();
 * ```
 *
 * @param level - The minimum log level (default: 'info')
 * @param format - The output format: 'colorful', 'plain', 'json', or 'unformatted-json' (default: 'colorful')
 * @returns A PluggableLogger configured to match ConsoleLogger behavior
 */
export const createConsoleLogLogger = (
  level: LogLevel = 'info',
  format: LogFormat = 'colorful',
  options?: BaseLoggerOptions,
): Logger => createLogger(level, consoleLogSink(toLogFormatter(format)), options);

/**
 * Creates a logger that matches the behavior of ConsoleErrorLogger. Emits log messages to standard error
 * (console.error) with optional formatting.
 *
 * @example Basic usage
 *
 * ```ts
 * import { createConsoleErrorLogger } from 'emitnlog/logger/plugin';
 *
 * const logger = createConsoleErrorLogger();
 * logger.error('Critical error occurred');
 * ```
 *
 * @example Production configuration
 *
 * ```ts
 * const logger = createConsoleErrorLogger('error', 'json');
 * logger.info('This won't be logged');
 * logger.error('This will be logged as JSON to stderr');
 * ```
 *
 * @example Combining with other transports
 *
 * ```ts
 * import { PluggableLoggerBuilder, fileTransport } from 'emitnlog/logger/plugin';
 *
 * const errorLogger = createConsoleErrorLogger('warning');
 * const combinedLogger = PluggableLoggerBuilder.from(errorLogger)
 *   .transport(fileTransport('/var/log/errors.log'))
 *   .build();
 * ```
 *
 * @param level - The minimum log level (default: 'info')
 * @param format - The output format: 'colorful', 'plain', 'json', or 'unformatted-json' (default: 'plain')
 * @returns A PluggableLogger configured to match ConsoleErrorLogger behavior
 */
export const createConsoleErrorLogger = (
  level: LogLevel = 'info',
  format: LogFormat = 'colorful',
  options?: BaseLoggerOptions,
): Logger => createLogger(level, consoleErrorSink(toLogFormatter(format)), options);

/**
 * Creates a standard application logger with sensible defaults. Routes messages based on severity:
 *
 * - Trace, debug, info, notice → console.log
 * - Warning, error, critical, alert, emergency → console.error
 *
 * @example Basic usage
 *
 * ```ts
 * import { createStandardLogger } from 'emitnlog/logger/plugin';
 *
 * const logger = createStandardLogger();
 * logger.info('Normal operation'); // Goes to console.log
 * logger.error('Error occurred'); // Goes to console.error
 * logger.warning('Be careful'); // Goes to console.error
 * ```
 *
 * @example Production configuration
 *
 * ```ts
 * const logger = createStandardLogger('warning', 'json');
 * // Only warnings and above are logged, all as JSON to console.error
 * ```
 *
 * @param level - The minimum log level (default: 'info')
 * @param format - The output format (default: 'colorful')
 * @returns A PluggableLogger with automatic console routing based on severity
 */
export const createConsoleByLevelLogger = (
  level: LogLevel = 'info',
  format: LogFormat = 'colorful',
  options?: BaseLoggerOptions,
): Logger => createLogger(level, consoleByLevelSink(toLogFormatter(format)), options);

export const toLogFormatter = (format: LogFormat): LogFormatter => {
  switch (format) {
    case 'colorful':
      return colorfulFormatter;

    case 'plain':
      return plainFormatter;

    case 'json-compact':
      return jsonCompactFormatter;

    case 'json-pretty':
      return jsonPrettyFormatter;

    default:
      exhaustiveCheck(format);
      return basicFormatter;
  }
};

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type ExtendedShape<Ms extends readonly object[]> = UnionToIntersection<Ms[number]>;
type ExtendedLogger<L extends Logger, Ms extends readonly object[]> = Simplify<L & ExtendedShape<Ms>>;

export const asExtendedLogger = <L extends Logger, Ms extends readonly object[]>(
  logger: L,
  ...extensions: Ms
): ExtendedLogger<L, Ms> => {
  const extendedLogger = createLogger(() => logger.level, asDelegatedSink(logger));
  for (const m of extensions) Object.assign(extendedLogger, m);
  return extendedLogger as ExtendedLogger<L, Ms>;
};
