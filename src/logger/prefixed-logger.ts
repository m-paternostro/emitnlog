import { shouldEmitEntry } from './level-utils.ts';
import type { Logger, LogLevel, LogMessage } from './logger.ts';
import { OFF_LOGGER } from './off-logger.ts';

const prefixSymbol: unique symbol = Symbol('prefix');

/**
 * A specialized logger that prepends a fixed prefix to all log messages.
 *
 * The PrefixedLogger maintains all the functionality of a standard Logger while ensuring every log message is
 * automatically prefixed, making it easier to:
 *
 * - Categorize logs by component, module, or subsystem
 * - Distinguish logs from different parts of your application
 * - Create hierarchical logging structures with nested prefixes
 *
 * The prefix is strongly typed and, in some development environments, is visible on the logger's tooltip.
 */
export interface PrefixedLogger<TPrefix extends string> extends Logger {
  /*
   * The prefix or, in some cases, undefined.
   *
   * This is an internal property, only exposed to ensure that the type system displays the prefix - moreover, due to
   * performance reasons, sometimes is not set or even added to the object.
   */
  readonly [prefixSymbol]: TPrefix | undefined;
}

/**
 * Creates a new logger that prepends a specified prefix to all log messages.
 *
 * This function wraps an existing logger and returns a new logger instance where all log messages are automatically
 * prefixed. This is useful for categorizing logs or distinguishing between different components in your application.
 *
 * When applied to an already prefixed logger, it preserves the full prefix chain both at runtime and in the type
 * system, allowing for strongly-typed nested prefixes.
 *
 * Performance optimizations:
 *
 * - If the prefix is an empty string, the original logger is returned unchanged
 * - If the logger is the `OFF_LOGGER`, it's returned directly to avoid unnecessary processing
 * - Log levels are checked before prefixing to avoid string processing when logs won't be emitted
 *
 * @example
 *
 * ```ts
 * // Create a basic prefixed logger using the default message separator `: `
 * const dbLogger = withPrefix(logger, 'DB');
 * dbLogger.info('Connected to database'); // Logs: "DB: Connected to database"
 *
 * // Prefix is maintained with template literals
 * dbLogger.d`Query executed in ${queryTime}ms`; // Logs: "DB: Query executed in 42ms"
 *
 * // Create nested prefixes for hierarchical logging maintaining the full prefix chain
 * // This is also setting a new message separator
 * const userDbLogger = withPrefix(dbLogger, '.users', ' - ');
 * // Type of userDbLogger is PrefixedLogger<'DB.users'>
 * userDbLogger.w`User not found: ${userId}`; // Logs: "DB.users - User not found: 123"
 *
 * // Errors maintain their original objects while prefixing the message
 * const error = new Error('Connection failed');
 * dbLogger.error(error); // Logs prefixed message but preserves error object in args
 *
 * // Use with conditional logging
 * dbLogger.level = isProduction ? 'info' : 'debug';
 * dbLogger.d`This is only logged in non-production`; // Only emitted when level is 'debug' or 'trace'
 * ```
 *
 * **Tip:** When supported by your development environment, hovering over a prefixed logger variable (like `dbLogger` in
 * the examples above) shows the prefix in the tooltip due to the type parameter, making it easier to identify which
 * prefix is being used.
 *
 * @param logger The base logger to wrap with prefix functionality
 * @param prefix The prefix to prepend to all log messages
 * @param messageSeparator The separator to use between the prefix and the log message. Defaults to `: `.
 * @returns A new logger with the specified prefix, or the original logger if the prefix is empty or if the logger is
 *   the `OFF_LOGGER`.
 */
export const withPrefix = <TLogger extends Logger, const TPrefix extends string>(
  logger: TLogger,
  prefix: TPrefix,
  messageSeparator = ': ',
): WithPrefixResult<TLogger, TPrefix> => {
  if (prefix === '') {
    return logger as unknown as WithPrefixResult<TLogger, TPrefix>;
  }

  if (logger === OFF_LOGGER) {
    return OFF_LOGGER as unknown as WithPrefixResult<TLogger, TPrefix>;
  }

  const combinedPrefix =
    prefixSymbol in logger && typeof logger[prefixSymbol] === 'string' && logger[prefixSymbol]
      ? `${logger[prefixSymbol]}${prefix}`
      : prefix;

  const prefixedLogger: PrefixedLogger<TPrefix> = {
    level: logger.level,
    [prefixSymbol]: combinedPrefix as TPrefix,

    args(...args: unknown[]) {
      logger.args(...args);
      return prefixedLogger;
    },

    trace(message: LogMessage, ...args: unknown[]) {
      logger.trace(toMessageProvider(prefixedLogger, message, messageSeparator), ...args);
    },

    t(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'trace')) {
        logger.t(prefixTemplateString(prefixedLogger, strings, messageSeparator), ...values);
      }
    },

    debug(message: LogMessage, ...args: unknown[]) {
      logger.debug(toMessageProvider(prefixedLogger, message, messageSeparator), ...args);
    },

    d(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'debug')) {
        logger.d(prefixTemplateString(prefixedLogger, strings, messageSeparator), ...values);
      }
    },

    info(message: LogMessage, ...args: unknown[]) {
      logger.info(toMessageProvider(prefixedLogger, message, messageSeparator), ...args);
    },

    i(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'info')) {
        logger.i(prefixTemplateString(prefixedLogger, strings, messageSeparator), ...values);
      }
    },

    notice(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'notice')) {
        logger.notice(toMessageProvider(prefixedLogger, message, messageSeparator), ...args);
      }
    },

    n(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'notice')) {
        logger.n(prefixTemplateString(prefixedLogger, strings, messageSeparator), ...values);
      }
    },

    warning(message: LogMessage, ...args: unknown[]) {
      logger.warning(toMessageProvider(prefixedLogger, message, messageSeparator), ...args);
    },

    w(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'warning')) {
        logger.w(prefixTemplateString(prefixedLogger, strings, messageSeparator), ...values);
      }
    },

    error(error: LogMessage | Error | { error: unknown }, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'error')) {
        if (error instanceof Error) {
          logger.error(toMessageProvider(prefixedLogger, error.message, messageSeparator), error, ...args);
        } else if (error && typeof error === 'object' && 'error' in error) {
          logger.error(toMessageProvider(prefixedLogger, String(error.error), messageSeparator), error, ...args);
        } else {
          logger.error(toMessageProvider(prefixedLogger, error as LogMessage, messageSeparator), ...args);
        }
      }
    },

    e(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'error')) {
        logger.e(prefixTemplateString(prefixedLogger, strings, messageSeparator), ...values);
      }
    },

    critical(message: LogMessage, ...args: unknown[]) {
      logger.critical(toMessageProvider(prefixedLogger, message, messageSeparator), ...args);
    },

    c(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'critical')) {
        logger.c(prefixTemplateString(prefixedLogger, strings, messageSeparator), ...values);
      }
    },

    alert(message: LogMessage, ...args: unknown[]) {
      logger.alert(toMessageProvider(prefixedLogger, message, messageSeparator), ...args);
    },

    a(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'alert')) {
        logger.a(prefixTemplateString(prefixedLogger, strings, messageSeparator), ...values);
      }
    },

    emergency(message: LogMessage, ...args: unknown[]) {
      logger.emergency(toMessageProvider(prefixedLogger, message, messageSeparator), ...args);
    },

    em(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'emergency')) {
        logger.em(prefixTemplateString(prefixedLogger, strings, messageSeparator), ...values);
      }
    },

    log(level: LogLevel, message: LogMessage, ...args: unknown[]) {
      logger.log(level, toMessageProvider(prefixedLogger, message, messageSeparator), ...args);
    },
  };

  return prefixedLogger as WithPrefixResult<TLogger, TPrefix>;
};

const prefixTemplateString = (
  prefixLogger: PrefixedLogger<string>,
  strings: TemplateStringsArray,
  messageSeparator: string,
): TemplateStringsArray => {
  const prefix = prefixLogger[prefixSymbol];
  const newStrings = Array.from(strings);
  newStrings[0] = `${prefix}${messageSeparator}${newStrings[0]}`;
  const prefixedStrings = Object.assign(newStrings, { raw: Array.from(strings.raw) });
  prefixedStrings.raw[0] = `${prefix}${messageSeparator}${prefixedStrings.raw[0]}`;
  return prefixedStrings as unknown as TemplateStringsArray;
};

const toMessageProvider =
  (prefixLogger: PrefixedLogger<string>, message: LogMessage, messageSeparator: string) => () => {
    const messageString = typeof message === 'function' ? message() : message;
    return `${prefixLogger[prefixSymbol]}${messageSeparator}${messageString}`;
  };

type WithPrefixResult<TLogger extends Logger, TNewPrefix extends string> =
  TLogger extends PrefixedLogger<infer TPrevPrefix>
    ? PrefixedLogger<`${TPrevPrefix}${TNewPrefix}`>
    : PrefixedLogger<TNewPrefix>;
