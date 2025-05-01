import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { delay } from '../../utils/async/delay.ts';
import { errorify } from '../../utils/converter/errorify.ts';
import { stringify } from '../../utils/converter/stringify.ts';
import { withTimeout } from '../../utils/index.ts';
import { BaseLogger } from '../base-logger.ts';
import { emitColorfulLine, emitLine } from '../formatter.ts';
import type { LogLevel } from '../logger.ts';

/**
 * Configuration options for the FileLogger
 */
export type FileLoggerOptions = {
  /**
   * The minimum severity level for log entries (default: 'info')
   */
  level?: LogLevel;

  /**
   * Whether to keep ANSI color codes in log output (default: false) When false (default), ANSI color codes are stripped
   * from log output
   */
  keepAnsiColors?: boolean;

  /**
   * Whether to omit additional args in log output (default: false) When false (default), additional arguments passed to
   * log methods will be serialized and included in the log
   */
  omitArgs?: boolean;

  /**
   * The delay in milliseconds between buffer flushes (default: 20)
   */
  flushDelayMs?: number;

  /**
   * Error handler callback for file operations If not provided, errors will be thrown
   */
  errorHandler?: (error: unknown) => void;
};

/**
 * A simple implementation of a logger that writes log entries to a file with minimal overhead.
 *
 * Features:
 *
 * - Writes logs to a specified file in a non-blocking way
 * - Creates the directory structure if it doesn't exist
 * - Supports relative paths (writes to OS temp dir) and absolute paths
 * - Supports home directory expansion with tilde (~)
 * - Strips ANSI color codes by default
 * - Includes additional arguments by default with stack traces and pretty formatting
 *
 * @example Basic usage
 *
 * ```ts
 * // Create a file logger with default info level
 * const logger = new FileLogger('/var/log/myapp.log');
 * logger.info('Application started');
 *
 * // Or use a filename (will be created in OS temp directory)
 * const tempLogger = new FileLogger('debug.log');
 *
 * // Use home directory with tilde expansion
 * const homeLogger = new FileLogger('~/logs/myapp.log');
 *
 * // Use with configuration options
 * const configuredLogger = new FileLogger({
 *   filePath: '/var/log/myapp.log',
 *   level: 'warning',
 *   keepAnsiColors: true, // Preserve color codes
 *   omitArgs: true, // Don't include additional arguments
 *   errorHandler: (err) => myCustomErrorReporter(err),
 * });
 *
 * // Log with additional arguments (objects will be pretty-printed with stack traces)
 * const error = new Error('Connection failed');
 * configuredLogger.error('Database operation failed', error, { requestId: '12345', userId: 'user123' });
 * ```
 *
 * @example Using with tee for multiple outputs
 *
 * ```ts
 * import { tee } from 'emitnlog/logger';
 * import { FileLogger } from 'emitnlog/logger/node';
 *
 * // Create a logger that writes to both file and console
 * const fileLogger = new FileLogger('/var/log/app.log');
 * const consoleLogger = new ConsoleLogger();
 * const logger = tee(fileLogger, consoleLogger);
 *
 * // All logs go to both destinations
 * logger.info('This appears in console AND in the log file');
 * ```
 */
export class FileLogger extends BaseLogger {
  /**
   * The full path to the log file
   */
  public readonly filePath: string;

  /**
   * Whether to keep ANSI color codes in log messages
   */
  private readonly keepAnsiColors: boolean;

  /**
   * Whether to omit additional args in log output
   */
  private readonly omitArgs: boolean;

  /**
   * Error handler function
   */
  private readonly errorHandler: (error: unknown) => void;

  /**
   * The delay in milliseconds between buffer flushes
   */
  private readonly flushDelayMs: number;

  /**
   * A promise that resolves when the previous write operation is completed
   */
  private writePromise: Promise<void>;

  /**
   * Buffer of lines to write to the file
   */
  private buffer: string[] = [];

  /**
   * Whether the buffer write is scheduled
   */
  private flushScheduled = false;

  /**
   * Whether the logger is closed
   */
  private closed = false;

  /**
   * Creates a new FileLogger that writes to a file.
   *
   * @param filePathOrOptions Either a string path to the log file, or a configuration object
   */
  public constructor(filePathOrOptions: string | ({ filePath: string } & FileLoggerOptions)) {
    const isString = typeof filePathOrOptions === 'string';

    const filePath = isString ? filePathOrOptions : filePathOrOptions.filePath;
    const level = isString ? undefined : filePathOrOptions.level;
    const keepAnsiColors = isString ? false : (filePathOrOptions.keepAnsiColors ?? false);
    const omitArgs = isString ? false : (filePathOrOptions.omitArgs ?? false);
    const flushDelayMs = isString ? 20 : (filePathOrOptions.flushDelayMs ?? 20);
    const errorHandler = isString ? undefined : filePathOrOptions.errorHandler;

    super(level);

    if (!filePath) {
      throw new Error('File path is required');
    }

    this.keepAnsiColors = keepAnsiColors;
    this.omitArgs = omitArgs;
    this.flushDelayMs = flushDelayMs;
    this.errorHandler =
      errorHandler ??
      ((error) => {
        throw errorify(error);
      });

    if (filePath.includes(path.sep)) {
      if (filePath.length > 1 && filePath.startsWith('~')) {
        this.filePath = path.join(os.homedir(), filePath.substring(1));
      } else {
        this.filePath = filePath;
      }
    } else {
      this.filePath = path.join(os.tmpdir(), filePath);
    }

    this.writePromise = this.createLogDirectory().catch(this.errorHandler);
  }

  /**
   * Creates the directory for the log file if it doesn't exist
   */
  private async createLogDirectory(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  protected override emitLine(level: LogLevel, message: string, args: readonly unknown[]): void {
    if (this.closed) {
      return;
    }

    const content = this.keepAnsiColors
      ? emitColorfulLine(level, message)
      : emitLine(level, message.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, ''));

    this.buffer.push(content);

    if (!this.omitArgs && args.length) {
      this.buffer.push('args:');
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const formattedArg = stringify(arg, { includeStack: true, pretty: true, maxDepth: 3 });
        this.buffer.push(`[${i}] ${formattedArg}`);
      }
      this.buffer.push('');
    }

    this.flush();
  }

  /**
   * Flushes the buffer to the file.
   */
  public flush(): void {
    if (this.flushScheduled) {
      return;
    }

    if (!this.buffer.length) {
      this.flushScheduled = false;
      return;
    }

    this.flushScheduled = true;
    this.writePromise = this.writePromise
      .then(() => delay(this.flushDelayMs))
      .then(async () => {
        const linesToWrite = this.buffer.splice(0).join('\n') + '\n';
        this.flushScheduled = false;
        await fs.appendFile(this.filePath, linesToWrite, 'utf8').catch(this.errorHandler);
      });
  }

  /**
   * Closes the logger by flushes the buffer to the file.
   */
  public close(timeoutMs?: number): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      this.flush();
    }

    return timeoutMs !== undefined ? withTimeout(this.writePromise, timeoutMs) : this.writePromise;
  }
}
