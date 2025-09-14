import type { Logger, LogLevel, LogMessage, LogTemplateStringsArray } from './definition.ts';
import { asSingleFinalizer, type ForgeFinalizer, type MergeFinalizer } from './implementation/finalizer.ts';
import { LOWEST_SEVERITY_LOG_LEVEL, toLevelSeverity } from './implementation/level-utils.ts';
import { OFF_LOGGER } from './off-logger.ts';

/**
 * Creates a new logger that forwards all log entries to the provided loggers.
 *
 * The returned logger (a "tee") behaves like a standard logger but duplicates every log operation to each of the
 * underlying loggers.
 *
 * ### Log level behavior
 *
 * The tee's `level` is computed from the underlying loggers to be the most permissive among them. It does not expose a
 * setter and does not attempt to keep child levels in sync. Changing the level of individual child loggers after
 * composing may lead to different filtering per destination, which is expected.
 *
 * @example
 *
 * ```ts
 * import { createConsoleErrorLogger, tee } from 'emitnlog/logger';
 * import { createFileLogger } from 'emitnlog/logger/node';
 *
 * const consoleLogger = createConsoleErrorLogger('info');
 * const fileLogger = createFileLogger('~/tmp/entries.log');
 * const logger = tee(consoleLogger, fileLogger);
 * logger.i`This will be logged to both console error and file`;
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

  type TeeInput = LogMessage | Error | { error: unknown };

  const toTeeInputProvider = <I>(message: I): I => {
    if (typeof message === 'function') {
      let cache: unknown = toTeeInputProvider;
      return (() => {
        if (cache === toTeeInputProvider) {
          cache = (message as () => I)();
        }
        return cache;
      }) as I;
    }

    return message;
  };

  const runLogOperation = <I extends TeeInput>(input: I, operation: (logger: Logger, input: I) => void) => {
    const currentArgs = consumePendingArgs();
    input = toTeeInputProvider(input);
    loggers.forEach((logger) => {
      if (currentArgs) {
        logger.args(...currentArgs);
      }
      operation(logger, input);
    });
  };

  const runTemplateOperation = <I extends LogTemplateStringsArray>(
    input: I,
    values: unknown[],
    operation: (logger: Logger, input: I, values: unknown[]) => void,
  ) => {
    const currentArgs = consumePendingArgs();
    input = toTeeInputProvider(input);
    values = values.map(toTeeInputProvider);
    loggers.forEach((logger) => {
      if (currentArgs) {
        logger.args(...currentArgs);
      }
      operation(logger, input, values);
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

    trace: (message, ...args) => runLogOperation(message, (logger, i) => logger.trace(i, ...args)),
    debug: (message, ...args) => runLogOperation(message, (logger, i) => logger.debug(i, ...args)),
    info: (message, ...args) => runLogOperation(message, (logger, i) => logger.info(i, ...args)),
    notice: (message, ...args) => runLogOperation(message, (logger, i) => logger.notice(i, ...args)),
    error: (input, ...args) => runLogOperation(input, (logger, i) => logger.error(i, ...args)),
    warning: (input, ...args) => runLogOperation(input, (logger, i) => logger.warning(i, ...args)),
    critical: (input, ...args) => runLogOperation(input, (logger, i) => logger.critical(i, ...args)),
    alert: (input, ...args) => runLogOperation(input, (logger, i) => logger.alert(i, ...args)),
    emergency: (input, ...args) => runLogOperation(input, (logger, i) => logger.emergency(i, ...args)),
    log: (level, message, ...args) => runLogOperation(message, (logger, i) => logger.log(level, i, ...args)),

    t: (strings, ...values) => runTemplateOperation(strings, values, (logger, i, v) => logger.t(i, ...v)),
    d: (strings, ...values) => runTemplateOperation(strings, values, (logger, i, v) => logger.d(i, ...v)),
    i: (strings, ...values) => runTemplateOperation(strings, values, (logger, i, v) => logger.i(i, ...v)),
    n: (strings, ...values) => runTemplateOperation(strings, values, (logger, i, v) => logger.n(i, ...v)),
    w: (strings, ...values) => runTemplateOperation(strings, values, (logger, i, v) => logger.w(i, ...v)),
    e: (strings, ...values) => runTemplateOperation(strings, values, (logger, i, v) => logger.e(i, ...v)),
    c: (strings, ...values) => runTemplateOperation(strings, values, (logger, i, v) => logger.c(i, ...v)),
    a: (strings, ...values) => runTemplateOperation(strings, values, (logger, i, v) => logger.a(i, ...v)),
    em: (strings, ...values) => runTemplateOperation(strings, values, (logger, i, v) => logger.em(i, ...v)),

    ...finalizer,
  };

  return teeLogger as TeeLogger<T>;
};

type TeeLogger<Ls extends readonly Logger[]> = MergeFinalizer<Logger, ForgeFinalizer<Ls>>;
