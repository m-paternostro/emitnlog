import type { Simplify } from 'type-fest';

import { exhaustiveCheck } from '../utils/common/exhaustive-check.ts';
import type { Logger, LogLevel } from './definition.ts';
import { consoleByLevelSink, consoleErrorSink, consoleLogSink } from './emitter/console-sink.ts';
import { createLogger } from './emitter/emitter-logger.ts';
import type { LogFormatter } from './emitter/formatter.ts';
import {
  basicFormatter,
  colorfulFormatter,
  jsonPrettyFormatter,
  ndjsonFormatter,
  plainFormatter,
} from './emitter/formatter.ts';
import type { BaseLoggerOptions } from './implementation/base-logger.ts';
import { injectPrefixInformation, isPrefixedLogger } from './prefixed-logger.ts';

/**
 * The format of the emitted lines. The possible values are:
 *
 * - 'plain': The line is emitted as a plain string.
 * - 'colorful': The line is emitted with ANSI color codes.
 * - 'ndjson': The line is emitted as a single line JSON Object.
 * - 'json-pretty': The line is emitted as a multi-line, formatted JSON Object.
 */
export type LogFormat = 'plain' | 'colorful' | 'ndjson' | 'json-pretty';

/**
 * Creates a logger that emits log messages to standard output (console.log) with optional formatting.
 *
 * All log entries, regardless of severity level, are sent to console.log. For routing based on severity, use
 * {@link createConsoleByLevelLogger} instead.
 *
 * @example Basic usage
 *
 * ```ts
 * import { createConsoleLogLogger } from 'emitnlog/logger';
 *
 * const logger = createConsoleLogLogger();
 * logger.info('Application started');
 * logger.error('This also goes to console.log');
 * ```
 *
 * @example With custom level and format
 *
 * ```ts
 * const logger = createConsoleLogLogger('debug', 'ndjson');
 * logger.debug('Debug information', { userId: 123 });
 * ```
 *
 * @param level The minimum log level (default: 'info')
 * @param format The output format (default: 'colorful')
 * @param options Additional logger configuration options
 * @returns A logger that writes all entries to console.log
 */
export const createConsoleLogLogger = (
  level: LogLevel = 'info',
  format: LogFormat = 'colorful',
  options?: BaseLoggerOptions,
): Logger => createLogger(level, consoleLogSink(toLogFormatter(format)), options);

/**
 * Creates a logger that emits log messages to standard error (console.error) with optional formatting.
 *
 * All log entries, regardless of severity level, are sent to console.error. This is useful when you want all logs to go
 * to stderr for proper shell redirection or when building CLI tools.
 *
 * @example Basic usage
 *
 * ```ts
 * import { createConsoleErrorLogger } from 'emitnlog/logger';
 *
 * const logger = createConsoleErrorLogger();
 * logger.error('Critical error occurred');
 * logger.info('This info message also goes to stderr');
 * ```
 *
 * @example Production configuration
 *
 * ```ts
 * const logger = createConsoleErrorLogger('error', 'ndjson');
 * logger.info("This won't be logged (below error level)");
 * logger.error('This will be logged as NDJSON to stderr');
 * ```
 *
 * @param level The minimum log level (default: 'info')
 * @param format The output format (default: 'colorful')
 * @param options Additional logger configuration options
 * @returns A logger that writes all entries to console.error
 */
export const createConsoleErrorLogger = (
  level: LogLevel = 'info',
  format: LogFormat = 'colorful',
  options?: BaseLoggerOptions,
): Logger => createLogger(level, consoleErrorSink(toLogFormatter(format)), options);

/**
 * Creates a logger with intelligent console routing based on message severity.
 *
 * This provides the most sensible console behavior for most applications:
 *
 * - Lower severity (trace, debug, info, notice) → console.log
 * - Higher severity (warning, error, critical, alert, emergency) → console.error
 *
 * @example Basic usage
 *
 * ```ts
 * import { createConsoleByLevelLogger } from 'emitnlog/logger';
 *
 * const logger = createConsoleByLevelLogger();
 * logger.info('Normal operation'); // Goes to console.log
 * logger.error('Error occurred'); // Goes to console.error
 * logger.warning('Be careful'); // Goes to console.error
 * ```
 *
 * @example Production configuration
 *
 * ```ts
 * const logger = createConsoleByLevelLogger('warning', 'ndjson');
 * // Only warnings and above are logged, all to console.error as JSON
 * ```
 *
 * @param level The minimum log level (default: 'info')
 * @param format The output format (default: 'colorful')
 * @param options Additional logger configuration options
 * @returns A logger with automatic console routing based on severity
 */
export const createConsoleByLevelLogger = (
  level: LogLevel = 'info',
  format: LogFormat = 'colorful',
  options?: BaseLoggerOptions,
): Logger => createLogger(level, consoleByLevelSink(toLogFormatter(format)), options);

/**
 * Converts a format string into a corresponding log formatter function.
 *
 * This utility function maps the string-based format options to their corresponding formatter implementations. Used
 * internally by the factory functions but exported for custom logger implementations.
 *
 * @example
 *
 * ```ts
 * import { toLogFormatter } from 'emitnlog/logger';
 *
 * const formatter = toLogFormatter('ndjson');
 * const formatted = formatter('info', 'Hello world', []);
 * // formatted is a JSON string
 * ```
 *
 * @param format The format type to convert
 * @returns A LogFormatter function that formats entries according to the specified format
 */
export const toLogFormatter = (format: LogFormat): LogFormatter => {
  switch (format) {
    case 'colorful':
      return colorfulFormatter;

    case 'plain':
      return plainFormatter;

    case 'ndjson':
      return ndjsonFormatter;

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

/**
 * Extends a logger with additional methods and properties while preserving pending arguments functionality.
 *
 * This function allows you to add custom methods to any logger instance. The extended logger maintains the ability to
 * chain arguments using the `args()` method, ensuring that pending arguments are properly forwarded with each log
 * operation.
 *
 * @example Basic extension
 *
 * ```ts
 * import { asExtendedLogger, createConsoleLogLogger } from 'emitnlog/logger';
 *
 * const baseLogger = createConsoleLogLogger();
 * const extended = asExtendedLogger(baseLogger, {
 *   logWithTimestamp: (message: string) => {
 *     baseLogger.info(`[${new Date().toISOString()}] ${message}`);
 *   },
 * });
 *
 * extended.logWithTimestamp('Custom log message');
 * ```
 *
 * @param logger The base logger to extend
 * @param extensions Objects containing additional methods and properties to add to the logger
 * @returns A new logger with all the original methods plus the provided extensions
 */
export const asExtendedLogger = <L extends Logger, Ms extends readonly object[]>(
  logger: L,
  ...extensions: Ms
): ExtendedLogger<L, Ms> => {
  let pendingArgs: unknown[] = [];

  const consumePendingArgs = (): readonly unknown[] | undefined => {
    if (!pendingArgs.length) {
      return undefined;
    }

    const args = pendingArgs;
    pendingArgs = [];
    return args;
  };

  const runLogOperation = (operation: () => void) => {
    const currentArgs = consumePendingArgs();
    if (currentArgs) {
      logger.args(...currentArgs);
    }
    operation();
  };

  let extendedLogger: Logger = {
    get level() {
      return logger.level;
    },

    args: (...args) => {
      pendingArgs.push(...args);
      return extendedLogger;
    },

    trace: (message, ...args) => runLogOperation(() => logger.trace(message, ...args)),
    t: (strings, ...values) => runLogOperation(() => logger.t(strings, ...values)),
    debug: (message, ...args) => runLogOperation(() => logger.debug(message, ...args)),
    d: (strings, ...values) => runLogOperation(() => logger.d(strings, ...values)),
    info: (message, ...args) => runLogOperation(() => logger.info(message, ...args)),
    i: (strings, ...values) => runLogOperation(() => logger.i(strings, ...values)),
    notice: (message, ...args) => runLogOperation(() => logger.notice(message, ...args)),
    n: (strings, ...values) => runLogOperation(() => logger.n(strings, ...values)),
    warning: (input, ...args) => runLogOperation(() => logger.warning(input, ...args)),
    w: (strings, ...values) => runLogOperation(() => logger.w(strings, ...values)),
    error: (input, ...args) => runLogOperation(() => logger.error(input, ...args)),
    e: (strings, ...values) => runLogOperation(() => logger.e(strings, ...values)),
    critical: (input, ...args) => runLogOperation(() => logger.critical(input, ...args)),
    c: (strings, ...values) => runLogOperation(() => logger.c(strings, ...values)),
    alert: (input, ...args) => runLogOperation(() => logger.alert(input, ...args)),
    a: (strings, ...values) => runLogOperation(() => logger.a(strings, ...values)),
    emergency: (input, ...args) => runLogOperation(() => logger.emergency(input, ...args)),
    em: (strings, ...values) => runLogOperation(() => logger.em(strings, ...values)),
    log: (level, message, ...args) => runLogOperation(() => logger.log(level, message, ...args)),

    flush: logger.flush ? () => logger.flush?.() : undefined,
    close: logger.close ? () => logger.close?.() : undefined,
  };

  for (const m of extensions) {
    Object.assign(extendedLogger, m);
  }

  if (isPrefixedLogger(logger)) {
    extendedLogger = injectPrefixInformation(logger, extendedLogger);
  }

  return extendedLogger as ExtendedLogger<L, Ms>;
};
