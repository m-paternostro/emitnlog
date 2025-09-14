import type { Logger } from '../definition.ts';
import type { EnvironmentLoggerOptions } from '../environment/shared.ts';
import { createLoggerFromEnv, decodeEnv, toEnv } from '../environment/shared.ts';
import { createFileLogger } from './factory.ts';

/**
 * Returns the logger to use based on the environment variables.
 *
 * The environment variables are:
 *
 * ```
 * EMITNLOG_LOGGER: The logger to use.
 * The possible values are
 *   - `console-log`: The console log logger.
 *   - `console-error`: The console error logger.
 *   - `console-level`: The console by level logger.
 *   - `file:<path>`: The file logger with the (required) file path information (Node.js only)
 *   - `file:date:<path>`: Same as 'file:<path>' however the local date is prefixed to the file name (Node.js only)
 *
 * EMITNLOG_LEVEL: The level to use.
 * The possible values are
 *   - `trace`
 *   - `debug`
 *   - `info`
 *   - `notice`
 *   - `warning`
 *   - `error`
 *   - `critical`
 *   - `alert`
 *   - `emergency`
 *
 * EMITNLOG_FORMAT: The format to use.
 * The possible values are
 *   - `plain`
 *   - `colorful`
 *   - `json-compact`
 *   - `json-pretty`
 * ```
 *
 * If a environment variable is not set, the associated value in `options` is used.
 *
 * @example
 *
 * ```typescript
 * import { fromEnv } from 'emitnlog/logger';
 *
 * // Basic usage - uses environment variables if set, otherwise returns OFF_LOGGER
 * const logger = fromEnv();
 * ```
 *
 * @example
 *
 * ```typescript
 * import { fromEnv } from 'emitnlog/logger';
 *
 * // With fallback options when environment variables are not set
 * const logger = fromEnv({
 *   // Used if EMITNLOG_LEVEL is not set
 *   level: 'debug',
 *
 *   // Used if EMITNLOG_FORMAT is not set
 *   format: 'plain',
 * });
 * ```
 *
 * @example
 *
 * ```typescript
 * import { fromEnv } from 'emitnlog/logger';
 *
 * // With a custom fallback logger
 * const logger = fromEnv({
 *   // Used if EMITNLOG_LOGGER is not set
 *   fallbackLogger: (level, format) => new CustomLogger(level, format),
 * });
 * ```
 *
 * @example
 *
 * ```typescript
 * import { fromEnv } from 'emitnlog/logger';
 *
 * // Using console logger with info level and colorful format
 * process.env.EMITNLOG_LOGGER = 'console-log';
 * process.env.EMITNLOG_LEVEL = 'info';
 * process.env.EMITNLOG_FORMAT = 'colorful';
 * const logger = fromEnv();
 * logger.i`Hello, world!`; // Will output with colors to console
 * ```
 *
 * @param options The options to use.
 * @returns The logger to use.
 */
export const fromEnv = (options?: EnvironmentLoggerOptions): Logger => {
  const env = toEnv();
  const decodedEnv = decodeEnv(env, options);
  return decodedEnv?.envFile
    ? createFileLogger(decodedEnv.envFile, {
        datePrefix: decodedEnv.envDatePrefix,
        level: decodedEnv.envLevel,
        format: decodedEnv.envFormat,
      })
    : createLoggerFromEnv(decodedEnv, options);
};
