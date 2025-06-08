import type { Logger } from '../definition.ts';
import type { EnvironmentLoggerOptions } from '../environment-common.ts';
import { createLoggerFromEnv, decodeEnv, toEnv } from '../environment-common.ts';
import { FileLogger } from './file-logger.ts';

/**
 * Returns the logger to use based on the environment variables.
 *
 * The environment variables are:
 *
 * ```
 * EMITNLOG_LOGGER: The logger to use.
 * The possible values are
 *   - `console`: The console logger.
 *   - `console-error`: The console error logger.
 *   - `file:<path>`: The file logger with the (required) file path information (Node.js only)
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
 *   - `json`
 *   - `unformatted-json`
 * ```
 *
 * If a environment variable is not set, the associated value in `options` is used.
 *
 * @param options The options to use.
 * @returns The logger to use.
 */
export const fromEnv = (options?: EnvironmentLoggerOptions): Logger => {
  const env = toEnv();
  const decodedEnv = decodeEnv(env, options);
  return decodedEnv?.envFile
    ? new FileLogger(decodedEnv.envFile, decodedEnv.envLevel, decodedEnv.envFormat)
    : createLoggerFromEnv(decodedEnv, options);
};
