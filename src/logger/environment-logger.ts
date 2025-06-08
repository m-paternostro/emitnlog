import { exhaustiveCheck } from '../utils/common/exhaustive-check.ts';
import { ConsoleErrorLogger } from './console-error-logger.ts';
import { ConsoleLogger } from './console-logger.ts';
import type { Logger, LogLevel } from './definition.ts';
import type { EmitterFormat } from './emitter.ts';
import { isEmitterFormat } from './emitter.ts';
import { isLogLevel } from './level-utils.ts';
import { FileLogger } from './node/index.ts';
import { OFF_LOGGER } from './off-logger.ts';

const ENV_LOGGER = 'EMITNLOG_LOGGER';
const ENV_LEVEL = 'EMITNLOG_LEVEL';
const ENV_FORMAT = 'EMITNLOG_FORMAT';

/**
 * The options for the `fromEnv` function.
 */
type EnvironmentLoggerOptions = {
  /**
   * The level to use if the environment variable `EMITNLOG_LEVEL` is not set.
   */
  readonly level?: LogLevel;

  /**
   * The format to use if the environment variable `EMITNLOG_FORMAT` is not set.
   */
  readonly format?: EmitterFormat;

  /**
   * Returns the fallback logger to use if the environment variable `ENV_LOGGER` is not set.
   *
   * @param level The level to use set, which is `EMITNLOG_LEVEL`, `options.level`, or undefined.
   * @param format The format to use, which is `EMITNLOG_FORMAT`, `options.format`, or undefined.
   * @returns The fallback logger to use or undefined.
   */
  readonly fallbackLogger?: (level?: LogLevel, format?: EmitterFormat) => Logger | undefined;
};

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
 *   - `file:<path>`: The file logger with the (required) file path information
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
export const fromEnv = (options?: EnvironmentLoggerOptions): Logger => doFromEnv(toEnv(), options);

type EnvLogger = 'console' | 'console-error' | `file:${string}`;

const toEnv = (): Record<string, string | undefined> | undefined => {
  // eslint-disable-next-line no-undef
  if (typeof process !== 'undefined' && isEnvHolder(process)) {
    // eslint-disable-next-line no-undef
    return process.env;
  }

  // This is not working with jest: time for vitest?
  // const meta = import.meta as unknown as { readonly env: Record<string, string | undefined> };
  // if (typeof meta !== 'undefined' && isEnvHolder(meta)) {
  //   return meta.env;
  // }

  return undefined;
};

const isEnvHolder = (value: unknown): value is { readonly env: Record<string, string | undefined> } =>
  !!value && typeof value === 'object' && 'env' in value && !!value.env && typeof value.env === 'object';

const isFileEnvLogger = (value: unknown): value is `file:${string}` =>
  typeof value === 'string' && value.startsWith('file:');

const doFromEnv = (env: Record<string, string | undefined> | undefined, options?: EnvironmentLoggerOptions): Logger => {
  let level = options?.level;
  let format = options?.format;

  if (env) {
    const envLevel = env[ENV_LEVEL];
    if (envLevel) {
      if (isLogLevel(envLevel)) {
        level = envLevel;
      } else {
        // eslint-disable-next-line no-undef, no-console
        console.warn(
          `The value of the environment variable '${ENV_LEVEL}' is not a valid level: '${envLevel}'.\nConsult the emitnlog documentation for the list of valid levels.`,
        );
      }
    }

    const envFormat = env[ENV_FORMAT];
    if (envFormat) {
      if (isEmitterFormat(envFormat)) {
        format = envFormat;
      } else {
        // eslint-disable-next-line no-undef, no-console
        console.warn(
          `The value of the environment variable '${ENV_FORMAT}' is not a valid format: '${envFormat}'.\nConsult the emitnlog documentation for the list of valid formats.`,
        );
      }
    }

    const envLogger = env[ENV_LOGGER] as EnvLogger | undefined;
    if (envLogger) {
      if (envLogger === 'console') {
        return new ConsoleLogger(level, format);
      }

      if (envLogger === 'console-error') {
        return new ConsoleErrorLogger(level, format);
      }

      if (isFileEnvLogger(envLogger)) {
        const filePath = envLogger.slice(5);
        return new FileLogger(filePath, level, format);
      }

      // eslint-disable-next-line no-undef, no-console
      console.warn(
        `The value of the environment variable '${ENV_LOGGER}' is not a valid logger: '${envLogger}'.\nConsult the emitnlog documentation for the list of valid loggers.`,
      );
      exhaustiveCheck(envLogger);
    }
  }

  return options?.fallbackLogger?.(level, format) ?? OFF_LOGGER;
};

/**
 * Allows the tests to use internal utility methods.
 *
 * @example
 *
 * ```ts
 * import environmentLogger from '../src/logger/environment-logger.ts';
 * const { fromEnv } = environmentLogger[Symbol.for('@emitnlog.test')];
 * ```
 *
 * @internal Used for tests
 */
export default { [Symbol.for('@emitnlog.test')]: { fromEnv } as const } as const;
