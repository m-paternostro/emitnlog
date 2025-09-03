import { terminalFormatter } from '../../utils/common/terminal-formatter.ts';
import { stringify } from '../../utils/converter/stringify.ts';
import type { LogLevel } from '../definition.ts';
import { decorateLogText } from '../implementation/level-utils.ts';
import { asLogEntry } from './common.ts';

export type LogFormatter = (level: LogLevel, message: string, args: readonly unknown[]) => string;

export const plainFormatter: LogFormatter = (level, message) => {
  const timestamp = stringify(new Date());

  const paddedLevel = level.padEnd(9, ' ');
  const levelText = `[${paddedLevel}]`;
  const line = `${timestamp} ${levelText} ${message}`;

  return line;
};

export const colorfulFormatter: LogFormatter = (level, message) => {
  const timestamp = terminalFormatter.dim(stringify(new Date()));

  const paddedLevel = level.padEnd(9, ' ');
  const levelText = decorateLogText(level, `[${paddedLevel}]`);
  const line = `${timestamp} ${levelText} ${message}`;

  return line;
};

export const jsonCompactFormatter: LogFormatter = (level, message, args) => stringify(asLogEntry(level, message, args));

export const jsonPrettyFormatter: LogFormatter = (level, message, args) =>
  stringify(asLogEntry(level, message, args), { pretty: true });

export const plainArgAppendingFormatter =
  (baseFormatter: LogFormatter, delimiter = '\n'): LogFormatter =>
  (level, message, args) => {
    const formatted = baseFormatter(level, message, args);
    if (!args.length) {
      return formatted;
    }

    const formattedArgs = args
      .map((arg, i) => {
        const formattedArg = stringify(arg, { includeStack: true, pretty: true, maxDepth: 3 });
        return `[${i}] ${formattedArg}`;
      })
      .join('\n');

    return formatted ? `${formatted}${delimiter}${formattedArgs}` : formattedArgs;
  };
