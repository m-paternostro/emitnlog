import { exhaustiveCheck } from '../utils/common/exhaustive-check.ts';
import { stringify } from '../utils/converter/stringify.ts';
import type { LogLevel } from './definition.ts';

/**
 * The format of the emitted lines. The possible values are:
 *
 * - 'plain': The line is emitted as a plain string.
 * - 'colorful': The line is emitted with ANSI color codes.
 * - 'json': The line is emitted as a JSON string.
 * - 'unformatted-json': The line is emitted as a JSON string without formatting.
 */
export type EmitterFormat = 'plain' | 'colorful' | 'json' | 'unformatted-json';

/**
 * Checks if a string is a valid EmitterFormat.
 *
 * @param value The string to check
 * @returns True if the string is a valid EmitterFormat, false otherwise
 */
export const isEmitterFormat = (value: unknown): value is EmitterFormat => {
  const format = value as EmitterFormat;
  switch (format) {
    case 'plain':
    case 'colorful':
    case 'json':
    case 'unformatted-json':
      return true;

    default:
      exhaustiveCheck(format);
      return false;
  }
};

/**
 * Whether the specified format supports additional arguments.
 *
 * @param format - The format to check
 * @returns True if the format supports additional arguments, false otherwise
 */
export const formatSupportsArgs = (format: EmitterFormat): boolean =>
  format === 'json' || format === 'unformatted-json';

/**
 * Emits a line with the timestamp, level, message, and, when using a JSON format and if a not-empty array, args.
 *
 * @param level - The log level to use
 * @param message - The message to emit
 * @param args - The arguments to emit
 * @param format - The format to use (default: 'plain')
 * @returns The formatted line
 */
export const emitLine = (
  level: LogLevel,
  message: string,
  args?: readonly unknown[],
  format: EmitterFormat = 'plain',
): string => {
  switch (format) {
    case 'plain':
      return emitPlainLine(level, message);

    case 'colorful':
      return emitColorfulLine(level, message);

    case 'json':
      return emitJsonString(level, message, args);

    case 'unformatted-json':
      return emitJsonString(level, message, args, true);

    default:
      exhaustiveCheck(format);
      return emitPlainLine(level, message);
  }
};

/**
 * Emits a plain line with the timestamp, level, and message.
 *
 * @param level - The log level to use
 * @param message - The message to emit
 * @returns The formatted line
 */
export const emitPlainLine = (level: LogLevel, message: string): string => {
  const timestamp = stringify(new Date());

  const paddedLevel = level.padEnd(9, ' ');
  const levelText = `[${paddedLevel}]`;
  const line = `${timestamp} ${levelText} ${message}`;

  return line;
};

/**
 * Emits a colorful line with the timestamp, level, and message.
 *
 * @param level - The log level to use
 * @param message - The message to emit
 * @returns The formatted line
 */
export const emitColorfulLine = (level: LogLevel, message: string): string => {
  const timestamp = terminalFormatter.dim(stringify(new Date()));

  const paddedLevel = level.padEnd(9, ' ');
  const levelText = decorateText(level, `[${paddedLevel}]`);
  const line = `${timestamp} ${levelText} ${message}`;

  return line;
};

/**
 * Emits a JSON line with the timestamp, level, and message, and the 'args' if the specified array is not empty.
 *
 * The expected JSON schema is `{ level: LogLevel, message: string, args?: unknown[] }`. If an error occurs while
 * serializing the `args`, then the 'args' property is replaced by 'argsError' whose value is the serialization error
 * description.
 *
 * @param level - The log level to use
 * @param message - The message to emit
 * @param args - The arguments to emit
 * @param skipFormatting - Whether to skip JSON formatting (default: false)
 * @returns A JSON string with the log line values.
 */
export const emitJsonString = (
  level: LogLevel,
  message: string,
  args?: readonly unknown[],
  skipFormatting = false,
): string => {
  const line: Record<string, unknown> = { timestamp: stringify(new Date()), level, message };

  if (args?.length) {
    try {
      line.args = args;
      return JSON.stringify(line, undefined, skipFormatting ? undefined : 2);
    } catch (error) {
      // Remove args and add error info instead
      delete line.args;
      line.argsError = stringify(error);
    }
  }

  return JSON.stringify(line, undefined, skipFormatting ? undefined : 2);
};

const INDENTATION = '    ';

/**
 * Object containing methods for terminal text formatting. Used by ColoredLogger to add visual formatting to different
 * log elements.
 */
const terminalFormatter = {
  // the indentation is always done with spaces.
  indent: (text: string, counter = 1): string => `${INDENTATION.repeat(counter)}${text}`,

  // debug - subtle, low visibility
  dim: (text: string): string => text && `\x1b[2m${text}\x1b[0m`,

  // info - calm, informational blue
  cyan: (text: string): string => text && `\x1b[36m${text}\x1b[0m`,

  // notice - positive, noticeable but not alarming
  green: (text: string): string => text && `\x1b[32m${text}\x1b[0m`,

  // warning - cautionary
  yellow: (text: string): string => text && `\x1b[33m${text}\x1b[0m`,

  // error - problem indicator
  red: (text: string): string => text && `\x1b[31m${text}\x1b[0m`,

  // critical - serious issue
  magenta: (text: string): string => text && `\x1b[35m${text}\x1b[0m`,

  // alert - very serious issue
  boldRed: (text: string): string => text && `\x1b[1;31m${text}\x1b[0m`,

  // emergency - highest severity, extreme problem
  redBackground: (text: string): string => text && `\x1b[41;37m${text}\x1b[0m`,
} as const;

/**
 * Applies color formatting to text based on the specified log level.
 *
 * @param level - The log level to determine appropriate color formatting
 * @param text - The text to be color-formatted
 * @returns The text with appropriate ANSI color formatting for terminal display
 */
const decorateText = (level: LogLevel, text: string): string => {
  switch (level) {
    case 'trace':
      return terminalFormatter.dim(text);

    case 'debug':
      return terminalFormatter.dim(text);

    case 'info':
      return terminalFormatter.cyan(text);

    case 'notice':
      return terminalFormatter.green(text);

    case 'warning':
      return terminalFormatter.yellow(text);

    case 'error':
      return terminalFormatter.red(text);

    case 'critical':
      return terminalFormatter.magenta(text);

    case 'alert':
      return terminalFormatter.boldRed(text);

    case 'emergency':
      return terminalFormatter.redBackground(text);

    default:
      exhaustiveCheck(level);
      return text;
  }
};
