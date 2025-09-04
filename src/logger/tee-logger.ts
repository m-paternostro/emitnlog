import type { Logger, LogLevel } from './definition.ts';
import { asSingleFinalizer, type ForgeFinalizer, type MergeFinalizer } from './implementation/finalizer.ts';
import { LOWEST_SEVERITY_LOG_LEVEL, toLevelSeverity } from './implementation/level-utils.ts';
import { OFF_LOGGER } from './off-logger.ts';

/**
 * Creates a new logger that forwards all log entries to the provided loggers.
 *
 * The returned logger (a "tee") behaves like a standard logger but duplicates every log operation to each of the
 * underlying loggers.
 *
 * ### Log level synchronization
 *
 * - When the tee logger is created, its `level` is synchronized with the first logger.
 * - When the tee logger's `level` is updated, it updates all underlying loggers.
 * - However, the tee does **not actively keep levels in sync** after that point.
 *
 * Clients should avoid changing the log level on the individual loggers after teeing, as this may lead to inconsistent
 * filtering behavior across outputs.
 *
 * @example
 *
 * ```ts
 * import { tee } from 'emitnlog/logger';
 *
 * const logger = tee(consoleLogger, fileLogger);
 * logger.info('This will be logged to both console and file');
 * ```
 *
 * @param loggers One or more loggers to combine.
 * @returns A new logger that fans out logs to the provided loggers. Returns the 'off logger' if loggers is empty or the
 *   specified logger is loggers length is one.
 */
export const tee = <T extends readonly Logger[]>(...loggers: T): TeeLogger<T> => {
  loggers = loggers.filter((logger) => logger !== OFF_LOGGER) as unknown as T;

  if (!loggers.length) {
    return OFF_LOGGER as TeeLogger<T>;
  }

  if (loggers.length === 1) {
    return loggers[0] as TeeLogger<T>;
  }

  const computeLevel = (): LogLevel | 'off' => {
    const level = loggers.reduce<LogLevel | 'off'>((acc, logger) => {
      if (logger.level === 'off') {
        return acc;
      }

      if (acc === 'off') {
        return logger.level;
      }

      // Return the most permissive level (i.e., the highest severity) among all loggers
      return toLevelSeverity(acc) > toLevelSeverity(logger.level) ? acc : logger.level;
    }, LOWEST_SEVERITY_LOG_LEVEL);

    return level;
  };

  let pendingArgs: unknown[] = [];

  const consumePendingArgs = (): readonly unknown[] | undefined => {
    if (!pendingArgs.length) {
      return undefined;
    }

    const args = pendingArgs;
    pendingArgs = [];
    return args;
  };

  const runLogOperation = (operation: (logger: Logger) => void) => {
    const currentArgs = consumePendingArgs();
    loggers.forEach((logger) => {
      if (currentArgs) {
        logger.args(...currentArgs);
      }
      operation(logger);
    });
  };

  const finalizer = asSingleFinalizer(...loggers);

  const teeLogger: Logger = {
    get level() {
      return computeLevel();
    },

    args: (...args) => {
      pendingArgs.push(...args);
      return teeLogger;
    },

    trace: (message, ...args) => runLogOperation((logger) => logger.trace(message, ...args)),
    t: (strings, ...values) => runLogOperation((logger) => logger.t(strings, ...values)),
    debug: (message, ...args) => runLogOperation((logger) => logger.debug(message, ...args)),
    d: (strings, ...values) => runLogOperation((logger) => logger.d(strings, ...values)),
    info: (message, ...args) => runLogOperation((logger) => logger.info(message, ...args)),
    i: (strings, ...values) => runLogOperation((logger) => logger.i(strings, ...values)),
    notice: (message, ...args) => runLogOperation((logger) => logger.notice(message, ...args)),
    n: (strings, ...values) => runLogOperation((logger) => logger.n(strings, ...values)),
    warning: (input, ...args) => runLogOperation((logger) => logger.warning(input, ...args)),
    w: (strings, ...values) => runLogOperation((logger) => logger.w(strings, ...values)),
    error: (input, ...args) => runLogOperation((logger) => logger.error(input, ...args)),
    e: (strings, ...values) => runLogOperation((logger) => logger.e(strings, ...values)),
    critical: (input, ...args) => runLogOperation((logger) => logger.critical(input, ...args)),
    c: (strings, ...values) => runLogOperation((logger) => logger.c(strings, ...values)),
    alert: (input, ...args) => runLogOperation((logger) => logger.alert(input, ...args)),
    a: (strings, ...values) => runLogOperation((logger) => logger.a(strings, ...values)),
    emergency: (input, ...args) => runLogOperation((logger) => logger.emergency(input, ...args)),
    em: (strings, ...values) => runLogOperation((logger) => logger.em(strings, ...values)),
    log: (level, message, ...args) => runLogOperation((logger) => logger.log(level, message, ...args)),

    ...finalizer,
  };

  return teeLogger as TeeLogger<T>;
};

type TeeLogger<Ls extends readonly Logger[]> = MergeFinalizer<Logger, ForgeFinalizer<Ls>>;
