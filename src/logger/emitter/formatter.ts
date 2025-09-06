import { terminalFormatter } from '../../utils/common/terminal-formatter.ts';
import { stringify } from '../../utils/converter/stringify.ts';
import type { LogLevel } from '../definition.ts';
import { decorateLogText } from '../implementation/level-utils.ts';
import { asLogEntry } from './common.ts';

/**
 * Function type for formatting log entries into strings.
 *
 * Log formatters convert the structured log data (level, message, arguments) into a final string representation that
 * will be written to the output destination.
 */
export type LogFormatter = (level: LogLevel, message: string, args: readonly unknown[]) => string;

/**
 * Basic formatter that outputs logs as "level - message".
 *
 * This is the simplest formatter available, suitable for development or situations where minimal formatting is desired.
 *
 * @example Output format
 *
 * ```
 * info - Application started
 * error - Connection failed
 * ```
 */
export const basicFormatter: LogFormatter = (level, message) => `${level} - ${message}`;

/**
 * Plain text formatter with timestamp and padded level labels.
 *
 * Produces clean, readable output with consistent column alignment. The level is padded to 9 characters for consistent
 * formatting across all levels.
 *
 * @example Output format
 *
 * ```
 * "2024-01-15T10:30:45.123Z" [info     ] Application started
 * "2024-01-15T10:30:46.456Z" [error    ] Connection failed
 * ```
 */
export const plainFormatter: LogFormatter = (level, message) => {
  const timestamp = stringify(new Date());

  const paddedLevel = level.padEnd(9, ' ');
  const levelText = `[${paddedLevel}]`;
  const line = `${timestamp} ${levelText} ${message}`;

  return line;
};

/**
 * Colorful formatter with ANSI color codes and timestamps.
 *
 * Similar to plainFormatter but with color coding for different log levels and dimmed timestamps for better visual
 * hierarchy. Best for terminal output.
 *
 * @example Output format
 *
 * ```
 * \u001b[2m"2024-01-15T10:30:45.123Z"\u001b[22m \u001b[34m[info     ]\u001b[39m Application started
 * \u001b[2m"2024-01-15T10:30:46.456Z"\u001b[22m \u001b[31m[error    ]\u001b[39m Connection failed
 * ```
 */
export const colorfulFormatter: LogFormatter = (level, message) => {
  const timestamp = terminalFormatter.dim(stringify(new Date()));

  const paddedLevel = level.padEnd(9, ' ');
  const levelText = decorateLogText(level, `[${paddedLevel}]`);
  const line = `${timestamp} ${levelText} ${message}`;

  return line;
};

/**
 * JSON formatter that outputs compact, single-line JSON objects.
 *
 * Produces structured JSON output suitable for log aggregation systems, automated parsing, or storage in JSON-based
 * logging systems.
 *
 * @example Output format
 *
 * ```json
 * {"level":"info","timestamp":1705312245123,"message":"Application started","args":[]}
 * {"level":"error","timestamp":1705312246456,"message":"Connection failed","args":[{"host":"db.example.com"}]}
 * ```
 */
export const jsonCompactFormatter: LogFormatter = (level, message, args) => stringify(asLogEntry(level, message, args));

/**
 * JSON formatter that outputs pretty-printed, multi-line JSON objects.
 *
 * Produces readable JSON output with proper indentation. Useful for debugging or when human readability is more
 * important than compact size.
 *
 * @example Output format
 *
 * ```json
 * { "level": "info", "timestamp": 1705312245123, "message": "Application started", "args": [] }
 * ```
 */
export const jsonPrettyFormatter: LogFormatter = (level, message, args) =>
  stringify(asLogEntry(level, message, args), { pretty: true });

/**
 * Creates a formatter that appends formatted arguments to the base formatter output.
 *
 * This higher-order formatter wraps another formatter and adds detailed formatting of the arguments array. Each
 * argument is formatted on a separate line with an index. Useful for debugging when you need to see the full content of
 * logged objects.
 *
 * @example Usage
 *
 * ```ts
 * import { emitter } from 'emitnlog/logger';
 *
 * const formatter = emitter.plainArgAppendingFormatter(emitter.plainFormatter);
 * // Now arguments will be formatted and appended to each log entry
 * ```
 *
 * @example Output with arguments
 *
 * ```
 * "2024-01-15T10:30:45.123Z" [info     ] User logged in
 * [arg00] { userId: "123", email: "user@example.com" }
 * [arg01] { timestamp: "2024-01-15T10:30:45.123Z" }
 * ```
 *
 * @param baseFormatter The base formatter to wrap
 * @param delimiter The string used to separate the base output from arguments (default: '\n')
 * @returns A new formatter that includes formatted arguments
 */
export const plainArgAppendingFormatter =
  (baseFormatter: LogFormatter, delimiter = '\n'): LogFormatter =>
  (level, message, args) => {
    const formatted = baseFormatter(level, message, args);
    if (!args.length) {
      return formatted;
    }

    const indexPadding = String(args.length).length;
    const formattedArgs = args
      .map((arg, i) => {
        const formattedArg = stringify(arg, { includeStack: true, pretty: true, maxDepth: 3 });
        return `[arg${String(i).padStart(indexPadding, '0')}] ${formattedArg}`;
      })
      .join('\n');

    return formatted ? `${formatted}${delimiter}${formattedArgs}` : formattedArgs;
  };
