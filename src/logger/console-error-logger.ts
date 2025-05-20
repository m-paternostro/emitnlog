import { BaseLogger } from './base-logger.ts';
import type { LogLevel } from './definition.ts';
import { emitColorfulLine, emitLine } from './formatter.ts';

/**
 * A logger that emits log messages to standard error (console.error). By default the lines are emitted with colors.
 *
 * @example
 *
 * ```ts
 * // Create a console error logger
 * const logger = new ConsoleErrorLogger();
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
 * const productionLogger = new ConsoleErrorLogger('error');
 * productionLogger.i`This won't be logged`;
 * productionLogger.e`This will be logged to stderr`;
 * ```
 */
export class ConsoleErrorLogger extends BaseLogger {
  private readonly skipColor?: boolean;

  /**
   * Creates a new ConsoleLogger instance.
   *
   * @param level - The log level to use (default: 'info')
   * @param skipColor - Whether to skip color coding (default: false)
   */
  public constructor(level?: LogLevel, skipColor?: boolean) {
    super(level);
    this.skipColor = skipColor;
  }

  protected override emitLine(level: LogLevel, message: string, args: readonly unknown[]): void {
    const line = this.skipColor ? emitLine(level, message) : emitColorfulLine(level, message);
    // eslint-disable-next-line no-undef, no-console
    console.error(line, ...args);
  }
}
