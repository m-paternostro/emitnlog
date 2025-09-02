import type { Logger, LogLevel } from './definition.ts';
import { asDelegatedSink, asSingleSink } from './emitter/common.ts';
import { createLogger } from './emitter/emitter-logger.ts';
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
export const tee = (...loggers: readonly Logger[]): Logger => {
  if (!loggers.length) {
    return OFF_LOGGER;
  }

  if (loggers.length === 1) {
    return loggers[0];
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

  const emitter = asSingleSink(...loggers.map(asDelegatedSink));
  return createLogger(computeLevel, emitter);
};
