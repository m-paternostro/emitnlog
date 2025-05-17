import { shouldEmitEntry } from './level-utils.ts';
import type { Logger, LogLevel, LogMessage } from './logger.ts';
import { OFF_LOGGER } from './off-logger.ts';

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
 * The prefix is stored as a read-only property and is strongly typed, enabling type checking and autocompletion
 * support.
 */
export interface PrefixedLogger<TPrefix extends string = string> extends Logger {
  /**
   * The fixed prefix that is automatically prepended to all log messages. This value is set when the logger is created
   * and cannot be modified.
   */
  readonly prefix: TPrefix;
}

/**
 * Creates a new logger that prepends a specified prefix to all log messages.
 *
 * This function wraps an existing logger and returns a new logger instance where all log messages are automatically
 * prefixed. This is useful for categorizing logs or distinguishing between different components in your application.
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
 * // Create a basic prefixed logger
 * const dbLogger = withPrefix(logger, 'DB: ');
 * dbLogger.info('Connected to database'); // Logs: "DB: Connected to database"
 *
 * // Prefix is maintained with template literals
 * dbLogger.d`Query executed in ${queryTime}ms`; // Logs: "DB: Query executed in 42ms"
 *
 * // Create nested prefixes for hierarchical logging
 * const userDbLogger = withPrefix(dbLogger, 'users/');
 * userDbLogger.w`User not found: ${userId}`; // Logs: "DB: users/User not found: 123"
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
 * the examples above) will show the prefix in the tooltip due to the type parameter, making it easier to identify which
 * prefix is being used.
 *
 * @param logger The base logger to wrap with prefix functionality
 * @param prefix The prefix to prepend to all log messages
 * @returns A new logger with the specified prefix, or the original logger if prefix is empty.
 */
export const withPrefix = <TPrefix extends string>(
  logger: Logger,
  prefix: TPrefix,
): TPrefix extends '' ? Logger : PrefixedLogger<TPrefix> => {
  if (prefix === '') {
    return logger as TPrefix extends '' ? Logger : PrefixedLogger<TPrefix>;
  }

  if (logger === OFF_LOGGER) {
    return logger as TPrefix extends '' ? Logger : PrefixedLogger<TPrefix>;
  }

  const prefixedLogger: PrefixedLogger<TPrefix> = {
    level: logger.level,
    prefix,

    args(...args: unknown[]) {
      logger.args(...args);
      return prefixedLogger;
    },

    trace(message: LogMessage, ...args: unknown[]) {
      logger.trace(() => `${prefix}${toMessage(message)}`, ...args);
    },

    t(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'trace')) {
        logger.t(prefixTemplateString(strings, prefix), ...values);
      }
    },

    debug(message: LogMessage, ...args: unknown[]) {
      logger.debug(() => `${prefix}${toMessage(message)}`, ...args);
    },

    d(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'debug')) {
        logger.d(prefixTemplateString(strings, prefix), ...values);
      }
    },

    info(message: LogMessage, ...args: unknown[]) {
      logger.info(() => `${prefix}${toMessage(message)}`, ...args);
    },

    i(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'info')) {
        logger.i(prefixTemplateString(strings, prefix), ...values);
      }
    },

    notice(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'notice')) {
        logger.notice(() => `${prefix}${toMessage(message)}`, ...args);
      }
    },

    n(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'notice')) {
        logger.n(prefixTemplateString(strings, prefix), ...values);
      }
    },

    warning(message: LogMessage, ...args: unknown[]) {
      logger.warning(() => `${prefix}${toMessage(message)}`, ...args);
    },

    w(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'warning')) {
        logger.w(prefixTemplateString(strings, prefix), ...values);
      }
    },

    error(error: LogMessage | Error | { error: unknown }, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'error')) {
        if (error instanceof Error) {
          logger.error(`${prefix}${error.message}`, error, ...args);
        } else if (error && typeof error === 'object' && 'error' in error) {
          logger.error(`${prefix}${String(error.error)}`, error, ...args);
        } else {
          logger.error(() => `${prefix}${toMessage(error as LogMessage)}`, ...args);
        }
      }
    },

    e(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'error')) {
        logger.e(prefixTemplateString(strings, prefix), ...values);
      }
    },

    critical(message: LogMessage, ...args: unknown[]) {
      logger.critical(() => `${prefix}${toMessage(message)}`, ...args);
    },

    c(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'critical')) {
        logger.c(prefixTemplateString(strings, prefix), ...values);
      }
    },

    alert(message: LogMessage, ...args: unknown[]) {
      logger.alert(() => `${prefix}${toMessage(message)}`, ...args);
    },

    a(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'alert')) {
        logger.a(prefixTemplateString(strings, prefix), ...values);
      }
    },

    emergency(message: LogMessage, ...args: unknown[]) {
      logger.emergency(() => `${prefix}${toMessage(message)}`, ...args);
    },

    em(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'emergency')) {
        logger.em(prefixTemplateString(strings, prefix), ...values);
      }
    },

    log(level: LogLevel, message: LogMessage, ...args: unknown[]) {
      logger.log(level, () => `${prefix}${toMessage(message)}`, ...args);
    },
  };

  return prefixedLogger as TPrefix extends '' ? Logger : PrefixedLogger<TPrefix>;
};

const prefixTemplateString = (strings: TemplateStringsArray, prefix: string): TemplateStringsArray => {
  const newStrings = Array.from(strings);
  newStrings[0] = `${prefix}${newStrings[0]}`;
  const prefixedStrings = Object.assign(newStrings, { raw: Array.from(strings.raw) });
  prefixedStrings.raw[0] = `${prefix}${prefixedStrings.raw[0]}`;
  return prefixedStrings as unknown as TemplateStringsArray;
};

const toMessage = (message: LogMessage) => (typeof message === 'function' ? message() : message);
