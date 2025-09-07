import type { Logger } from './definition.ts';

/**
 * A logger implementation that does not emit any log entries regardless of level. Useful for completely disabling
 * logging in specific contexts.
 *
 * @example
 *
 * ```ts
 * import type { Logger } from 'emitnlog/logger';
 * import { OFF_LOGGER, withPrefix } from 'emitnlog/logger';
 *
 * const calculate = (logger?: Logger) => {
 *   const calculateLogger = withPrefix(logger ?? OFF_LOGGER, 'calculate');
 *   calculateLogger.i`starting calculation`;
 *   ...
 * };
 * ```
 */
export const OFF_LOGGER: Logger = Object.freeze({
  level: 'off',

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
});

/**
 * Returns a non-nullable logger: either the specified logger or the OFF_LOGGER.
 *
 * @example
 *
 * ```ts
 * import type { Logger } from 'emitnlog/logger';
 * import { asNonNullableLogger, withPrefix } from 'emitnlog/logger';
 *
 * const calculate = (logger?: Logger) => {
 *   const calculateLogger = withPrefix(withLogger(logger), 'calculate');
 *   calculateLogger.i`starting calculation`;
 *   ...
 * };
 * ```
 *
 * @param logger A logger or null or undefined
 * @returns Either the specified logger or the OFF_Logger
 */
export const withLogger = (logger: Logger | undefined | null): NonNullable<Logger> => logger ?? OFF_LOGGER;
