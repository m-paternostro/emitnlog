import type { Writable } from 'type-fest';

import { isNotNullable } from '../utils/common/is-not-nullable.ts';
import type { Logger, LogMessage, LogTemplateStringsArray } from './definition.ts';
import { BaseLogger } from './implementation/base-logger.ts';
import { OFF_LOGGER } from './off-logger.ts';

export type PrefixedLogger<
  TPrefix extends string = string,
  TSeparator extends string | undefined = undefined,
  TLogger extends Logger = Logger,
> =
  TLogger extends PrefixedWithSeparator<infer TBaseLogger, infer TPrevPrefix, infer TPrevSeparator>
    ? PrefixedWithSeparator<
        TBaseLogger,
        `${TPrevPrefix}${TPrevSeparator}${TPrefix}`,
        TSeparator extends undefined | '' ? TPrevSeparator : TSeparator
      >
    : TLogger extends Prefixed<infer TBaseLogger, string>
      ? TSeparator extends undefined | ''
        ? Prefixed<TBaseLogger, ResolvePrefix<TLogger, TPrefix, TSeparator>>
        : PrefixedWithSeparator<
            TBaseLogger,
            ResolvePrefix<TLogger, TPrefix, TSeparator>,
            TSeparator extends undefined ? '.' : TSeparator
          >
      : TPrefix extends '' | undefined
        ? TLogger
        : TSeparator extends undefined | ''
          ? Prefixed<TLogger, TPrefix>
          : PrefixedWithSeparator<TLogger, TPrefix, TSeparator extends undefined ? '.' : TSeparator>;

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
 * import { createConsoleLogLogger, withPrefix } from 'emitnlog/logger';
 *
 * const logger = createConsoleLogLogger('info');
 * const dbLogger = withPrefix(logger, 'DB');
 *
 * dbLogger.i`Connected to database`;
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
 * v1Logger.i`Request processed`;
 * // Output: "API/v1: Request processed"
 *
 * // Custom message separator
 * const compactLogger = withPrefix(logger, 'SYS', { messageSeparator: ' | ' });
 * compactLogger.i`System ready`;
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
 * serviceLogger.i`Service started`;
 * // Output: "APP.UserService: Service started"
 *
 * // If applied to an already prefixed logger, fallback is ignored
 * const dbLogger = withPrefix(logger, 'DB');
 * const userDbLogger = withPrefix(dbLogger, 'UserService', {
 *   fallbackPrefix: 'APP', // This is ignored
 * });
 * userDbLogger.i`Service started`;
 * // Output: "DB.UserService: Service started"
 * ```
 *
 * @example Level Filtering
 *
 * ```ts
 * import { createConsoleLogLogger, withPrefix } from 'emitnlog/logger';
 *
 * // Underlying logger controls filtering
 * const base = createConsoleLogLogger('warning');
 * const dbLogger = withPrefix(base, 'DB');
 *
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
  const TLogger extends Logger,
  const TPrefix extends string,
  const TSeparator extends string | undefined = undefined,
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
): PrefixedLogger<ResolvePrefixWithFallback<TLogger, TPrefix, TSeparator, TFallbackPrefix>, TSeparator, TLogger> => {
  if (logger === OFF_LOGGER) {
    return OFF_LOGGER as unknown as PrefixedLogger<
      ResolvePrefixWithFallback<TLogger, TPrefix, TSeparator, TFallbackPrefix>,
      TSeparator,
      TLogger
    >;
  }

  let prefixSeparator: TSeparator;
  let messageSeparator: string;

  const data = inspectPrefixedLogger(logger);
  if (data) {
    logger = data.rootLogger as TLogger;
    prefixSeparator = (options?.prefixSeparator || data.separator) as TSeparator;
    messageSeparator = data.messageSeparator;
    prefix = (prefix ? `${data.prefix}${data.separator || '.'}${prefix}` : data.prefix) as TPrefix;
  } else {
    prefixSeparator = options?.prefixSeparator as TSeparator;
    messageSeparator = options?.messageSeparator || ': ';
    if (options?.fallbackPrefix) {
      prefix = (
        prefix ? `${options.fallbackPrefix}${prefixSeparator || '.'}${prefix}` : options.fallbackPrefix
      ) as TPrefix;
    }
  }

  if (!prefix) {
    return logger as unknown as PrefixedLogger<
      ResolvePrefixWithFallback<TLogger, TPrefix, TSeparator, TFallbackPrefix>,
      TSeparator,
      TLogger
    >;
  }

  const prefixedLogger = createPrefixedLogger(logger, prefix, prefixSeparator, messageSeparator);
  return prefixedLogger as unknown as PrefixedLogger<
    ResolvePrefixWithFallback<TLogger, TPrefix, TSeparator, TFallbackPrefix>,
    TSeparator,
    TLogger
  >;
};

const createPrefixedLogger = <TPrefix extends string = string, TSeparator extends string | undefined = undefined>(
  rootLogger: Logger,
  prefix: TPrefix,
  prefixSeparator: TSeparator,
  messageSeparator: string,
): Logger => {
  let pendingArgs: unknown[] = [];

  const consumePendingArgs = (): readonly unknown[] | undefined => {
    if (!pendingArgs.length) {
      return undefined;
    }

    const args = pendingArgs;
    pendingArgs = [];
    return args;
  };

  const runLogOperation = (internalLogger: InternalPrefixedLogger, operation: (logger: Logger) => void) => {
    const logger = internalLogger[rootLoggerSymbol];
    const currentArgs = consumePendingArgs();
    if (currentArgs) {
      logger.args(...currentArgs);
    }
    operation(logger);
  };

  const internalLogger: InternalPrefixedLogger = {
    [prefixSymbol]: prefix,
    [separatorSymbol]: prefixSeparator,
    [messageSeparatorSymbol]: messageSeparator,
    [rootLoggerSymbol]: rootLogger,

    get level() {
      return internalLogger[rootLoggerSymbol].level;
    },

    args: (...args) => {
      pendingArgs.push(...args);
      return internalLogger;
    },

    trace: (message, ...args) => {
      runLogOperation(internalLogger, (logger) => logger.trace(toMessageProvider(internalLogger, message), ...args));
    },
    t: (strings, ...values) => {
      runLogOperation(internalLogger, (logger) => logger.t(toTemplateProvider(internalLogger, strings), ...values));
    },

    debug: (message, ...args) => {
      runLogOperation(internalLogger, (logger) => logger.debug(toMessageProvider(internalLogger, message), ...args));
    },
    d: (strings, ...values) => {
      runLogOperation(internalLogger, (logger) => logger.d(toTemplateProvider(internalLogger, strings), ...values));
    },

    info: (message, ...args) => {
      runLogOperation(internalLogger, (logger) => logger.info(toMessageProvider(internalLogger, message), ...args));
    },
    i: (strings, ...values) => {
      runLogOperation(internalLogger, (logger) => logger.i(toTemplateProvider(internalLogger, strings), ...values));
    },

    notice: (message, ...args) => {
      runLogOperation(internalLogger, (logger) => logger.notice(toMessageProvider(internalLogger, message), ...args));
    },
    n: (strings, ...values) => {
      runLogOperation(internalLogger, (logger) => logger.n(toTemplateProvider(internalLogger, strings), ...values));
    },

    warning: (input, ...args) => {
      runLogOperation(internalLogger, (logger) => {
        const converted = toErrorInput(internalLogger, input, args);
        logger.warning(converted.message, ...converted.args);
      });
    },
    w: (strings, ...values) => {
      runLogOperation(internalLogger, (logger) => logger.w(toTemplateProvider(internalLogger, strings), ...values));
    },

    error: (input, ...args) => {
      runLogOperation(internalLogger, (logger) => {
        const converted = toErrorInput(internalLogger, input, args);
        logger.error(converted.message, ...converted.args);
      });
    },
    e: (strings, ...values) => {
      runLogOperation(internalLogger, (logger) => logger.e(toTemplateProvider(internalLogger, strings), ...values));
    },

    critical: (input, ...args) => {
      runLogOperation(internalLogger, (logger) => {
        const converted = toErrorInput(internalLogger, input, args);
        logger.critical(converted.message, ...converted.args);
      });
    },
    c: (strings, ...values) => {
      runLogOperation(internalLogger, (logger) => logger.c(toTemplateProvider(internalLogger, strings), ...values));
    },

    alert: (input, ...args) => {
      runLogOperation(internalLogger, (logger) => {
        const converted = toErrorInput(internalLogger, input, args);
        logger.alert(converted.message, ...converted.args);
      });
    },
    a: (strings, ...values) => {
      runLogOperation(internalLogger, (logger) => logger.a(toTemplateProvider(internalLogger, strings), ...values));
    },

    emergency: (input, ...args) => {
      runLogOperation(internalLogger, (logger) => {
        const converted = toErrorInput(internalLogger, input, args);
        logger.emergency(converted.message, ...converted.args);
      });
    },
    em: (strings, ...values) => {
      runLogOperation(internalLogger, (logger) => logger.em(toTemplateProvider(internalLogger, strings), ...values));
    },

    log: (level, message, ...args) => {
      runLogOperation(internalLogger, (logger) =>
        logger.log(level, toMessageProvider(internalLogger, message), ...args),
      );
    },

    flush: rootLogger.flush ? () => internalLogger[rootLoggerSymbol].flush?.() : undefined,
    close: rootLogger.close ? () => internalLogger[rootLoggerSymbol].close?.() : undefined,
  } as const;

  return internalLogger;
};

const toMessageProvider = (prefixLogger: InternalPrefixedLogger, message: LogMessage) => (): string => {
  if (typeof message === 'function') {
    message = message();
  }
  return `${prefixLogger[prefixSymbol]}${prefixLogger[messageSeparatorSymbol]}${message}`;
};

const toErrorInput = (
  prefixLogger: InternalPrefixedLogger,
  input: LogMessage | Error | { error: unknown },
  args: readonly unknown[],
): { readonly message: LogMessage; readonly args: readonly unknown[] } => {
  const logger = prefixLogger[rootLoggerSymbol];
  const converted = BaseLogger.convertErrorInput(logger, input, args);
  return { message: toMessageProvider(prefixLogger, converted.message), args: converted.args };
};

const toTemplateProvider =
  (prefixLogger: InternalPrefixedLogger, strings: LogTemplateStringsArray) => (): TemplateStringsArray => {
    if (typeof strings === 'function') {
      strings = strings();
    }

    const prefix = `${prefixLogger[prefixSymbol]}${prefixLogger[messageSeparatorSymbol]}`;
    const newStrings = Array.from(strings);
    newStrings[0] = `${prefix}${newStrings[0]}`;
    const prefixedStrings = Object.assign(newStrings, { raw: Array.from(strings.raw) });
    prefixedStrings.raw[0] = `${prefix}${prefixedStrings.raw[0]}`;

    return prefixedStrings;
  };

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
 * import { createConsoleLogLogger, resetPrefix, withPrefix } from 'emitnlog/logger';
 *
 * const logger = createConsoleLogLogger('info');
 * const dbLogger = withPrefix(logger, 'DB');
 * const userDbLogger = withPrefix(dbLogger, 'users'); // Prefix: "DB.users"
 *
 * // Reset to a completely new prefix
 * const apiLogger = resetPrefix(userDbLogger, 'API'); // Prefix: "API" (not "DB.users.API")
 *
 * apiLogger.i`API server started`;
 * // Output: "API: API server started"
 * ```
 *
 * @example Switching Context
 *
 * ```ts
 * import { resetPrefix, withPrefix } from 'emitnlog/logger';
 *
 * // Start with a deeply nested logger
 * const serviceLogger = withPrefix(logger, 'UserService');
 * const repoLogger = withPrefix(serviceLogger, 'Repository');
 * const cacheLogger = withPrefix(repoLogger, 'Cache'); // Prefix: "UserService.Repository.Cache"
 *
 * // Switch to a completely different context
 * const authLogger = resetPrefix(cacheLogger, 'Auth'); // Prefix: "Auth"
 * const tokenLogger = withPrefix(authLogger, 'Token'); // Prefix: "Auth.Token"
 *
 * tokenLogger.d`Token validated successfully`;
 * // Output: "Auth.Token: Token validated successfully"
 * ```
 *
 * @example Custom Configuration
 *
 * ```ts
 * import { resetPrefix, withPrefix } from 'emitnlog/logger';
 *
 * const existingLogger = withPrefix(logger, 'OldPrefix');
 *
 * // Reset with custom separators
 * const newLogger = resetPrefix(existingLogger, 'NewPrefix', { prefixSeparator: '/', messageSeparator: ' >> ' });
 *
 * const subLogger = withPrefix(newLogger, 'SubModule');
 * subLogger.i`Module initialized`;
 * // Output: "NewPrefix/SubModule >> Module initialized"
 * ```
 *
 * @example Reusing Root Logger
 *
 * ```ts
 * import { resetPrefix, withPrefix } from 'emitnlog/logger';
 *
 * // Multiple loggers sharing the same root but with different prefixes
 * const dbLogger = withPrefix(logger, 'DB');
 * const complexDbLogger = withPrefix(dbLogger, 'Complex'); // Prefix: "DB.Complex"
 *
 * // Create parallel hierarchies from the same root
 * const cacheLogger = resetPrefix(complexDbLogger, 'Cache'); // Uses same root as dbLogger
 * const metricsLogger = resetPrefix(complexDbLogger, 'Metrics'); // Uses same root as dbLogger
 *
 * cacheLogger.i`Cache warmed up`; // Output: "Cache: Cache warmed up"
 * metricsLogger.i`Metrics collected`; // Output: "Metrics: Metrics collected"
 * ```
 *
 * @param logger The logger to extract the root logger from and apply a new prefix to
 * @param prefix The new prefix to apply (completely replacing any existing prefix)
 * @param options Optional configuration for the new prefixed logger
 * @returns A new logger with the specified prefix, using the root logger from the input
 */
export const resetPrefix = <
  const TPrefix extends string,
  const TSeparator extends string = '.',
  const TLogger extends Logger = Logger,
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
  },
) => {
  const data = inspectPrefixedLogger(logger);
  if (data) {
    logger = data.rootLogger as TLogger;
  }
  return withPrefix(logger as Logger, prefix, options);
};

/**
 * Checks if a logger is a prefixed logger.
 *
 * @param logger The logger to check.
 * @returns True if the logger is a prefixed logger, false otherwise.
 */
export const isPrefixedLogger = (logger: Logger | undefined | null): logger is PrefixedLogger =>
  isInternalPrefixedLogger(logger);

export type PrefixInformation = {
  readonly rootLogger: Logger;
  readonly prefix: string;
  readonly separator: string | undefined;
  readonly messageSeparator: string;
};

/**
 * Inspects a logger to get its prefix information.
 *
 * @param logger The logger to inspect.
 * @returns The prefix information, or undefined if the logger is not a prefixed logger.
 */
export const inspectPrefixedLogger = (logger: Logger): PrefixInformation | undefined =>
  isInternalPrefixedLogger(logger)
    ? {
        rootLogger: logger[rootLoggerSymbol],
        prefix: logger[prefixSymbol],
        separator: logger[separatorSymbol],
        messageSeparator: logger[messageSeparatorSymbol],
      }
    : undefined;

/**
 * Important: this is an advanced utility, meant for logger implementors.
 *
 * Injects the prefix information from a source logger into a target logger so that the target is handled as a prefixed
 * logger by other utilities.
 *
 * Use it carefully:
 *
 * - This method modifies `target` so that object must not be read-only.
 * - This method does not cause `target` to write out the prefixed messages: this MUST be already handled by `target`
 *
 * @param source A logger
 * @param target A logger to inject the prefix information into
 * @returns If source is prefixed, the modified target logger. Otherwise the unmodified target.
 */
export const injectPrefixInformation = <P extends PrefixedLogger>(source: P, target: Logger): P => {
  const prefixInformation = inspectPrefixedLogger(source);
  if (prefixInformation) {
    (target as unknown as Writable<InternalPrefixedLogger>)[rootLoggerSymbol] = prefixInformation.rootLogger;
    (target as unknown as Writable<InternalPrefixedLogger>)[prefixSymbol] = prefixInformation.prefix;
    (target as unknown as Writable<InternalPrefixedLogger>)[separatorSymbol] = prefixInformation.separator;
    (target as unknown as Writable<InternalPrefixedLogger>)[messageSeparatorSymbol] =
      prefixInformation.messageSeparator;
  }

  return target as unknown as P;
};

/**
 * Important: this is an advanced utility, meant for logger implementors.
 *
 * If needed, creates a new prefixed logger that wraps the root-most logger in a prefix chain with the specified wrapper
 * so that the wrapping is applied after all prefixes are combined.
 *
 * @param source A logger
 * @param wrapper The wrapper to be applied
 * @returns If logger is prefixed, the new prefixed logger with the root-most logger wrapped. Otherwise the wrapped
 *   version of the specified logger.
 */
export const handlePrefixWrapping = (logger: Logger, wrapper: (logger: Logger) => Logger): Logger => {
  const prefixInformation = inspectPrefixedLogger(logger);
  if (prefixInformation) {
    const wrapped = handlePrefixWrapping(prefixInformation.rootLogger, wrapper);
    logger = createPrefixedLogger(
      wrapped,
      prefixInformation.prefix,
      prefixInformation.separator,
      prefixInformation.messageSeparator,
    );
  } else {
    logger = wrapper(logger);
  }
  return logger;
};

declare const tag: unique symbol;
type PrefixContainer<Token> = { readonly [tag]: Token };

type ResolvePrefixWithFallback<
  TLogger extends Logger,
  TNewPrefix extends string,
  TSeparator extends string | undefined = undefined,
  TFallbackPrefix extends string | undefined = undefined,
> =
  TLogger extends Prefixed<Logger, string>
    ? TNewPrefix
    : TFallbackPrefix extends '' | undefined
      ? TNewPrefix
      : TNewPrefix extends ''
        ? `${TFallbackPrefix}`
        : `${TFallbackPrefix}${UseSeparator<TSeparator>}${TNewPrefix}`;

type ResolvePrefix<
  TLogger extends Logger,
  TNewPrefix extends string,
  TSeparator extends string | undefined = undefined,
  TFallbackPrefix extends string | undefined = undefined,
> =
  TLogger extends Prefixed<Logger, infer TPrevPrefix>
    ? TNewPrefix extends ''
      ? `${TPrevPrefix}`
      : `${TPrevPrefix}${UseSeparator<TSeparator>}${TNewPrefix}`
    : TFallbackPrefix extends '' | undefined
      ? TNewPrefix
      : TNewPrefix extends ''
        ? `${TFallbackPrefix}`
        : `${TFallbackPrefix}${UseSeparator<TSeparator>}${TNewPrefix}`;

type Prefix<TValue extends string> = PrefixContainer<{ 'emitnlog.prefix': TValue }>;
type Separator<TValue extends string> = PrefixContainer<{ 'emitnlog.separator': TValue }>;

type Prefixed<TLogger extends Logger, TPrefix extends string> = TLogger & Prefix<TPrefix>;

type PrefixedWithSeparator<TLogger extends Logger, TPrefix extends string, TSeparator extends string> = TLogger &
  Prefix<TPrefix> &
  Separator<TSeparator>;

type UseSeparator<TValue extends string | undefined, TDefault extends string = '.'> = TValue extends undefined | ''
  ? TDefault
  : TValue;

const prefixSymbol: unique symbol = Symbol.for('@emitnlog/logger/prefix');
const separatorSymbol: unique symbol = Symbol.for('@emitnlog/logger/separator');
const messageSeparatorSymbol: unique symbol = Symbol.for('@emitnlog/logger/messageSeparator');
const rootLoggerSymbol: unique symbol = Symbol.for('@emitnlog/logger/rootLogger');

type InternalPrefixedLogger = Logger & {
  readonly [prefixSymbol]: string;
  readonly [separatorSymbol]: string | undefined;
  readonly [messageSeparatorSymbol]: string;
  readonly [rootLoggerSymbol]: Logger;
};

const isInternalPrefixedLogger = (logger: Logger | undefined | null): logger is InternalPrefixedLogger =>
  isNotNullable(logger) &&
  prefixSymbol in logger &&
  typeof logger[prefixSymbol] === 'string' &&
  separatorSymbol in logger &&
  (typeof logger[separatorSymbol] === 'string' || logger[separatorSymbol] === undefined) &&
  rootLoggerSymbol in logger &&
  logger[rootLoggerSymbol] !== undefined &&
  messageSeparatorSymbol in logger &&
  typeof logger[messageSeparatorSymbol] === 'string';
