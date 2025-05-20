import { exhaustiveCheck } from '../utils/common/exhaustive-check.ts';
import { stringify } from '../utils/converter/stringify.ts';
import type { Logger, LogLevel, LogMessage } from './definition.ts';
import { shouldEmitEntry } from './level-utils.ts';

/**
 * Base class for logger implementations, providing a complete implementation of the {@link Logger} interface.
 *
 * Logger implementors are strongly encouraged to extend this class to reduce the chances of future modifications
 * breaking current code.
 */
export abstract class BaseLogger implements Logger {
  /**
   * The minimum severity level for log entries to be emitted. Log entries with levels below this threshold will be
   * filtered out. Default is 'info'.
   */
  public level: LogLevel | 'off' = 'info';

  /**
   * Additional arguments to include with the next template literal log entry. This is reset after each log operation.
   */
  private _pendingArgs: unknown[] = [];

  /**
   * Creates a new BaseLogger with the specified minimum severity level.
   *
   * @param level The minimum severity level for log entries (default: 'info')
   */
  public constructor(level: LogLevel | 'off' = 'info') {
    this.level = level;
  }

  public args(...args: unknown[]): Logger {
    this._pendingArgs = args;
    return this;
  }

  public trace(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('trace', message, ...args);
  }

  public t(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.trace(() => this.taggedLog(strings, ...values));
  }

  public debug(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('debug', message, ...args);
  }

  public d(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.debug(() => this.taggedLog(strings, ...values));
  }

  public info(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('info', message, ...args);
  }

  public i(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.info(() => this.taggedLog(strings, ...values));
  }

  public notice(message: LogMessage, ...args: unknown[]): void {
    this.log('notice', message, ...args);
  }

  public n(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.notice(() => this.taggedLog(strings, ...values));
  }

  public warning(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('warning', message, ...args);
  }

  public w(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.warning(() => this.taggedLog(strings, ...values));
  }

  public error(value: unknown, ...args: readonly unknown[]): void {
    if (this.shouldEmitEntry('error')) {
      if (typeof value === 'function') {
        value = (value as () => unknown)();
      }

      if (value && typeof value === 'object') {
        args = [value, ...args];
        if ('error' in value) {
          value = this.stringify(value.error);
        } else {
          value = this.stringify(value);
        }
      }

      this.log('error', value as string, ...args);
    }
  }

  public e(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.error(() => this.taggedLog(strings, ...values));
  }

  public critical(message: LogMessage, ...args: unknown[]): void {
    this.log('critical', message, ...args);
  }

  public c(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.critical(() => this.taggedLog(strings, ...values));
  }

  public alert(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('alert', message, ...args);
  }

  public a(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.alert(() => this.taggedLog(strings, ...values));
  }

  public emergency(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('emergency', message, ...args);
  }

  public em(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.emergency(() => this.taggedLog(strings, ...values));
  }

  protected taggedLog(strings: TemplateStringsArray, ...values: readonly unknown[]): string {
    return String.raw({ raw: strings }, ...values.map((arg) => this.stringify(arg)));
  }

  public log(level: LogLevel, message: LogMessage, ...args: readonly unknown[]): void {
    const pendingArgs = this.consumePendingArgs();
    if (this.shouldEmitEntry(level)) {
      this.emit(level, this.stringify(message), pendingArgs ? [...pendingArgs, ...args] : args);
    }
  }

  /**
   * Stringifies the message.
   *
   * @param message The message to stringify
   * @returns The stringified message
   */
  protected stringify(message: unknown): string {
    if (typeof message === 'function') {
      message = (message as () => unknown)();
    }
    return stringify(message);
  }

  /**
   * Emits the resolved log message at the specified level and extra arguments.
   *
   * This method is the ideal extension point for clients providing a different logging mechanism because it is only
   * invoked if the level is applicable to the logger.
   *
   * @param level
   * @param message
   * @param args
   */
  protected emit(level: LogLevel, message: string, args: readonly unknown[]): void {
    switch (level) {
      case 'trace':
        this.emitLine(level, message, args);
        break;

      case 'debug':
        this.emitLine(level, message, args);
        break;

      case 'info':
        this.emitLine(level, message, args);
        break;

      case 'notice':
        this.emitLine(level, message, args);
        break;

      case 'warning':
        this.emitLine(level, message, args);
        break;

      case 'error':
        this.emitLine(level, message, args);
        break;

      case 'critical':
        this.emitLine(level, message, args);
        break;

      case 'alert':
        this.emitLine(level, message, args);
        break;

      case 'emergency':
        this.emitLine(level, message, args);
        break;

      default:
        exhaustiveCheck(level);
        throw new Error(`IllegalArgument: unsupported log level: '${level}'`);
    }
  }

  /**
   * Returns true if a log with the specified level is written.
   *
   * @param level The log level to check
   * @returns True if the log level is applicable, false otherwise
   */
  protected shouldEmitEntry(level: LogLevel): boolean {
    return shouldEmitEntry(this.level, level);
  }

  /**
   * Emits a log line. This is the main extensibility point of this class.
   *
   * @param line The log line
   * @param message The log message
   * @param args The log arguments
   */
  protected abstract emitLine(level: LogLevel, message: string, args: readonly unknown[]): void;

  /**
   * Consumes and returns the pending arguments, then clears them.
   */
  protected consumePendingArgs(): readonly unknown[] | undefined {
    if (!this._pendingArgs.length) {
      return undefined;
    }

    const args = this._pendingArgs;
    this._pendingArgs = [];
    return args;
  }
}
