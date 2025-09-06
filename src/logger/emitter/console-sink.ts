import { shouldEmitEntry } from '../implementation/level-utils.ts';
import type { LogSink } from './common.ts';
import { asLogSink } from './common.ts';
import type { LogFormatter } from './formatter.ts';
import { plainFormatter } from './formatter.ts';

/**
 * Creates a log sink that writes all entries to console.log.
 *
 * This sink sends all log messages to standard output, regardless of their severity level. It's useful when you want
 * all logs to go to stdout for shell redirection or processing.
 *
 * @example Basic usage
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const sink = emitter.consoleLogSink();
 * const logger = emitter.createLogger('info', sink);
 *
 * logger.i`This goes to console.log`;
 * logger.e`This also goes to console.log`;
 * ```
 *
 * @param formatter The formatter to use for log entries (default: plainFormatter)
 * @returns A LogSink that writes to console.log
 */
export const consoleLogSink = (formatter: LogFormatter = plainFormatter): LogSink =>
  asLogSink((level, message, args) => {
    const line = formatter(level, message, args);
    // eslint-disable-next-line no-undef, no-console
    console.log(line, ...args);
  });

/**
 * Creates a log sink that writes all entries to console.error.
 *
 * This sink sends all log messages to standard error, regardless of their severity level. It's useful for CLI tools or
 * applications where you want all logging to go to stderr while keeping stdout clean for actual program output.
 *
 * @example Basic usage
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const sink = emitter.consoleErrorSink();
 * const logger = emitter.createLogger('info', sink);
 *
 * logger.i`This goes to console.error`;
 * logger.e`This also goes to console.error`;
 * ```
 *
 * @param formatter The formatter to use for log entries (default: plainFormatter)
 * @returns A LogSink that writes to console.error
 */
export const consoleErrorSink = (formatter: LogFormatter = plainFormatter): LogSink =>
  asLogSink((level, message, args) => {
    const line = formatter(level, message, args);
    // eslint-disable-next-line no-undef, no-console
    console.error(line, ...args);
  });

/**
 * Creates a log sink that routes entries to different console methods based on severity.
 *
 * This sink provides intelligent routing to give the most appropriate console output:
 *
 * - Trace, debug → console.debug
 * - Info, notice → console.log
 * - Warning → console.warn
 * - Error, critical, alert, emergency → console.error
 *
 * This is the most sensible default for most applications as it allows terminal emulators and development tools to
 * apply appropriate styling and filtering.
 *
 * @example Basic usage
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const sink = emitter.consoleByLevelSink();
 * const logger = emitter.createLogger('info', sink);
 *
 * logger.i`Goes to console.log`;
 * logger.w`Goes to console.warn`;
 * logger.e`Goes to console.error`;
 * ```
 *
 * @param formatter The formatter to use for log entries (default: plainFormatter)
 * @returns A LogSink that routes to appropriate console methods
 */
export const consoleByLevelSink = (formatter: LogFormatter = plainFormatter): LogSink =>
  asLogSink((level, message, args) => {
    const line = formatter(level, message, args);

    if (shouldEmitEntry('error', level)) {
      // eslint-disable-next-line no-undef, no-console
      console.error(line, ...args);
    } else if (shouldEmitEntry('warning', level)) {
      // eslint-disable-next-line no-undef, no-console
      console.warn(line, ...args);
    } else if (shouldEmitEntry('info', level)) {
      // eslint-disable-next-line no-undef, no-console
      console.log(line, ...args);
    } else {
      // eslint-disable-next-line no-undef, no-console
      console.debug(line, ...args);
    }
  });
