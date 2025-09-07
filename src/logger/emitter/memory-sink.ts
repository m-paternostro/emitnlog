import type { SyncFinalizer } from '../implementation/finalizer.ts';
import type { LogEntry, LogSink } from './common.ts';
import { asLogEntry } from './common.ts';

/**
 * Interface for accessing stored log entries and clearing the memory store.
 */
export type MemoryStore = {
  /**
   * The log entries stored in memory
   */
  readonly entries: readonly LogEntry[];

  /**
   * Clear the log entries stored in memory
   */
  readonly clear: () => void;
};

/**
 * A log sink that stores entries in memory with synchronous flush/close operations.
 */
export type MemorySink = SyncFinalizer<LogSink> & MemoryStore;

/**
 * Creates a memory-based log sink that stores entries in an array.
 *
 * This sink is primarily useful for testing, debugging, or applications that need to inspect logged entries
 * programmatically. All entries are kept in memory until explicitly cleared.
 *
 * @example Basic usage
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const memory = emitter.memorySink();
 * const logger = emitter.createLogger('info', memory);
 *
 * logger.i`Application started`;
 * logger.e`Something failed`;
 *
 * console.log(memory.entries); // Array with 2 log entries
 * memory.clear(); // Remove all entries
 * ```
 *
 * @example With pre-existing entries array
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const existingEntries: emitter.LogEntry[] = [];
 * const memory = emitter.memorySink(existingEntries);
 * // Now both memory.entries and existingEntries reference the same array
 * ```
 *
 * @param entries Optional array to use for storing entries (default: new empty array)
 * @returns A MemorySink that stores log entries in memory
 */
export const memorySink = (entries: LogEntry[] = []): MemorySink => {
  const clear = () => {
    entries.length = 0;
  };

  return {
    sink: (level, message, args) => {
      entries.push(asLogEntry(level, message, args));
    },
    entries,
    clear,
    flush: clear,
    close: clear,
  };
};
