import type { Logger, LogLevel, LogMessage } from './definition.ts';
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
 * const logger = tee(consoleLogger, fileLogger);
 * logger.info('This will be logged to both console and file');
 * ```
 *
 * @param loggers One or more loggers to combine.
 * @returns A new logger that fans out logs to the provided loggers. Returns the 'off logger' if loggers is empty or the
 *   specified logger is loggers length is one.
 */
export const tee = (...loggers: readonly Logger[]): Logger => {
  if (!loggers.length) {
    return OFF_LOGGER;
  }

  if (loggers.length === 1) {
    return loggers[0];
  }

  // Track pending args for the tee logger
  let pendingArgs: unknown[] = [];

  // Helper to consume pending args similar to BaseLogger
  const consumePendingArgs = (): readonly unknown[] | undefined => {
    if (!pendingArgs.length) {
      return undefined;
    }

    const args = pendingArgs;
    pendingArgs = [];
    return args;
  };

  return {
    get level() {
      return loggers[0].level;
    },

    set level(newLevel: LogLevel | 'off') {
      for (const logger of loggers) {
        logger.level = newLevel;
      }
    },

    args(...args: unknown[]): Logger {
      // Store args locally instead of forwarding immediately
      pendingArgs = args;
      return this;
    },

    trace(message: LogMessage, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).trace(message, ...args);
        } else {
          logger.trace(message, ...args);
        }
      }
    },

    t(strings: TemplateStringsArray, ...values: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).t(strings, ...values);
        } else {
          logger.t(strings, ...values);
        }
      }
    },

    debug(message: LogMessage, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).debug(message, ...args);
        } else {
          logger.debug(message, ...args);
        }
      }
    },

    d(strings: TemplateStringsArray, ...values: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).d(strings, ...values);
        } else {
          logger.d(strings, ...values);
        }
      }
    },

    info(message: LogMessage, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).info(message, ...args);
        } else {
          logger.info(message, ...args);
        }
      }
    },

    i(strings: TemplateStringsArray, ...values: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).i(strings, ...values);
        } else {
          logger.i(strings, ...values);
        }
      }
    },

    notice(message: LogMessage, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).notice(message, ...args);
        } else {
          logger.notice(message, ...args);
        }
      }
    },

    n(strings: TemplateStringsArray, ...values: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).n(strings, ...values);
        } else {
          logger.n(strings, ...values);
        }
      }
    },

    warning(message: LogMessage, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).warning(message, ...args);
        } else {
          logger.warning(message, ...args);
        }
      }
    },

    w(strings: TemplateStringsArray, ...values: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).w(strings, ...values);
        } else {
          logger.w(strings, ...values);
        }
      }
    },

    error(message: LogMessage | Error | { error: unknown }, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).error(message, ...args);
        } else {
          logger.error(message, ...args);
        }
      }
    },

    e(strings: TemplateStringsArray, ...values: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).e(strings, ...values);
        } else {
          logger.e(strings, ...values);
        }
      }
    },

    critical(message: LogMessage, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).critical(message, ...args);
        } else {
          logger.critical(message, ...args);
        }
      }
    },

    c(strings: TemplateStringsArray, ...values: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).c(strings, ...values);
        } else {
          logger.c(strings, ...values);
        }
      }
    },

    alert(message: LogMessage, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).alert(message, ...args);
        } else {
          logger.alert(message, ...args);
        }
      }
    },

    a(strings: TemplateStringsArray, ...values: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).a(strings, ...values);
        } else {
          logger.a(strings, ...values);
        }
      }
    },

    emergency(message: LogMessage, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).emergency(message, ...args);
        } else {
          logger.emergency(message, ...args);
        }
      }
    },

    em(strings: TemplateStringsArray, ...values: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).em(strings, ...values);
        } else {
          logger.em(strings, ...values);
        }
      }
    },

    log(level: LogLevel, message: LogMessage, ...args: unknown[]): void {
      const currentArgs = consumePendingArgs();
      for (const logger of loggers) {
        if (currentArgs) {
          logger.args(...currentArgs).log(level, message, ...args);
        } else {
          logger.log(level, message, ...args);
        }
      }
    },
  };
};
