import { shouldEmitEntry } from '../implementation/level-utils.ts';
import type { LogSink } from './common.ts';
import { asLogSink } from './common.ts';
import type { LogFormatter } from './formatter.ts';
import { plainFormatter } from './formatter.ts';

export const consoleLogSink = (stringifier: LogFormatter = plainFormatter): LogSink =>
  asLogSink((level, message, args) => {
    const line = stringifier(level, message, args);
    // eslint-disable-next-line no-undef, no-console
    console.log(line, ...args);
  });

export const consoleErrorSink = (stringifier: LogFormatter = plainFormatter): LogSink =>
  asLogSink((level, message, args) => {
    const line = stringifier(level, message, args);
    // eslint-disable-next-line no-undef, no-console
    console.error(line, ...args);
  });

export const consoleByLevelSink = (stringifier: LogFormatter = plainFormatter): LogSink =>
  asLogSink((level, message, args) => {
    const line = stringifier(level, message, args);

    if (shouldEmitEntry('error', level)) {
      // eslint-disable-next-line no-undef, no-console
      console.error(line, ...args);
    } else if (shouldEmitEntry('warning', level)) {
      // eslint-disable-next-line no-undef, no-console
      console.warn(line, ...args);
    } else if (shouldEmitEntry('info', level)) {
      // eslint-disable-next-line no-undef, no-console
      console.log(line, ...args);
    } else if (shouldEmitEntry('debug', level)) {
      // eslint-disable-next-line no-undef, no-console
      console.debug(line, ...args);
    }
  });
