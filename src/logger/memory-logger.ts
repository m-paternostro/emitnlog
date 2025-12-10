import { createLogger } from './emitter/emitter-logger.ts';
import type { MemoryStore } from './emitter/index.ts';
import { memorySink } from './emitter/memory-sink.ts';
import { asExtendedLogger } from './factory.ts';
import type { SyncFinalizer } from './implementation/finalizer.ts';
import type { Logger, LogLevel } from './index.ts';

/**
 * A logger that exposes the emitted log entries.
 *
 * @see {@link createMemoryLogger}
 */
export type MemoryLogger = SyncFinalizer<Logger> & MemoryStore;

/**
 * Creates a logger that accumulates the log entries.
 *
 * The entries are flushed on `flush()` and `close()`.
 *
 * @example
 *
 * ```ts
 * const logger = createMemoryLogger();
 * logger.log('info', 'Hello, world!');
 * expect(logger.entries).toEqual([{ level: 'info', message: 'Hello, world!' }]);
 * logger.flush();
 * ```
 *
 * @param level
 * @returns
 */
export const createMemoryLogger = (level: LogLevel | 'off' | (() => LogLevel | 'off') = 'info'): MemoryLogger => {
  const sink = memorySink();
  const logger = createLogger(level, sink);
  return asExtendedLogger(logger, { entries: sink.entries });
};
