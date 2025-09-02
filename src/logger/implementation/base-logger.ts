import type { StringifyOptions } from '../../utils/converter/stringify.ts';
import { stringify } from '../../utils/converter/stringify.ts';
import type { Logger, LogLevel, LogMessage } from '../definition.ts';
import { shouldEmitEntry } from './level-utils.ts';

/**
 * Options for the BaseLogger class.
 */
export type BaseLoggerOptions = {
  /**
   * Options for how values are stringified in log messages.
   */
  readonly stringifyOptions?: StringifyOptions;
};

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
  private readonly _baseLevel: LogLevel | 'off';

  /**
   * Additional arguments to include with the next template literal log entry. This is reset after each log operation.
   */
  private _pendingArgs: unknown[] = [];

  private readonly _options?: BaseLoggerOptions;

  /**
   * Creates a new BaseLogger with the specified minimum severity level.
   *
   * @param level The minimum severity level for log entries (default: 'info')
   * @param options Options for how values are stringified in log messages
   */
  public constructor(level: LogLevel, options?: BaseLoggerOptions) {
    this._baseLevel = level;
    this._options = options;
  }

  public get level(): LogLevel | 'off' {
    return this._baseLevel;
  }

  public args(...args: unknown[]): Logger {
    this._pendingArgs.push(...args);
    return this;
  }

  public trace(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('trace', message, ...args);
  }

  public t(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.trace(() => this.taggedLog(strings, values));
  }

  public debug(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('debug', message, ...args);
  }

  public d(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.debug(() => this.taggedLog(strings, values));
  }

  public info(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('info', message, ...args);
  }

  public i(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.info(() => this.taggedLog(strings, values));
  }

  public notice(message: LogMessage, ...args: unknown[]): void {
    this.log('notice', message, ...args);
  }

  public n(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.notice(() => this.taggedLog(strings, values));
  }

  public warning(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('warning', message, ...args);
  }

  public w(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.warning(() => this.taggedLog(strings, values));
  }

  public error(value: LogMessage | Error | { error: unknown }, ...args: readonly unknown[]): void {
    const message: LogMessage = () =>
      typeof value === 'function'
        ? value()
        : value && typeof value === 'object' && 'error' in value
          ? this.stringifyValue(value.error)
          : this.stringifyValue(value);

    if (typeof value === 'object') {
      args = [value, ...args];
    }

    this.log('error', message, ...args);
  }

  public e(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.error(() => this.taggedLog(strings, values));
  }

  public critical(message: LogMessage, ...args: unknown[]): void {
    this.log('critical', message, ...args);
  }

  public c(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.critical(() => this.taggedLog(strings, values));
  }

  public alert(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('alert', message, ...args);
  }

  public a(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.alert(() => this.taggedLog(strings, values));
  }

  public emergency(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('emergency', message, ...args);
  }

  public em(strings: TemplateStringsArray, ...values: readonly unknown[]): void {
    this.emergency(() => this.taggedLog(strings, values));
  }

  public log(level: LogLevel, message: LogMessage, ...args: readonly unknown[]): void {
    const pendingArgs = this.consumePendingArgs();
    if (this.shouldEmitEntry(level)) {
      if (typeof message === 'function') {
        message = message();
      }

      this.emit(level, String(message), pendingArgs ? [...pendingArgs, ...args] : args);
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

  protected taggedLog(strings: TemplateStringsArray, values: readonly unknown[]): string {
    return String.raw({ raw: strings }, ...values.map((arg) => this.stringifyValue(arg)));
  }

  /**
   * Stringifies a value.
   *
   * @param value The message to stringify
   * @returns The stringified message
   */
  protected stringifyValue(value: unknown): string {
    if (typeof value === 'function') {
      value = (value as () => unknown)();
    }
    return stringify(value, this._options?.stringifyOptions);
  }

  /**
   * Emits the resolved log message at the specified level and extra arguments.
   *
   * @param level
   * @param message
   * @param args
   */
  protected abstract emit(level: LogLevel, message: string, args: readonly unknown[]): void;
}
