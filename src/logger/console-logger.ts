import { BaseLogger } from './base-logger.ts';
import type { LogLevel } from './definition.ts';
import type { EmitterFormat } from './emitter.ts';
import { emitLine } from './emitter.ts';

/**
 * A logger that emits log messages to standard output (console.log). By default the lines are emitted with colors.
 *
 * @example
 *
 * ```ts
 * import { ConsoleLogger } from 'emitnlog/logger';
 *
 * // Create a console logger
 * const logger = new ConsoleLogger();
 *
 * // Log messages at different levels
 * logger.d`Detailed debugging information`;
 *
 * // Using template literals with embedded values
 * const userId = 'user123';
 * logger.i`User ${userId} logged in successfully`;
 *
 * // Including additional context with args()
 * const error = new Error('Connection timeout');
 * logger.args(error).e`Database operation failed: ${error}`;
 *
 * // Using with level filtering - only errors and above
 * const productionLogger = new ConsoleLogger('error');
 * productionLogger.i`This won't be logged`;
 * productionLogger.e`This will be logged to stderr`;
 * ```
 */
export class ConsoleLogger extends BaseLogger {
  private readonly format: EmitterFormat;

  /**
   * Creates a new ConsoleLogger instance.
   *
   * @param level - The log level to use (default: 'info')
   * @param format - The format of the emitted lines (default: 'colorful')
   */
  public constructor(level?: LogLevel, format: EmitterFormat = 'colorful') {
    super(level);
    this.format = format;
  }

  protected override emitLine(level: LogLevel, message: string, args: readonly unknown[]): void {
    const line = emitLine(level, message, undefined, this.format);
    // eslint-disable-next-line no-undef, no-console
    console.log(line, ...args);
  }
}
