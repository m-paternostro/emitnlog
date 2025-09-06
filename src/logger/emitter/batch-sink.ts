import { debounce } from '../../utils/async/debounce.ts';
import type { AsyncFinalizer } from '../implementation/finalizer.ts';
import type { LogEntry, LogSink } from './common.ts';
import { asLogEntry, asLogSink } from './common.ts';

/**
 * Options for configuring the batch sink wrapper.
 */
export type BatchSinkOptions = {
  /**
   * Maximum number of log entries to buffer before flushing.
   *
   * @default 100
   */
  readonly maxBufferSize?: number;

  /**
   * Maximum time in milliseconds to wait before flushing the buffer.
   *
   * @default 1000 (1s)
   */
  readonly flushDelayMs?: number;

  /**
   * By default the batch sink flushes the buffer if the `process` object is available. Use true to change this
   * behavior.
   *
   * @default false
   */
  readonly skipFlushOnExit?: boolean;
};

/**
 * Creates a batching wrapper around any log sink.
 *
 * The batch sink accumulates log entries in memory and forwards them to the wrapped sink in batches, improving
 * performance for high-volume logging scenarios.
 *
 * @example Basic usage with file sink
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 * import { fileSink } from 'emitnlog/logger/node';
 *
 * const batchedFile = emitter.batchSink(fileSink('/logs/app.log'), { maxBufferSize: 100, flushDelayMs: 1000 });
 * const logger = emitter.createLogger('info', batchedFile);
 * ```
 *
 * @example Memory sink with batching
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const memory = emitter.memorySink();
 * const batched = emitter.batchSink(memory, { maxBufferSize: 50, flushDelayMs: 2000 });
 * ```
 *
 * ```
 * @param logSink The log sink to wrap with batching
 * @param options Configuration options for batching behavior
 * @returns A log sink that batches log entries
 * ```
 */
export const batchSink = (logSink: LogSink, options?: BatchSinkOptions): AsyncFinalizer<LogSink> => {
  const maxBufferSize = options?.maxBufferSize ?? 100;
  const flushDelayMs = options?.flushDelayMs ?? 1000;
  const skipFlushOnExit = options?.skipFlushOnExit ?? true;

  if (flushDelayMs === 0) {
    return asLogSink((level, message, args) => logSink.sink(level, message, args), {
      flush: async () => logSink.flush?.(),
      close: async () => logSink.close?.(),
    });
  }

  let buffer: LogEntry[] = [];
  let isClosing = false;

  const useTimeBasedFlushing = flushDelayMs < Number.MAX_SAFE_INTEGER;
  if (!useTimeBasedFlushing) {
    return asLogSink(
      (level, message, args) => {
        if (buffer.length >= maxBufferSize - 1) {
          logSink.sink(level, message, args);
          for (const entry of buffer) {
            logSink.sink(entry.level, entry.message, entry.args);
          }
          buffer = [];
        } else {
          buffer.push(asLogEntry(level, message, args));
        }
      },
      {
        flush: async () => {
          for (const entry of buffer) {
            logSink.sink(entry.level, entry.message, entry.args);
          }
          buffer = [];
          await logSink.flush?.();
        },
        close: async () => {
          for (const entry of buffer) {
            logSink.sink(entry.level, entry.message, entry.args);
          }
          buffer = [];
          await logSink.close?.();
        },
      },
    );
  }

  const flushBuffer = (force = false): void => {
    if (!buffer.length) {
      return;
    }

    if (isClosing && !force) {
      return;
    }

    const entries = buffer;
    buffer = [];

    for (const entry of entries) {
      logSink.sink(entry.level, entry.message, entry.args);
    }
  };

  // Use debounce for time-based flushing with accumulator
  const debouncedFlush = debounce(() => flushBuffer(), { delay: flushDelayMs });

  let exitHandler: (() => void) | undefined;

  /* eslint-disable no-undef */
  if (!skipFlushOnExit && typeof process !== 'undefined' && typeof process.on === 'function') {
    exitHandler = (): void => {
      isClosing = true;
      flushBuffer(true);
    };

    process.on('exit', exitHandler);
    process.on('SIGINT', exitHandler);
    process.on('SIGTERM', exitHandler);
  }
  /* eslint-enable no-undef */

  const batchedSink = {
    sink: (level, message, args): void => {
      if (isClosing) {
        logSink.sink(level, message, args);
        return;
      }

      buffer.push(asLogEntry(level, message, args));

      // Flush immediately if buffer is full
      if (buffer.length >= maxBufferSize) {
        flushBuffer();
      } else {
        // Schedule a flush after the delay using debounce
        void debouncedFlush();
      }
    },

    async flush(): Promise<void> {
      debouncedFlush.cancel(true);
      flushBuffer();

      await logSink.flush?.();
    },

    async close(): Promise<void> {
      isClosing = true;
      debouncedFlush.cancel(true);
      flushBuffer(true);

      /* eslint-disable no-undef */
      if (exitHandler && typeof process !== 'undefined' && typeof process.removeListener === 'function') {
        process.removeListener('exit', exitHandler);
        process.removeListener('SIGINT', exitHandler);
        process.removeListener('SIGTERM', exitHandler);
      }
      /* eslint-enable no-undef */

      await logSink.close?.();
    },
  } as const satisfies LogSink;

  return batchedSink;
};

/**
 * Creates a batch sink with size-based flushing only (no time delay).
 *
 * @example
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const batched = emitter.batchSizeSink(
 *   emitter.memorySink(),
 *   100, // Flush every 100 entries
 * );
 * ```
 */
export const batchSizeSink = (logSink: LogSink, maxBufferSize: number): AsyncFinalizer<LogSink> =>
  batchSink(logSink, {
    maxBufferSize,
    flushDelayMs: Number.MAX_SAFE_INTEGER, // Effectively disable time-based flushing
  });

/**
 * Creates a batch sink with time-based flushing only (no size limit).
 *
 * @example
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const batched = emitter.batchTimeSink(
 *   emitter.memorySink(),
 *   5000, // Flush every 5 seconds
 * );
 * ```
 */
export const batchTimeSink = (logSink: LogSink, flushDelayMs: number): AsyncFinalizer<LogSink> =>
  batchSink(logSink, {
    maxBufferSize: Number.MAX_SAFE_INTEGER, // Effectively disable size-based flushing
    flushDelayMs,
  });
