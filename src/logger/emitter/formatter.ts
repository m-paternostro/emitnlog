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
