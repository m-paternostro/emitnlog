import { exhaustiveCheck } from '../utils/common/exhaustive-check.ts';
import { stringify } from '../utils/converter/stringify.ts';
import type { LogLevel } from './definition.ts';

export const emitLine = (level: LogLevel, message: string): string => {
  const timestamp = stringify(new Date());

  const paddedLevel = level.padEnd(9, ' ');
  const levelText = `[${paddedLevel}]`;
  const line = `${timestamp} ${levelText} ${message}`;

  return line;
};

export const emitColorfulLine = (level: LogLevel, message: string): string => {
  const timestamp = terminalFormatter.dim(stringify(new Date()));

  const paddedLevel = level.padEnd(9, ' ');
  const levelText = decorateText(level, `[${paddedLevel}]`);
  const line = `${timestamp} ${levelText} ${message}`;

  return line;
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
