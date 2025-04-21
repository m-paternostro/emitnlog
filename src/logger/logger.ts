/**
 * Inspired by RFC5424, with an additional 'trace' level for ultra-detailed logging.
 *
 * The severity levels are assumed to be numerically ascending from most important to least important.
 *
 * Level descriptions:
 *
 * ```
 * trace     - Extremely detailed debugging information (e.g., per-iteration or per-call tracing)
 * debug     - Detailed debugging information (e.g., function entry/exit points)
 * info      - General informational messages (e.g., operation progress updates)
 * notice    - Normal but significant events (e.g., configuration changes)
 * warning   - Warning conditions (e.g., deprecated feature usage)
 * error     - Error conditions (e.g., operation failures)
 * critical  - Critical conditions (e.g., system component failures)
 * alert     - Action must be taken immediately (e.g., data corruption detected)
 * emergency - System is unusable (e.g., complete system failure)
 * ```
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * Generic logger interface that provides methods for logging entries at different severity levels.
 *
 * The logger supports a filtering mechanism based on severity levels:
 *
 * - Each logger has a configurable `level` property which sets the minimum severity level for emitted logs
 * - Log entries with a severity level below the logger's configured level are filtered out
 * - When set to 'off', no log entries are emitted regardless of their level
 *
 * The severity filtering follows this hierarchy (from lowest to highest): debug < info < notice < warning < error <
 * critical < alert < emergency
 *
 * For example, if the logger's level is set to 'warning':
 *
 * - Entries logged with debug(), info(), or notice() methods will be filtered out
 * - Entries logged with warning(), error(), critical(), alert(), or emergency() will be emitted
 */
export type Logger = {
  /**
   * The current minimum severity level of the logger.
   *
   * Log entries with a level below this threshold will not be emitted. For example, setting the level to `info` (which
   * is the default level) will cause `debug` logs to be ignored.
   *
   * If set to 'off', no log entries are emitted regardless of level.
   */
  level: LogLevel | 'off';

  /**
   * Sets additional arguments to be included with the next log entry. This is particularly useful with the template
   * string method, because it enables fluent chaining while still passing additional arguments.
   *
   * @example
   *
   * ```ts
   * // Pass an error object with a template literal
   * logger.args(error).e`Failed to connect to database at ${timestamp}`;
   *
   * // Pass multiple arguments
   * logger.args(user, requestId, timestamp).i`User ${user.name} logged in`;
   *
   * // Pass contextual data
   * logger.args({ userId, requestId }).d`Processing request for item ${itemId}`;
   * ```
   *
   * @param args Arguments to be included with the next log entry
   * @returns A logger instance for chaining with template literal methods
   */
  readonly args: (...args: unknown[]) => Logger;

  /**
   * Logs a trace-level entry for extremely detailed debugging information (e.g., per-iteration or call tracing).
   *
   * Trace entries are only emitted if the logger's level is set to `trace`.
   *
   * The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   * when the content is expensive to construct, as the function will only be invoked if the entry will actually be
   * emitted based on the current logger level.
   *
   * @example
   *
   * ```ts
   * logger.trace('Loop iteration start');
   * logger.trace(() => `Iteration ${i} state: ${JSON.stringify(state)}`);
   * ```
   *
   * @param message The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly trace: (message: LogMessage, ...args: unknown[]) => void;

  /**
   * Logs a trace-level entry using a template string, which is only computed if the current log level (`logger.level`)
   * is `trace`.
   *
   * Values in template literals are automatically formatted:
   *
   * - Error objects will show their message text (e.g., `${new Error('fail')}` becomes 'fail')
   * - Objects with a `message` property will display that message
   * - Functions are executed and their return values formatted
   * - All other values are converted to their string representation
   *
   * @example
   *
   * ```ts
   * logger.t`Entering loop body`;
   * logger.t`Iteration ${i} with state: ${state}`;
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly t: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs a debug-level entry for detailed debugging information (e.g., function entry/exit points).
   *
   * Debug entries are only emitted if the logger's level is set to `debug` or `trace`.
   *
   * The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   * when the content is expensive to construct, as the function will only be invoked if the entry will actually be
   * emitted based on the current logger level.
   *
   * @example
   *
   * ```ts
   * logger.debug('This is a debug entry');
   * logger.debug(() => `Debug entry with computed value: ${expensiveOperation()}`);
   * ```
   *
   * @param message The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly debug: (message: LogMessage, ...args: unknown[]) => void;

  /**
   * Logs a debug-level entry using a template string, which is only computed if the current log level (`logger.level`)
   * is `debug` or `trace`.
   *
   * Values in template literals are automatically formatted:
   *
   * - Error objects will show their message text (e.g., `${new Error('Connection failed')}` becomes 'Connection failed')
   * - Objects with a `message` property will display that message
   * - Functions are executed and their return values formatted using the rules above
   * - All other values are converted to their string representation
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.d`Debug entry with simple text`;
   *
   * // With computed values
   * logger.d`Debug entry with computed value: ${expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Something went wrong');
   * logger.d`Operation failed: ${error}`; // Logs: "Operation failed: Something went wrong"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly d: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an info-level entry for general informational messages (e.g., operation progress updates).
   *
   * Info entries are only emitted if the logger's level is set to `info`, `debug`, or `trace`.
   *
   * The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   * when the message is expensive to construct, as the function will only be invoked if the entry will actually be
   * emitted based on the current logger level.
   *
   * @example
   *
   * ```ts
   * logger.info('Operation started');
   * logger.info(() => `Processing item ${itemId} at ${new Date().toISOString()}`);
   * ```
   *
   * @param message The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly info: (message: LogMessage, ...args: unknown[]) => void;

  /**
   * Logs an info-level entry using a template string, which is only computed if the current log level (`logger.level`)
   * is `info`, `debug`, or `trace`.
   *
   * Values in template literals are automatically formatted:
   *
   * - Error objects will show their message text (e.g., `${new Error('Connection failed')}` becomes 'Connection failed')
   * - Objects with a `message` property will display that message
   * - Functions are executed and their return values formatted using the rules above
   * - All other values are converted to their string representation
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.i`Operation started`;
   *
   * // With computed values
   * logger.i`Processing item ${itemId} at ${new Date().toISOString()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.i`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly i: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs a notice-level entry for normal but significant events (e.g., configuration changes).
   *
   * Notice entries are only emitted if the logger's level is set to `notice`, `info`, `debug`, or `trace`.
   *
   * The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   * when the message is expensive to construct, as the function will only be invoked if the entry will actually be
   * emitted based on the current logger level.
   *
   * @example
   *
   * ```ts
   * logger.notice('Configuration updated');
   * logger.notice(() => `User ${userId} changed settings at ${new Date().toISOString()}`);
   * ```
   *
   * @param message The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly notice: (message: LogMessage, ...args: unknown[]) => void;

  /**
   * Logs a notice-level entry using a template string, which is only computed if the current log level (`logger.level`)
   * is `notice`, `info`, `debug`, or `trace`.
   *
   * Values in template literals are automatically formatted:
   *
   * - Error objects will show their message text (e.g., `${new Error('Connection failed')}` becomes 'Connection failed')
   * - Objects with a `message` property will display that message
   * - Functions are executed and their return values formatted using the rules above
   * - All other values are converted to their string representation
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.n`Configuration updated`;
   *
   * // With computed values
   * logger.n`User ${userId} changed settings at ${new Date().toISOString()}`;
   *
   * // With error objects - message is automatically extracted
   * const warningObj = { message: 'Almost reached quota' };
   * logger.n`Usage warning: ${warningObj}`; // Logs: "Usage warning: Almost reached quota"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly n: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs a warning-level entry for warning conditions (e.g., deprecated feature usage).
   *
   * Warning entries are only emitted if the logger's level is set to `warning`, `notice`, `info`, `debug`, or `trace`.
   *
   * The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   * when the message is expensive to construct, as the function will only be invoked if the entry will actually be
   * emitted based on the current logger level.
   *
   * @example
   *
   * ```ts
   * logger.warning('Feature X is deprecated and will be removed in version 2.0');
   * logger.warning(() => `Slow operation detected: ${operation} took ${duration}ms`);
   * ```
   *
   * @param message The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly warning: (message: LogMessage, ...args: unknown[]) => void;

  /**
   * Logs a warning-level entry using a template string, which is only computed if the current log level
   * (`logger.level`) is `warning`, `notice`, `info`, `debug`, or `trace`.
   *
   * Values in template literals are automatically formatted:
   *
   * - Error objects will show their message text (e.g., `${new Error('Connection failed')}` becomes 'Connection failed')
   * - Objects with a `message` property will display that message
   * - Functions are executed and their return values formatted using the rules above
   * - All other values are converted to their string representation
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.w`Feature X is deprecated and will be removed in version 2.0`;
   *
   * // With computed values
   * logger.w`Slow operation detected: ${operation} took ${duration}ms`;
   *
   * // With error objects - message is automatically extracted
   * const deprecationError = new Error('API version will be removed soon');
   * logger.w`API usage warning: ${deprecationError}`; // Logs: "API usage warning: API version will be removed soon"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly w: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an error-level entry for error conditions (e.g., operation failures).
   *
   * Error entries are only emitted if the logger's level is set to `error`, `warning`, `notice`, `info`, `debug`, or
   * `trace`.
   *
   * The error entry content can be:
   *
   * - A direct value that is logged as is
   * - A function that returns a value, useful for messages that are expensive to compute
   * - An Error object, which is automatically stringified and added as an additional argument
   * - An object with an `error` property that is logged as a string and added as an additional argument
   *
   * @example
   *
   * ```ts
   * logger.error('Failed to connect to database');
   * logger.error(() => `Operation failed at ${new Date().toISOString()}`);
   * logger.error(new Error('Connection timeout'), error);
   * logger.error({ error: ['Database connection failed', errorCode] });
   * ```
   *
   * @param error The error content, Error object, or function that returns content
   * @param args Additional arguments to include in the log entry
   */
  readonly error: (error: LogMessage | Error | { error: unknown }, ...args: unknown[]) => void;

  /**
   * Logs an error-level entry using a template string, which is only computed if the current log level (`logger.level`)
   * is `error`, `warning`, `notice`, `info`, `debug`, or `trace`.
   *
   * Values in template literals are automatically formatted:
   *
   * - Error objects will show their message text (e.g., `${new Error('Connection failed')}` becomes 'Connection failed')
   * - Objects with a `message` property will display that message
   * - Functions are executed and their return values formatted using the rules above
   * - All other values are converted to their string representation
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.e`Failed to connect to database`;
   *
   * // With automatic date formatting
   * logger.e`Operation failed at ${new Date()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Connection timeout');
   * logger.e`Database error: ${error}`; // Logs: "Database error: Connection timeout"
   *
   * // Combined with args() to include the error object in the log
   * logger.args(error).e`An error occurred while performing the operation: ${error}`;
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly e: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs a critical-level entry for critical conditions (e.g., system component failures).
   *
   * Critical entries are only emitted if the logger's level is set to `critical`, `error`, `warning`, `notice`, `info`,
   * , `debug`, or `trace`.
   *
   * @example
   *
   * ```ts
   * logger.critical('Database connection pool exhausted');
   * logger.critical(() => `System memory usage critical: ${memoryUsage}%`);
   * ```
   *
   * @param message The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly critical: (message: LogMessage, ...args: unknown[]) => void;

  /**
   * Logs a critical-level entry using a template string, which is only computed if the current log level
   * (`logger.level`) is `critical`, `error`, `warning`, `notice`, `info`, `debug`, or `trace`.
   *
   * Values in template literals are automatically formatted:
   *
   * - Error objects will show their message text (e.g., `${new Error('Connection failed')}` becomes 'Connection failed')
   * - Objects with a `message` property will display that message
   * - Functions are executed and their return values formatted using the rules above
   * - All other values are converted to their string representation
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.c`Database connection pool exhausted`;
   *
   * // With computed values
   * logger.c`System memory usage critical: ${memoryUsage}%`;
   *
   * // With error objects - message is automatically extracted
   * const criticalError = new Error('Connection pool saturated');
   * logger.c`Resource exhaustion: ${criticalError}`; // Logs: "Resource exhaustion: Connection pool saturated"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly c: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an alert-level entry for conditions where action must be taken immediately (e.g., data corruption detected).
   *
   * Alert entries are only emitted if the logger's level is set to `alert`, `critical`, `error`, `warning`, `notice`,
   * `info`, `debug`, or `trace`.
   *
   * @example
   *
   * ```ts
   * logger.alert('Data corruption detected in customer database');
   * logger.alert(() => `Security breach detected from IP ${ipAddress}`);
   * ```
   *
   * @param message The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly alert: (message: LogMessage, ...args: unknown[]) => void;

  /**
   * Logs an alert-level entry using a template string, which is only computed if the current log level (`logger.level`)
   * is `alert`, `critical`, `error`, `warning`, `notice`, `info`, `debug`, or `trace`.
   *
   * Values in template literals are automatically formatted:
   *
   * - Error objects will show their message text (e.g., `${new Error('Connection failed')}` becomes 'Connection failed')
   * - Objects with a `message` property will display that message
   * - Functions are executed and their return values formatted using the rules above
   * - All other values are converted to their string representation
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.a`Data corruption detected in customer database`;
   *
   * // With computed values
   * logger.a`Security breach detected from IP ${ipAddress}`;
   *
   * // With error objects - message is automatically extracted
   * const securityError = new Error('Unauthorized access detected');
   * logger.a`Security alert: ${securityError}`; // Logs: "Security alert: Unauthorized access detected"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly a: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an emergency-level entry for when the system is unusable (e.g., complete system failure).
   *
   * Emergency entries are emitted at all logger levels except when the logger level is set to 'off'.
   *
   * @example
   *
   * ```ts
   * logger.emergency('System is shutting down due to critical failure');
   * logger.emergency(() => `Fatal error in primary system: ${errorDetails}`);
   * ```
   *
   * @param message The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly emergency: (message: LogMessage, ...args: unknown[]) => void;

  /**
   * Logs an emergency-level entry using a template string, which is computed at all logger levels except 'off'.
   *
   * Values in template literals are automatically formatted:
   *
   * - Error objects will show their message text (e.g., `${new Error('Connection failed')}` becomes 'Connection failed')
   * - Objects with a `message` property will display that message
   * - Functions are executed and their return values formatted using the rules above
   * - All other values are converted to their string representation
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.em`System is shutting down due to critical failure`;
   *
   * // With computed values
   * logger.em`Fatal error in primary system: ${errorDetails}`;
   *
   * // With error objects - message is automatically extracted
   * const fatalError = new Error('Catastrophic failure in database cluster');
   * logger.em`EMERGENCY: ${fatalError}`; // Logs: "EMERGENCY: Catastrophic failure in database cluster"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly em: (strings: TemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an entry at a specific severity level. This method is useful for dynamically setting the level without having
   * to call the specific level method directly.
   *
   * The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   * when the message is expensive to construct, as the function will only be invoked if the entry will actually be
   * emitted based on the current logger level.
   *
   * @example
   *
   * ```ts
   * logger.log('info', 'Operation completed successfully');
   * logger.log('warning', () => `High latency detected: ${latency}ms`);
   * ```
   *
   * @param level The severity level for the log entry
   * @param message The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly log: (level: LogLevel, message: LogMessage, ...args: unknown[]) => void;
};

/**
 * Type representing the content of a log entry. Can be a primitive value or a function that returns a primitive value.
 */
export type LogMessage = string | number | boolean | (() => string | number | boolean);
