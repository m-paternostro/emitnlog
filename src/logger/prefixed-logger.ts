import { isNotNullable } from '../utils/common/is-not-nullable.ts';
import type { Logger, LogLevel, LogMessage } from './definition.ts';
import { shouldEmitEntry } from './level-utils.ts';
import { OFF_LOGGER } from './off-logger.ts';

const prefixSymbol: unique symbol = Symbol.for('@emitnlog/logger/prefix');
const separatorSymbol: unique symbol = Symbol.for('@emitnlog/logger/separator');
const dataSymbol: unique symbol = Symbol.for('@emitnlog/logger/data');

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
export interface PrefixedLogger<TPrefix extends string = string, TSeparator extends string = string> extends Logger {
  /*
   * The prefix or undefined.
   */
  readonly [prefixSymbol]: TPrefix | undefined;

  /*
   * The value used to separate different parts of the prefix, or undefined
   */
  readonly [separatorSymbol]: TSeparator | undefined;

  /*
   * Arbitrary data needed by the prefix logger.
   */
  readonly [dataSymbol]: { readonly rootLogger: Logger; readonly messageSeparator: string } | undefined;
}

/**
 * Creates a new logger that prepends a specified prefix to all log messages.
 *
 * This function wraps an existing logger and returns a new logger instance where all log messages are automatically
 * prefixed. This is useful for categorizing logs or distinguishing between different components in your application.
 * The log level of a prefixed logger is always the same as its underlying logger.
 *
 * When applied to an already prefixed logger, it preserves the full prefix chain both at runtime and in the type
 * system, allowing for strongly-typed nested prefixes.
 *
 * @example Basic Usage
 *
 * ```ts
 * import { ConsoleLogger, withPrefix } from 'emitnlog/logger';
 *
 * const logger = new ConsoleLogger();
 * const dbLogger = withPrefix(logger, 'DB');
 *
 * dbLogger.info('Connected to database');
 * // Output: "DB: Connected to database"
 * ```
 *
 * @example Template Literals
 *
 * ```ts
 * import { withPrefix } from 'emitnlog/logger';
 *
 * const dbLogger = withPrefix(logger, 'DB');
 * const queryTime = 42;
 *
 * // Prefix is maintained with template literals
 * dbLogger.d`Query executed in ${queryTime}ms`;
 * // Output: "DB: Query executed in 42ms"
 * ```
 *
 * @example Nested Prefixes
 *
 * ```ts
 * import { withPrefix } from 'emitnlog/logger';
 *
 * const dbLogger = withPrefix(logger, 'DB');
 * const userDbLogger = withPrefix(dbLogger, 'users');
 * // Type of userDbLogger is PrefixedLogger<'DB.users'>
 *
 * const userId = 123;
 * userDbLogger.w`User not found: ${userId}`;
 * // Output: "DB.users: User not found: 123"
 * ```
 *
 * @example Error Handling
 *
 * ```ts
 * import { withPrefix } from 'emitnlog/logger';
 *
 * const dbLogger = withPrefix(logger, 'DB');
 *
 * // Errors maintain their original objects while prefixing the message
 * const error = new Error('Connection failed');
 * dbLogger.error(error);
 * // Output: "DB: Connection failed" (with error object preserved in args)
 *
 * // Using args() for additional context
 * dbLogger.args(error, { connectionId: 'conn_123' }).e`Database operation failed`;
 * ```
 *
 * @example Custom Separators
 *
 * ```ts
 * import { withPrefix } from 'emitnlog/logger';
 *
 * // Custom prefix separator
 * const apiLogger = withPrefix(logger, 'API', { prefixSeparator: '/' });
 * const v1Logger = withPrefix(apiLogger, 'v1');
 * v1Logger.info('Request processed');
 * // Output: "API/v1: Request processed"
 *
 * // Custom message separator
 * const compactLogger = withPrefix(logger, 'SYS', { messageSeparator: ' | ' });
 * compactLogger.info('System ready');
 * // Output: "SYS | System ready"
 * ```
 *
 * @example Fallback Prefix
 *
 * ```ts
 * import { withPrefix } from 'emitnlog/logger';
 *
 * // Add a fallback prefix when the logger isn't already prefixed
 * const serviceLogger = withPrefix(logger, 'UserService', { fallbackPrefix: 'APP' });
 * serviceLogger.info('Service started');
 * // Output: "APP.UserService: Service started"
 *
 * // If applied to an already prefixed logger, fallback is ignored
 * const dbLogger = withPrefix(logger, 'DB');
 * const userDbLogger = withPrefix(dbLogger, 'UserService', {
 *   fallbackPrefix: 'APP', // This is ignored
 * });
 * userDbLogger.info('Service started');
 * // Output: "DB.UserService: Service started"
 * ```
 *
 * @example Level Filtering
 *
 * ```ts
 * import { withPrefix } from 'emitnlog/logger';
 *
 * const dbLogger = withPrefix(logger, 'DB');
 *
 * // Level filtering works the same as the underlying logger
 * dbLogger.level = 'warning';
 * dbLogger.d`This debug message won't be logged`;
 * dbLogger.w`This warning will be logged`;
 * // Output: "DB: This warning will be logged"
 * ```
 *
 * **Tip:** When supported by your development environment, hovering over a prefixed logger variable shows the prefix in
 * the tooltip due to the type parameter, making it easier to identify which prefix is being used.
 *
 * @param logger The base logger to wrap with prefix functionality
 * @param prefix The prefix to prepend to all log messages
 * @param options Optional configuration for the logger behavior
 * @returns A new logger with the specified prefix, or the OFF_LOGGER if the input logger is OFF_LOGGER
 */
export const withPrefix = <
  TLogger extends Logger,
  const TPrefix extends string,
  const TSeparator extends string = '.',
  const TFallbackPrefix extends string | undefined = undefined,
>(
  logger: TLogger,
  prefix: TPrefix,
  options?: {
    /**
     * The separator to use between an existing prefix and the prefix passed to this method. Defaults to '.'.
     */
    readonly prefixSeparator?: TSeparator;

    /**
     * The separator to use between the prefix and the log message. Defaults to ': '.
     */
    readonly messageSeparator?: string;

    /**
     * The fallback prefix to use if the logger is not already a prefixed logger.
     */
    readonly fallbackPrefix?: TFallbackPrefix;
  },
): WithPrefixResult<TLogger, TPrefix, TSeparator, TFallbackPrefix> => {
  if (logger === OFF_LOGGER) {
    return OFF_LOGGER as unknown as WithPrefixResult<TLogger, TPrefix, TSeparator, TFallbackPrefix>;
  }

  let prefixSeparator: TSeparator;
  let messageSeparator: string;

  const data = inspectPrefixedLogger(logger);
  if (data) {
    logger = data.rootLogger as TLogger;
    prefixSeparator = data.separator as TSeparator;
    messageSeparator = data.messageSeparator;
    prefix = (prefix ? `${data.prefix}${prefixSeparator}${prefix}` : data.prefix) as TPrefix;
  } else {
    prefixSeparator = (options?.prefixSeparator ?? '.') as TSeparator;
    messageSeparator = options?.messageSeparator ?? ': ';
    if (options?.fallbackPrefix) {
      prefix = (prefix ? `${options.fallbackPrefix}${prefixSeparator}${prefix}` : options.fallbackPrefix) as TPrefix;
    }
  }

  const prefixedLogger: PrefixedLogger<TPrefix, TSeparator> = {
    [prefixSymbol]: prefix,
    [separatorSymbol]: prefixSeparator,
    [dataSymbol]: { rootLogger: logger, messageSeparator },

    get level() {
      return logger.level;
    },

    set level(value: LogLevel | 'off') {
      logger.level = value;
    },

    args(...args: unknown[]) {
      logger.args(...args);
      return prefixedLogger;
    },

    trace(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'trace')) {
        logger.trace(toMessageProvider(prefixedLogger, message), ...args);
      }
    },

    t(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'trace')) {
        logger.t(prefixTemplateString(prefixedLogger, strings), ...values);
      }
    },

    debug(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'debug')) {
        logger.debug(toMessageProvider(prefixedLogger, message), ...args);
      }
    },

    d(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'debug')) {
        logger.d(prefixTemplateString(prefixedLogger, strings), ...values);
      }
    },

    info(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'info')) {
        logger.info(toMessageProvider(prefixedLogger, message), ...args);
      }
    },

    i(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'info')) {
        logger.i(prefixTemplateString(prefixedLogger, strings), ...values);
      }
    },

    notice(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'notice')) {
        logger.notice(toMessageProvider(prefixedLogger, message), ...args);
      }
    },

    n(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'notice')) {
        logger.n(prefixTemplateString(prefixedLogger, strings), ...values);
      }
    },

    warning(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'warning')) {
        logger.warning(toMessageProvider(prefixedLogger, message), ...args);
      }
    },

    w(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'warning')) {
        logger.w(prefixTemplateString(prefixedLogger, strings), ...values);
      }
    },

    error(error: LogMessage | Error | { error: unknown }, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'error')) {
        if (error instanceof Error) {
          logger.error(toMessageProvider(prefixedLogger, error.message), error, ...args);
        } else if (error && typeof error === 'object' && 'error' in error) {
          logger.error(toMessageProvider(prefixedLogger, String(error.error)), error, ...args);
        } else {
          logger.error(toMessageProvider(prefixedLogger, error as LogMessage), ...args);
        }
      }
    },

    e(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'error')) {
        logger.e(prefixTemplateString(prefixedLogger, strings), ...values);
      }
    },

    critical(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'critical')) {
        logger.critical(toMessageProvider(prefixedLogger, message), ...args);
      }
    },

    c(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'critical')) {
        logger.c(prefixTemplateString(prefixedLogger, strings), ...values);
      }
    },

    alert(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'alert')) {
        logger.alert(toMessageProvider(prefixedLogger, message), ...args);
      }
    },

    a(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'alert')) {
        logger.a(prefixTemplateString(prefixedLogger, strings), ...values);
      }
    },

    emergency(message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, 'emergency')) {
        logger.emergency(toMessageProvider(prefixedLogger, message), ...args);
      }
    },

    em(strings: TemplateStringsArray, ...values: unknown[]) {
      if (shouldEmitEntry(logger.level, 'emergency')) {
        logger.em(prefixTemplateString(prefixedLogger, strings), ...values);
      }
    },

    log(level: LogLevel, message: LogMessage, ...args: unknown[]) {
      if (shouldEmitEntry(logger.level, level)) {
        logger.log(level, toMessageProvider(prefixedLogger, message), ...args);
      }
    },
  };

  return prefixedLogger as unknown as WithPrefixResult<TLogger, TPrefix, TSeparator, TFallbackPrefix>;
};

/**
 * Appends a prefix to an existing prefixed logger, creating a hierarchical prefix structure.
 *
 * This utility function is specifically designed for use with already prefixed loggers. It extends the existing prefix
 * chain by appending a new prefix segment, using the same separator that was used in the original logger.
 *
 * Unlike `withPrefix`, this function has a simplified API that doesn't expose configuration options since it inherits
 * all settings (separators, etc.) from the existing prefixed logger.
 *
 * @example Basic Appending
 *
 * ```ts
 * import { ConsoleLogger, appendPrefix, withPrefix } from 'emitnlog/logger';
 *
 * const logger = new ConsoleLogger();
 * const dbLogger = withPrefix(logger, 'DB');
 * const userDbLogger = appendPrefix(dbLogger, 'users');
 *
 * userDbLogger.info('User created successfully');
 * // Output: "DB.users: User created successfully"
 * ```
 *
 * @example Multiple Levels of Nesting
 *
 * ```ts
 * import { appendPrefix, withPrefix  } from 'emitnlog/logger';
 *
 * const serviceLogger = withPrefix(logger, 'UserService');
 * const repositoryLogger = appendPrefix(serviceLogger, 'Repository');
 * const cacheLogger = appendPrefix(repositoryLogger, 'Cache');
 *
 * cacheLogger.d`Cache hit for key: user_123`;
 * // Output: "UserService.Repository.Cache: Cache hit for key: user_123"
 * ```
 *
 * @example Preserving Custom Separators
 *
 * ```ts
 * // Original logger with custom separator
 * const apiLogger = withPrefix(logger, 'API', { prefixSeparator: '/' });
 * const v1Logger = appendPrefix(apiLogger, 'v1');
 * const usersLogger = appendPrefix(v1Logger, 'users');
 *
 * usersLogger.info('Processing user request');
 * // Output: "API/v1/users: Processing user request"
 * ```
 *
 * @example Type Safety
 *
 * ```ts
 * import { appendPrefix, withPrefix } from 'emitnlog/logger';
 *
 * const dbLogger = withPrefix(logger, 'DB');
 * const userLogger = appendPrefix(dbLogger, 'User');
 * // Type of userLogger is PrefixedLogger<'DB.User', '.'>
 *
 * // TypeScript knows the exact prefix structure
 * const profileLogger = appendPrefix(userLogger, 'Profile');
 * // Type of profileLogger is PrefixedLogger<'DB.User.Profile', '.'>
 * ```
 *
 * @param logger The prefixed logger to append the prefix to
 * @param prefix The prefix segment to append to the existing prefix chain
 * @returns A new logger with the appended prefix, maintaining all original configuration
 */
export const appendPrefix = <
  const TCurrentPrefix extends string,
  const TSeparator extends string,
  const TLogger extends PrefixedLogger<TCurrentPrefix, TSeparator>,
  const TPrefix extends string,
>(
  logger: TLogger,
  prefix: TPrefix,
): WithPrefixResult<TLogger, TPrefix, TSeparator> => withPrefix(logger, prefix);

/**
 * Creates a prefixed logger with a completely new prefix, ignoring any existing prefix on the input logger.
 *
 * This utility function extracts the root (non-prefixed) logger from the input and applies a fresh prefix to it,
 * effectively "resetting" the prefix chain. This is useful when you want to create a new prefix hierarchy without
 * inheriting the existing prefix structure.
 *
 * Unlike `withPrefix`, which appends to existing prefixes, `resetPrefix` always starts with a clean slate.
 *
 * @example Basic Reset
 *
 * ```ts
 * import { ConsoleLogger, resetPrefix, withPrefix } from 'emitnlog/logger';
 *
 * const logger = new ConsoleLogger();
 * const dbLogger = withPrefix(logger, 'DB');
 * const userDbLogger = withPrefix(dbLogger, 'users'); // Prefix: "DB.users"
 *
 * // Reset to a completely new prefix
 * const apiLogger = resetPrefix(userDbLogger, 'API'); // Prefix: "API" (not "DB.users.API")
 *
 * apiLogger.info('API server started');
 * // Output: "API: API server started"
 * ```
 *
 * @example Switching Context
 *
 * ```ts
 * import { appendPrefix, resetPrefix, withPrefix } from 'emitnlog/logger';
 *
 * // Start with a deeply nested logger
 * const serviceLogger = withPrefix(logger, 'UserService');
 * const repoLogger = appendPrefix(serviceLogger, 'Repository');
 * const cacheLogger = appendPrefix(repoLogger, 'Cache'); // Prefix: "UserService.Repository.Cache"
 *
 * // Switch to a completely different context
 * const authLogger = resetPrefix(cacheLogger, 'Auth'); // Prefix: "Auth"
 * const tokenLogger = appendPrefix(authLogger, 'Token'); // Prefix: "Auth.Token"
 *
 * tokenLogger.d`Token validated successfully`;
 * // Output: "Auth.Token: Token validated successfully"
 * ```
 *
 * @example Custom Configuration
 *
 * ```ts
 * import { appendPrefix, resetPrefix, withPrefix } from 'emitnlog/logger';
 *
 * const existingLogger = withPrefix(logger, 'OldPrefix');
 *
 * // Reset with custom separators
 * const newLogger = resetPrefix(existingLogger, 'NewPrefix', { prefixSeparator: '/', messageSeparator: ' >> ' });
 *
 * const subLogger = appendPrefix(newLogger, 'SubModule');
 * subLogger.info('Module initialized');
 * // Output: "NewPrefix/SubModule >> Module initialized"
 * ```
 *
 * @example Reusing Root Logger
 *
 * ```ts
 * import { appendPrefix, resetPrefix, withPrefix } from 'emitnlog/logger';
 *
 * // Multiple loggers sharing the same root but with different prefixes
 * const dbLogger = withPrefix(logger, 'DB');
 * const complexDbLogger = appendPrefix(dbLogger, 'Complex'); // Prefix: "DB.Complex"
 *
 * // Create parallel hierarchies from the same root
 * const cacheLogger = resetPrefix(complexDbLogger, 'Cache'); // Uses same root as dbLogger
 * const metricsLogger = resetPrefix(complexDbLogger, 'Metrics'); // Uses same root as dbLogger
 *
 * cacheLogger.info('Cache warmed up'); // Output: "Cache: Cache warmed up"
 * metricsLogger.info('Metrics collected'); // Output: "Metrics: Metrics collected"
 * ```
 *
 * @param logger The logger to extract the root logger from and apply a new prefix to
 * @param prefix The new prefix to apply (completely replacing any existing prefix)
 * @param options Optional configuration for the new prefixed logger
 * @returns A new logger with the specified prefix, using the root logger from the input
 */
export const resetPrefix = <const TPrefix extends string, const TSeparator extends string = '.'>(
  logger: Logger,
  prefix: TPrefix,
  options?: {
    /**
     * The separator to use between an existing prefix and the prefix passed to this method. Defaults to '.'.
     */
    readonly prefixSeparator?: TSeparator;

    /**
     * The separator to use between the prefix and the log message. Defaults to ': '.
     */
    readonly messageSeparator?: string;
  },
): WithPrefixResult<Logger, TPrefix, TSeparator> => {
  const data = inspectPrefixedLogger(logger);
  if (data) {
    logger = data.rootLogger;
  }
  return withPrefix(logger, prefix, options);
};

export const isPrefixedLogger = (logger: Logger | undefined | null): logger is PrefixedLogger =>
  isNotNullable(logger) && prefixSymbol in logger && typeof logger[prefixSymbol] === 'string' && dataSymbol in logger;

export const inspectPrefixedLogger = (
  logger: Logger,
):
  | {
      readonly rootLogger: Logger;
      readonly prefix: string;
      readonly separator: string;
      readonly messageSeparator: string;
    }
  | undefined =>
  isPrefixedLogger(logger)
    ? {
        rootLogger: logger[dataSymbol]!.rootLogger,
        prefix: logger[prefixSymbol]!,
        separator: logger[separatorSymbol]!,
        messageSeparator: logger[dataSymbol]!.messageSeparator,
      }
    : undefined;

const prefixTemplateString = (prefixLogger: PrefixedLogger, strings: TemplateStringsArray): TemplateStringsArray => {
  const prefix = prefixLogger[prefixSymbol]!;
  const messageSeparator = prefixLogger[dataSymbol]!.messageSeparator;
  const newStrings = Array.from(strings);
  newStrings[0] = `${prefix}${messageSeparator}${newStrings[0]}`;
  const prefixedStrings = Object.assign(newStrings, { raw: Array.from(strings.raw) });
  prefixedStrings.raw[0] = `${prefix}${messageSeparator}${prefixedStrings.raw[0]}`;
  return prefixedStrings as unknown as TemplateStringsArray;
};

const toMessageProvider = (prefixLogger: PrefixedLogger, message: LogMessage) => () => {
  const messageString = typeof message === 'function' ? message() : message;
  const messageSeparator = prefixLogger[dataSymbol]!.messageSeparator;
  return `${prefixLogger[prefixSymbol]}${messageSeparator}${messageString}`;
};

type WithPrefixResult<
  TLogger extends Logger,
  TNewPrefix extends string,
  TSeparator extends string = '.',
  TFallbackPrefix extends string | undefined = undefined,
> =
  TLogger extends PrefixedLogger<infer TPrevPrefix, infer TPrevSeparator>
    ? PrefixedLogger<`${TPrevPrefix}${TPrevSeparator}${TNewPrefix}`, TPrevSeparator>
    : TFallbackPrefix extends string
      ? TNewPrefix extends ''
        ? PrefixedLogger<`${TFallbackPrefix}`, TSeparator>
        : PrefixedLogger<`${TFallbackPrefix}${TSeparator}${TNewPrefix}`, TSeparator>
      : PrefixedLogger<TNewPrefix, TSeparator>;
