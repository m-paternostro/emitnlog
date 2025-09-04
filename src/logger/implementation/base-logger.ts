import { emptyArray } from '../../utils/common/singleton.ts';
import type { StringifyOptions } from '../../utils/converter/stringify.ts';
import { stringify } from '../../utils/converter/stringify.ts';
import type { Logger, LogLevel, LogMessage, LogTemplateStringsArray } from '../definition.ts';
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
   * Converts an error input to a log message and arguments.
   *
   * @param logger The logger to use for stringification
   * @param input The input to convert
   * @param args The arguments to convert
   */
  public static convertErrorInput(
    logger: Logger,
    input: LogMessage | Error | { error: unknown },
    args: readonly unknown[],
  ): { readonly convertedMessage: LogMessage; readonly convertedArgs: readonly unknown[] } {
    const stringifyValue =
      logger instanceof BaseLogger
        ? (value: unknown) => logger.stringifyValue(value)
        : (value: unknown) => stringify(value);

    const convertedMessage: LogMessage = () =>
      typeof input === 'function'
        ? input()
        : input && typeof input === 'object' && 'error' in input
          ? stringifyValue(input.error)
          : stringifyValue(input);

    const convertedArgs = typeof input === 'object' ? (args.length ? [input, ...args] : [input]) : args;

    return { convertedMessage, convertedArgs };
  }

  /**
   * The minimum severity level for log entries to be emitted. Log entries with levels below this threshold will be
   * filtered out. Default is 'info'.
   */
  private readonly _levelProvider: () => LogLevel | 'off';

  /**
   * Additional arguments to include with the next template literal log entry. This is reset after each log operation.
   */
  private _pendingArgs: unknown[] = [];

  private readonly _options?: BaseLoggerOptions;

  /**
   * Creates a new BaseLogger with the specified minimum severity level.
   *
   * @param level The minimum severity level for log entries or a function that returns this value
   * @param options Options for how values are stringified in log messages
   */
  public constructor(level: LogLevel | 'off' | (() => LogLevel | 'off'), options?: BaseLoggerOptions) {
    this._levelProvider = typeof level === 'function' ? level : () => level;
    this._options = options;
  }

  public get level(): LogLevel | 'off' {
    return this._levelProvider();
  }

  public args(...args: unknown[]): Logger {
    this._pendingArgs.push(...args);
    return this;
  }

  public trace(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('trace', message, ...args);
  }

  public t(strings: LogTemplateStringsArray, ...values: readonly unknown[]): void {
    this.log('trace', () => this.taggedLog(strings, values));
  }

  public debug(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('debug', message, ...args);
  }

  public d(strings: LogTemplateStringsArray, ...values: readonly unknown[]): void {
    this.log('debug', () => this.taggedLog(strings, values));
  }

  public info(message: LogMessage, ...args: readonly unknown[]): void {
    this.log('info', message, ...args);
  }

  public i(strings: LogTemplateStringsArray, ...values: readonly unknown[]): void {
    this.log('info', () => this.taggedLog(strings, values));
  }

  public notice(message: LogMessage, ...args: unknown[]): void {
    this.log('notice', message, ...args);
  }

  public n(strings: LogTemplateStringsArray, ...values: readonly unknown[]): void {
    this.log('notice', () => this.taggedLog(strings, values));
  }

  public warning(input: LogMessage | Error | { error: unknown }, ...args: readonly unknown[]): void {
    const { convertedMessage, convertedArgs } = BaseLogger.convertErrorInput(this, input, args);
    this.log('warning', convertedMessage, ...convertedArgs);
  }

  public w(strings: LogTemplateStringsArray, ...values: readonly unknown[]): void {
    this.log('warning', () => this.taggedLog(strings, values));
  }

  public error(input: LogMessage | Error | { error: unknown }, ...args: readonly unknown[]): void {
    const { convertedMessage, convertedArgs } = BaseLogger.convertErrorInput(this, input, args);
    this.log('error', convertedMessage, ...convertedArgs);
  }

  public e(strings: LogTemplateStringsArray, ...values: readonly unknown[]): void {
    this.log('error', () => this.taggedLog(strings, values));
  }

  public critical(input: LogMessage | Error | { error: unknown }, ...args: unknown[]): void {
    const { convertedMessage, convertedArgs } = BaseLogger.convertErrorInput(this, input, args);
    this.log('critical', convertedMessage, ...convertedArgs);
  }

  public c(strings: LogTemplateStringsArray, ...values: readonly unknown[]): void {
    this.log('critical', () => this.taggedLog(strings, values));
  }

  public alert(input: LogMessage | Error | { error: unknown }, ...args: readonly unknown[]): void {
    const { convertedMessage, convertedArgs } = BaseLogger.convertErrorInput(this, input, args);
    this.log('alert', convertedMessage, ...convertedArgs);
  }

  public a(strings: LogTemplateStringsArray, ...values: readonly unknown[]): void {
    this.log('alert', () => this.taggedLog(strings, values));
  }

  public emergency(input: LogMessage | Error | { error: unknown }, ...args: readonly unknown[]): void {
    const { convertedMessage, convertedArgs } = BaseLogger.convertErrorInput(this, input, args);
    this.log('emergency', convertedMessage, ...convertedArgs);
  }

  public em(strings: LogTemplateStringsArray, ...values: readonly unknown[]): void {
    this.log('emergency', () => this.taggedLog(strings, values));
  }

  public log(level: LogLevel, message: LogMessage, ...args: readonly unknown[]): void {
    const pendingArgs = this.consumePendingArgs();
    if (shouldEmitEntry(this, level)) {
      if (typeof message === 'function') {
        message = message();
      }

      if (pendingArgs) {
        args = args.length ? [...pendingArgs, ...args] : pendingArgs;
      } else if (!args.length) {
        args = emptyArray();
      }

      this.emit(level, String(message), args);
    }
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

  protected taggedLog(strings: LogTemplateStringsArray, values: readonly unknown[]): string {
    if (typeof strings === 'function') {
      strings = strings();
    }
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
