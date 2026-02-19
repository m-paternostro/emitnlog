import type { SetReturnType } from 'type-fest';

import { emptyArray, emptyRecord } from '../utils/common/empty.ts';
import type { Logger, LogLevel } from './definition.ts';
import { createLogger } from './emitter/emitter-logger.ts';
import type { LogSink } from './emitter/sink.ts';
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

/**
 * Returns a logger that suppresses duplicate emissions (same `level` + formatted `message`) within a sliding buffer.
 *
 * This is handy when a noisy subsystem produces identical messages in rapid succession (for example, repeating “still
 * waiting…” entries in a console logger). The decorator tracks recently emitted entries and only forwards the first
 * occurrence, clearing the buffer automatically when the buffer maximum size is reached, or after a specified amount of
 * time (determined by `flushInterval`). The buffer is also clearer on the returned logger `flush` or `close`.
 *
 * @example CLI-friendly logger
 *
 * ```ts
 * import { createConsoleLogLogger, withDedup } from 'emitnlog/logger';
 *
 * const logger = withDedup(createConsoleLogLogger('info'), { emitOnArgs: true });
 *
 * logger.info('connecting'); // emitted
 * logger.info('connecting'); // suppressed (duplicate)
 * logger.info('connecting', { attempt: 2 }); // emitted due to args
 * ```
 *
 * @example Manual buffer reset
 *
 * ```ts
 * const deduped = withDedup(createConsoleLogLogger('info'));
 * deduped.warning('pending');
 * deduped.warning('pending'); // suppressed
 *
 * await deduped.flush?.(); // clears dedup buffer + forwards to wrapped logger
 * deduped.warning('pending'); // emitted again
 * ```
 *
 * @param logger The logger to decorate (prefixed loggers stay prefixed).
 * @param options Additional options for the deduplication behavior.
 * @returns A logger that prevents duplicate entries from being emitted.
 */
export const withDedup = (
  logger: Logger,
  options?: {
    /**
     * The maximum number of entries to buffer before flushing. `1` is used as the minimum value.
     *
     * @default 100
     */
    readonly flushSize?: number;

    /**
     * The interval in milliseconds to flush the buffer.
     *
     * Setting this to `0` disables the automatic flush based on time.
     *
     * @default 1s (1000)
     */
    readonly flushInterval?: number;

    /**
     * Whether to always emit entries that have arguments.
     */
    readonly emitOnArgs?: boolean;

    /**
     * Provides the key that is used to uniquely identify a log entry.
     *
     * @default `${level}-${message}`
     * @param level
     * @param message
     * @param args
     * @returns A string key used to identify the entry in the buffer.
     */
    readonly keyProvider?: SetReturnType<LogSink['sink'], string>;
  },
): Logger => {
  if (logger === OFF_LOGGER) {
    return OFF_LOGGER;
  }

  const {
    flushSize = 100,
    flushInterval = 1000,
    emitOnArgs = false,
    keyProvider = DEFAULT_KEY_PROVIDER,
  } = options ?? emptyRecord<string, undefined>();
  const bufferSize = Math.max(1, flushSize);
  const interval = Math.max(0, flushInterval);
  let lastFlushTime = Date.now();

  const buffer = new Set<string>();
  const refreshBuffer = (timestamp = Date.now()) => {
    lastFlushTime = timestamp;
    buffer.clear();
  };

  return handlePrefixWrapping(logger, (original: Logger) =>
    createLogger(() => original.level, {
      sink: (level, message, args) => {
        if (emitOnArgs && args?.length) {
          original.log(level, message, ...args);
          return;
        }

        const now = Date.now();
        if ((interval && now - lastFlushTime >= interval) || buffer.size >= bufferSize) {
          refreshBuffer(now);
        }

        const key = keyProvider(level, message, args);
        if (buffer.has(key)) {
          return;
        }

        buffer.add(key);
        original.log(level, message, ...(args ?? emptyArray()));
      },

      flush: () => {
        refreshBuffer();
        return original.flush?.();
      },

      close: () => {
        refreshBuffer();
        return original.close?.();
      },
    }),
  );
};

const DEFAULT_KEY_PROVIDER: SetReturnType<LogSink['sink'], string> = (level, message, _args) => `${level}-${message}`;

/**
 * Returns a logger that forwards only entries for which the predicate returns true.
 *
 * The predicate is invoked with the same `level`, `message`, and `args` that would be emitted; entries are delegated to
 * the wrapped logger unchanged when the predicate returns `true`, and dropped when it returns `false`. The returned
 * logger preserves the wrapped logger’s level (and dynamic level changes) and works correctly with prefixed loggers.
 *
 * Use this when you need custom filtering beyond level-based rules (e.g. by message pattern, args, or a combination).
 *
 * @example Filter by level
 *
 * ```ts
 * import { createConsoleLogLogger, withFilter } from 'emitnlog/logger';
 *
 * const baseLogger = createConsoleLogLogger('trace');
 * const errorOnlyLogger = withFilter(baseLogger, (level) => level === 'error' || level === 'critical');
 *
 * errorOnlyLogger.i`info`; // Not emitted
 * errorOnlyLogger.e`error`; // Emitted
 * errorOnlyLogger.c`critical`; // Emitted
 * ```
 *
 * @example Filter by message pattern
 *
 * ```ts
 * import { createConsoleLogLogger, withFilter } from 'emitnlog/logger';
 *
 * const baseLogger = createConsoleLogLogger('info');
 * const logger = withFilter(baseLogger, (_level, message) => message.startsWith('AUTH:'));
 *
 * logger.info('AUTH: user logged in'); // Emitted
 * logger.info('Other message'); // Not emitted
 * ```
 *
 * @param logger The logger to decorate.
 * @param predicate Function called for each entry with `(level, message, args)`; return `true` to forward the entry,
 *   `false` to drop it.
 * @returns A logger that forwards only entries for which `predicate` returns true.
 */
export const withFilter = (
  logger: Logger,
  predicate: (level: LogLevel, message: string, args: readonly unknown[] | undefined) => boolean,
): Logger => {
  if (logger === OFF_LOGGER) {
    return OFF_LOGGER;
  }

  return handlePrefixWrapping(logger, (original: Logger) =>
    createLogger(
      () => original.level,
      (level, message, args) => {
        if (predicate(level, message, args)) {
          original.log(level, message, ...(args ?? emptyArray()));
        }
      },
    ),
  );
};
