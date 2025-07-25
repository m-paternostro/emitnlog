import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { delay } from '../../utils/async/delay.ts';
import { startPolling } from '../../utils/async/poll.ts';
import { withTimeout } from '../../utils/async/with-timeout.ts';
import { errorify } from '../../utils/converter/errorify.ts';
import { stringify } from '../../utils/converter/stringify.ts';
import type { BaseLoggerOptions } from '../base-logger.ts';
import { BaseLogger } from '../base-logger.ts';
import type { LogLevel } from '../definition.ts';
import type { EmitterFormat } from '../emitter.ts';
import { emitLine, formatSupportsArgs } from '../emitter.ts';

/**
 * Configuration options for the FileLogger
 */
export type FileLoggerOptions = BaseLoggerOptions & {
  /**
   * The minimum severity level for log entries (default: 'info')
   */
  readonly level?: LogLevel;

  /**
   * The format of the emitted lines (default: 'plain')
   */
  readonly format?: EmitterFormat;

  /**
   * Whether to omit additional args in log output (default: false).
   */
  readonly omitArgs?: boolean;

  /**
   * The delay in milliseconds between buffer flushes (default: 20)
   */
  readonly flushDelayMs?: number;

  /**
   * Error handler callback for file operations If not provided, errors will be thrown
   */
  readonly errorHandler?: (error: unknown) => void;

  /**
   * Number of retries to attempt for file operations (default: 0)
   */
  readonly retryLimit?: number;

  /**
   * Delay between retries in milliseconds (default: 500)
   */
  readonly retryDelayMs?: number;
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
 * - Optional automatic retry for file operations when they fail
 *
 * @example Basic usage
 *
 * ```ts
 * // Create a file logger with default info level
 * const logger = new FileLogger('/var/log/myapp.log');
 * logger.info('Application started');
 *
 * // Or use a filename (will be created in OS temp directory)
 * const tempLogger = new FileLogger('debug.log', 'debug');
 *
 * // Use home directory with tilde expansion
 * const homeLogger = new FileLogger('~/logs/myapp.log');
 *
 * // Use with configuration options
 * const configuredLogger = new FileLogger({
 *   filePath: '/var/log/myapp.log',
 *   level: 'warning',
 *   format: 'colorful', // Preserve color codes
 *   omitArgs: true, // Don't include additional arguments
 *   errorHandler: (err) => myCustomErrorReporter(err),
 *   retryLimit: 3, // Retry file operations up to 3 times
 *   retryDelayMs: 500, // Wait 500ms between retries
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
 *
 * @example With retry capabilities
 *
 * ```ts
 * // Create a file logger with retry capabilities (useful for unreliable storage)
 * const reliableLogger = new FileLogger({
 *   filePath: '/network/share/logs/app.log',
 *   retryLimit: 5, // Retry up to 5 times
 *   retryDelayMs: 1000, // Wait 1 second between retries
 *   errorHandler: (err) => {
 *     console.error('Failed to write log after multiple retries:', err);
 *     // Maybe notify monitoring system
 *   },
 * });
 *
 * // Logs will automatically retry if the file operation fails
 * reliableLogger.info('This log entry will retry if the file system is temporarily unavailable');
 * ```
 */
export class FileLogger extends BaseLogger {
  /**
   * The full path to the log file
   */
  public readonly filePath: string;

  /**
   * The log format
   */
  private readonly format: EmitterFormat;

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
   * The maximum number of retries for file operations
   */
  private readonly retryLimit: number;

  /**
   * The delay between retries in milliseconds
   */
  private readonly retryDelayMs: number;

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
   * @param level The minimum severity level for log entries (default: 'info')
   * @param format - The format of the emitted lines (default: 'plain')
   */
  public constructor(
    filePathOrOptions: string | ({ readonly filePath: string } & FileLoggerOptions),
    level?: LogLevel,
    format?: EmitterFormat,
  ) {
    const isString = typeof filePathOrOptions === 'string';

    const logLevel = level ?? (isString ? undefined : filePathOrOptions.level);
    const logFormat = format ?? (isString ? undefined : filePathOrOptions.format) ?? 'plain';

    const filePath = isString ? filePathOrOptions : filePathOrOptions.filePath;
    const omitArgs = isString ? false : (filePathOrOptions.omitArgs ?? false);
    const flushDelayMs = isString ? 20 : (filePathOrOptions.flushDelayMs ?? 20);
    const retryLimit = isString ? 0 : (filePathOrOptions.retryLimit ?? 0);
    const retryDelayMs = isString ? 500 : (filePathOrOptions.retryDelayMs ?? 500);
    const errorHandler = isString ? undefined : filePathOrOptions.errorHandler;

    super(logLevel, isString ? undefined : filePathOrOptions);

    if (!filePath) {
      throw new Error('File path is required');
    }

    this.format = logFormat;
    this.omitArgs = omitArgs;
    this.flushDelayMs = flushDelayMs;
    this.retryLimit = retryLimit;
    this.retryDelayMs = retryDelayMs;
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

  protected override emitLine(level: LogLevel, message: string, args: readonly unknown[]): void {
    if (this.closed) {
      return;
    }

    if (this.omitArgs) {
      args = [];
    }

    if (this.format !== 'colorful') {
      message = message.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    }
    const content = emitLine(level, message, args, this.format);
    this.buffer.push(content);

    if (!formatSupportsArgs(this.format) && args.length) {
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

  private async createLogDirectory(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  private async appendFile(content: string): Promise<void> {
    if (this.retryLimit <= 0) {
      await fs.appendFile(this.filePath, content, 'utf8');
      return;
    }

    const { wait } = startPolling(
      async () => {
        try {
          await fs.appendFile(this.filePath, content, 'utf8');
          return true;
        } catch {
          return false;
        }
      },
      this.retryDelayMs,
      { retryLimit: this.retryLimit, interrupt: (result) => result, invokeImmediately: true },
    );

    const result = await wait;
    if (result !== true) {
      throw new Error(`Failed to write to log file ${this.filePath} after ${this.retryLimit} attempts`);
    }
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
        await this.appendFile(linesToWrite).catch(this.errorHandler);
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
