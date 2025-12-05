import { emptyArray } from '../utils/common/singleton.ts';
import type { Logger, LogLevel } from './definition.ts';
import { createLogger } from './emitter/emitter-logger.ts';
import { shouldEmitEntry } from './implementation/level-utils.ts';
import { OFF_LOGGER } from './off-logger.ts';
import { handlePrefixWrapping } from './prefixed-logger.ts';

/**
 * Returns a logger that emits all entries using a fixed level, regardless of the log method used.
 *
 * Note: The returned logger preserves the decorated logger’s level filtering behavior, but every emitted entry is
 * rewritten to use the provided "filtering level". To create a logger with a different filtering level, use
 * {@link withMinimumLevel}.
 *
 * This is useful when you want messages of any severity to be treated as, say, errors.
 *
 * @example
 *
 * ```ts
 * import { createConsoleLogLogger, withFixedLevel } from 'emitnlog/logger';
 *
 * const baseLogger = createConsoleLogLogger('info');
 *
 * // A logger that emits 'info' or higher severities, all as errors.
 * const errorLogger = withFixedLevel(baseLogger, 'error');
 *
 * errorLogger.d`debug`; // Not emitted (filtered out by baseLogger.level)
 * errorLogger.i`info`; // Emitted as an error
 * errorLogger.c`error`; // Emitted as an error
 * ```
 *
 * @example Dynamic level
 *
 * ```ts
 * import { createConsoleLogLogger, withFixedLevel } from 'emitnlog/logger';
 *
 * const baseLogger = createConsoleLogLogger('trace');
 *
 * // A logger that emits all severities, outputting 'info' entries for 'trace' and 'debug'
 * const infoLogger = withFixedLevel(baseLogger, (level) =>
 *   level === 'trace' || level === 'debug' ? 'info' : level,
 * );
 *
 * infoLogger.d`debug`; // Emitted as an info
 * infoLogger.i`info`; // Emitted as an info
 * infoLogger.c`error`; // Emitted as a critical
 * ```
 *
 * @param logger The logger to decorate.
 * @param level The level to emit all entries as (or a function that maps that level).
 * @returns A new logger that emits entries as if they were logged with `level`.
 */
export const withFixedLevel = (
  logger: Logger,
  level: LogLevel | 'off' | ((entryLevel: LogLevel) => LogLevel | 'off'),
): Logger => {
  if (logger === OFF_LOGGER) {
    return OFF_LOGGER;
  }

  return handlePrefixWrapping(logger, (original: Logger) =>
    createLogger(
      () => original.level,
      (entryLevel, message, args) => {
        const emitLevel = typeof level === 'function' ? level(entryLevel) : level;
        if (emitLevel !== 'off') {
          original.log(emitLevel, message, ...(args ?? emptyArray()));
        }
      },
    ),
  );
};

/**
 * Returns a logger that evaluates entries against a new minimum level before delegating to the decorated logger.
 *
 * This decorator introduces an additional level threshold, without disabling the original logger’s own filtering:
 *
 * - First, the provided `level` (or `level` function) is used to decide whether an entry should be considered for
 *   emission.
 * - Then, if the decorated logger’s own level is stricter than the entry’s level, the entry is bumped up to that stricter
 *   level so it isn’t filtered out when delegated.
 *
 * In other words, the effective emission threshold is the stricter of:
 *
 * - The level configured via `withMinimumLevel`, and
 * - The decorated logger’s current level.
 *
 * This is useful when you want to tighten or dynamically adjust the minimum severity for a specific call site, while
 * still respecting the base logger’s configuration and output behavior (including prefixes, destinations, and argument
 * handling).
 *
 * The returned logger:
 *
 * - Preserves the decorated logger’s output behavior and destination.
 * - Reflects dynamic changes in both the provided `level` function and the decorated logger’s own level.
 * - Treats a `level` of `'off'` as “never emit”, while still returning a real logger (use {@link OFF_LOGGER} directly when
 *   you want a singleton no-op logger).
 *
 * @example Enforce a stricter level
 *
 * ```ts
 * import { createConsoleLogLogger, withMinimumLevel } from 'emitnlog/logger';
 *
 * const baseLogger = createConsoleLogLogger('trace');
 * const errorOnlyLogger = withMinimumLevel(baseLogger, 'error');
 *
 * errorOnlyLogger.i`info`; // Not emitted
 * errorOnlyLogger.e`error`; // Emitted as an error
 * ```
 *
 * @example Dynamic level
 *
 * ```ts
 * import { createConsoleLogLogger, withMinimumLevel } from 'emitnlog/logger';
 *
 * let currentLevel: LogLevel = 'info';
 * const adjustableLogger = withMinimumLevel(createConsoleLogLogger('trace'), () => currentLevel);
 *
 * adjustableLogger.i`info`; // Emitted while currentLevel is 'info'
 *
 * currentLevel = 'error';
 * adjustableLogger.i`info`; // Filtered out
 * adjustableLogger.e`error`; // Emitted
 * ```
 *
 * @param logger The logger to decorate.
 * @param level The level (or level provider) to use as the minimum severity threshold.
 * @returns A logger that filters entries using `level` and then delegates to `logger`, ensuring the delegated level is
 *   never lower than the decorated logger’s own level.
 */
export const withMinimumLevel = (logger: Logger, level: LogLevel | 'off' | (() => LogLevel | 'off')): Logger => {
  if (logger === OFF_LOGGER) {
    return OFF_LOGGER;
  }

  return handlePrefixWrapping(logger, (original: Logger) =>
    createLogger(level, (entryLevel, message, args) => {
      const originalLevel = original.level;
      if (originalLevel !== 'off' && !shouldEmitEntry(originalLevel, entryLevel)) {
        entryLevel = originalLevel;
      }
      original.log(entryLevel, message, ...(args ?? emptyArray()));
    }),
  );
};
