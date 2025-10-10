import type { Logger, LogLevel } from './definition.ts';
import { createLogger } from './emitter/emitter-logger.ts';
import { OFF_LOGGER } from './off-logger.ts';

/**
 * Returns a logger that emits all entries using a fixed level, regardless of the log method used.
 *
 * Note: The returned logger preserves the original logger’s level filtering behavior, but every emitted entry is
 * rewritten to use the provided `level`.
 *
 * This is useful when you want messages of any severity to be treated as, say, errors.
 *
 * @example
 *
 * ```ts
 * import { createConsoleLogLogger, withEmitLevel } from 'emitnlog/logger';
 *
 * const baseLogger = createConsoleLogLogger('info');
 *
 * // A logger that emits 'info' or higher severities, all as errors.
 * const errorLogger = withEmitLevel(baseLogger, 'error');
 *
 * errorLogger.d`debug`; // Not emitted (filtered out by baseLogger.level)
 * errorLogger.i`info`; // Emitted as an error
 * errorLogger.c`error`; // Emitted as an error
 * ```
 *
 * @example Dynamic level
 *
 * ```ts
 * import { createConsoleLogLogger, withEmitLevel } from 'emitnlog/logger';
 *
 * const baseLogger = createConsoleLogLogger('trace');
 *
 * // A logger that emits all severities, outputting 'info' entries for 'trace' and 'debug'
 * const infoLogger = withEmitLevel(baseLogger, (level) =>
 *   level === 'trace' || level === 'debug' ? 'info' : level,
 * );
 *
 * infoLogger.d`debug`; // Emitted as an info
 * infoLogger.i`info`; // Emitted as an info
 * infoLogger.c`error`; // Emitted as a critical
 * ```
 *
 * @param logger The original logger to wrap.
 * @param level The level to emit all entries as (or a function that maps that level).
 * @returns A new logger that emits entries as if they were logged with `level`.
 */
export const withEmitLevel = (
  logger: Logger,
  level: LogLevel | 'off' | ((entryLevel: LogLevel) => LogLevel | 'off'),
): Logger => {
  if (level === 'off' || logger === OFF_LOGGER) {
    return OFF_LOGGER;
  }

  return createLogger(
    () => logger.level,
    (entryLevel, message, args) => {
      const emitLevel = typeof level === 'function' ? level(entryLevel) : level;
      if (emitLevel !== 'off') {
        logger.log(emitLevel, message, ...args);
      }
    },
  );
};
