import type { Logger, LogLevel } from './logger.ts';

/**
 * A logger implementation that does not emit any log entries regardless of level. Useful for completely disabling
 * logging in specific contexts.
 */
export const OFF_LOGGER: Logger = {
  get level() {
    return 'off';
  },

  set level(_: LogLevel | 'off') {
    // ignored
  },

  args: () => OFF_LOGGER,

  trace: () => void {},
  t: () => void {},

  debug: () => void {},
  d: () => void {},

  info: () => void {},
  i: () => void {},

  notice: () => void {},
  n: () => void {},

  warning: () => void {},
  w: () => void {},

  error: () => void {},
  e: () => void {},

  critical: () => void {},
  c: () => void {},

  alert: () => void {},
  a: () => void {},

  emergency: () => void {},
  em: () => void {},

  log: () => void {},
} as const;
