import type { LogEntry, LogSink } from './common.ts';
import { asLogEntry } from './common.ts';

export type MemorySink = LogSink & { readonly entries: readonly LogEntry[]; readonly clear: () => void };

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
