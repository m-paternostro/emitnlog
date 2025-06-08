import { ConsoleErrorLogger } from './console-error-logger.ts';
import { ConsoleLogger } from './console-logger.ts';
import type { Logger, LogLevel } from './definition.ts';
import type { EmitterFormat } from './emitter.ts';
import { isEmitterFormat } from './emitter.ts';
import { isLogLevel } from './level-utils.ts';
import { OFF_LOGGER } from './off-logger.ts';

const ENV_LOGGER = 'EMITNLOG_LOGGER';
const ENV_LEVEL = 'EMITNLOG_LEVEL';
const ENV_FORMAT = 'EMITNLOG_FORMAT';

/**
 * The options for the `fromEnv` function.
 */
export type EnvironmentLoggerOptions = {
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

type EnvLogger = 'console' | 'console-error' | `file:${string}`;

const isEnvLogger = (value: unknown): value is EnvLogger =>
  value === 'console' || value === 'console-error' || (typeof value === 'string' && value.startsWith('file:'));

const isEnvHolder = (value: unknown): value is { readonly env: Record<string, string | undefined> } =>
  !!value && typeof value === 'object' && 'env' in value && !!value.env && typeof value.env === 'object';

export const toEnv = (): Record<string, string | undefined> | undefined => {
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

type DecodedEnv = {
  readonly envLogger?: EnvLogger;
  readonly envLevel?: LogLevel;
  readonly envFormat?: EmitterFormat;
  readonly envFile?: string;
};

export const decodeEnv = (
  env: Record<string, string | undefined> | undefined,
  options?: EnvironmentLoggerOptions,
): DecodedEnv | undefined => {
  let envLogger: EnvLogger | undefined;
  let envLevel: LogLevel | undefined = options?.level;
  let envFormat: EmitterFormat | undefined = options?.format;
  let envFile: string | undefined;

  if (env) {
    const envLoggerValue = env[ENV_LOGGER];
    if (isEnvLogger(envLoggerValue)) {
      if (envLoggerValue.startsWith('file:')) {
        const file = envLoggerValue.slice(5);
        if (file) {
          envLogger = envLoggerValue;
          envFile = file;
        } else {
          // eslint-disable-next-line no-undef, no-console
          console.warn(
            `The value of the environment variable '${ENV_LOGGER}' must provide a file path: '${envLoggerValue}'.\nConsult the emitnlog documentation for the list of valid loggers.`,
          );
        }
      } else {
        envLogger = envLoggerValue;
      }
    } else if (envLoggerValue) {
      // eslint-disable-next-line no-undef, no-console
      console.warn(
        `The value of the environment variable '${ENV_LOGGER}' is not a valid logger: '${envLoggerValue}'.\nConsult the emitnlog documentation for the list of valid loggers.`,
      );
    }

    const envLevelValue = env[ENV_LEVEL];
    if (isLogLevel(envLevelValue)) {
      envLevel = envLevelValue;
    } else if (envLevelValue) {
      // eslint-disable-next-line no-undef, no-console
      console.warn(
        `The value of the environment variable '${ENV_LEVEL}' is not a valid level: '${envLevelValue}'.\nConsult the emitnlog documentation for the list of valid levels.`,
      );
    }

    const envFormatValue = env[ENV_FORMAT];
    if (envFormatValue) {
      if (isEmitterFormat(envFormatValue)) {
        envFormat = envFormatValue;
      } else if (envFormatValue) {
        // eslint-disable-next-line no-undef, no-console
        console.warn(
          `The value of the environment variable '${ENV_FORMAT}' is not a valid format: '${envFormatValue}'.\nConsult the emitnlog documentation for the list of valid formats.`,
        );
      }
    }
  }

  return envLogger || envLevel || envFormat ? { envLogger, envLevel, envFormat, envFile } : undefined;
};

export const createLoggerFromEnv = (
  decodedEnv: DecodedEnv | undefined,
  options: EnvironmentLoggerOptions | undefined,
): Logger => {
  if (decodedEnv) {
    if (decodedEnv.envLogger === 'console') {
      return new ConsoleLogger(decodedEnv.envLevel, decodedEnv.envFormat);
    }

    if (decodedEnv.envLogger === 'console-error') {
      return new ConsoleErrorLogger(decodedEnv.envLevel, decodedEnv.envFormat);
    }

    // eslint-disable-next-line no-undef, no-console
    console.warn(`The file logger is only supported in Node.js.`);
  }

  return options?.fallbackLogger?.(decodedEnv?.envLevel, decodedEnv?.envFormat) ?? OFF_LOGGER;
};
