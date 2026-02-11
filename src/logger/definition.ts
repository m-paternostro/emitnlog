/**
 * The possible levels for the Logger, inspired by RFC5424, with an additional 'trace' level for ultra-detailed logging.
 *
 * The severity levels are assumed to follow this order (least → most severe; most → least detailed):
 *
 * ```
 * Trace → debug → info → notice → warning → error → critical → alert → emergency
 * ```
 *
 * Level descriptions:
 *
 * ```
 * emergency - System is unusable (e.g., complete system failure)
 * alert     - Action must be taken immediately (e.g., data corruption detected)
 * critical  - Critical conditions (e.g., system component failures)
 * error     - Error conditions (e.g., operation failures)
 * warning   - Warning conditions (e.g., deprecated feature usage)
 * notice    - Normal but significant events (e.g., configuration changes)
 * info      - General informational messages (e.g., operation progress updates)
 * debug     - Detailed debugging information (e.g., function entry/exit points)
 * trace     - Extremely detailed debugging information (e.g., per-iteration or per-call tracing)
 * ```
 *
 * @see RFC5424: https://datatracker.ietf.org/doc/html/rfc5424
 */
export type LogLevel = 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug' | 'trace';

/**
 * Type representing the content of a log entry. Can be a primitive value or a function that returns a primitive value.
 */
export type LogMessage = string | number | boolean | (() => string | number | boolean);

/**
 * Type representing the template strings of a log entry. Can be a TemplateStringsArray or a function that returns a
 * TemplateStringsArray.
 */
export type LogTemplateStringsArray = TemplateStringsArray | (() => TemplateStringsArray);

/**
 * Generic logger interface that provides methods for logging entries at different severity levels.
 *
 * The logger supports a filtering mechanism based on severity levels:
 *
 * - Each logger has a configurable `level` property which sets the minimum severity level for emitted logs
 * - Log entries with a severity level below the logger's configured level are filtered out
 * - When set to 'off', no log entries are emitted regardless of their level
 *
 * The severity filtering follows this order (least → most severe; most → least detailed):
 *
 * ```
 * Trace → debug → info → notice → warning → error → critical → alert → emergency
 * ```
 *
 * For example, if the logger's level is set to 'warning':
 *
 * - Entries logged with debug(), info(), or notice() methods will be filtered out
 * - Entries logged with warning(), error(), critical(), alert(), or emergency() will be emitted
 */
export interface Logger {
  /**
   * The current minimum severity level of the logger.
   *
   * Log entries with a level below this threshold will not be emitted. For example, setting the level to `info` (which
   * is the default level) will cause `debug` logs to be ignored.
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, error, critical, alert, emergency.
   *
   * If set to 'off', no log entries are emitted regardless of level.
   */
  readonly level: LogLevel | 'off';

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
   * Log levels (least → most severe): **trace**, debug, info, notice, warning, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Trace entries are only emitted if `logger.level` is `trace`.
   * - The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   *   when the content is expensive to construct, as the function will only be invoked if the entry will actually be
   *   emitted based on the current logger level.
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
   * Logs a trace-level entry for extremely detailed debugging information (e.g., per-iteration or call tracing).
   *
   * Log levels (least → most severe): **trace**, debug, info, notice, warning, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Trace entries are only emitted if `logger.level` is `trace`.
   * - This template is only evaluated if the entry will be emitted (i.e. if `logger.level` is `trace`).
   *
   * Values in template literals are stringified using the logger's formatting rules (BaseLogger uses `stringify()` with
   * its configured stringify options). In particular:
   *
   * - Error objects stringify to their message text by default (e.g., `${new Error('Connection failed')}` becomes
   *   'Connection failed')
   * - Dates stringify to ISO strings by default (unless configured otherwise)
   * - Functions used as template values are executed and their return values stringified (useful for lazy/expensive
   *   values)
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.t`Entering loop body`;
   *
   * // With computed values
   * logger.t`Processing item ${itemId} at ${new Date()}`;
   * logger.t`Expensive computed value: ${() => expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.args(error).t`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly t: (strings: LogTemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs a debug-level entry for detailed debugging information (e.g., function entry/exit points).
   *
   * Log levels (least → most severe): trace, **debug**, info, notice, warning, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Debug entries are only emitted if `logger.level` is `debug` or any level listed before `debug` in the level order
   *   above.
   * - The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   *   when the content is expensive to construct, as the function will only be invoked if the entry will actually be
   *   emitted based on the current logger level.
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
   * Logs a debug-level entry using a template string.
   *
   * Log levels (least → most severe): trace, **debug**, info, notice, warning, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - This template is only evaluated if the entry will be emitted (i.e. if `logger.level` is `debug` or any level listed
   *   before `debug` in the level order above).
   *
   * Values in template literals are stringified using the logger's formatting rules (BaseLogger uses `stringify()` with
   * its configured stringify options). In particular:
   *
   * - Error objects stringify to their message text by default (e.g., `${new Error('Connection failed')}` becomes
   *   'Connection failed')
   * - Dates stringify to ISO strings by default (unless configured otherwise)
   * - Functions used as template values are executed and their return values stringified (useful for lazy/expensive
   *   values)
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.d`Operation started`;
   *
   * // With computed values
   * logger.d`Processing item ${itemId} at ${new Date()}`;
   * logger.d`Expensive computed value: ${() => expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.args(error).d`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly d: (strings: LogTemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an info-level entry for general informational messages (e.g., operation progress updates).
   *
   * Log levels (least → most severe): trace, debug, **info**, notice, warning, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Info entries are only emitted if `logger.level` is `info` or any level listed before `info` in the level order
   *   above.
   * - The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   *   when the message is expensive to construct, as the function will only be invoked if the entry will actually be
   *   emitted based on the current logger level.
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
   * Logs an info-level entry using a template string.
   *
   * Log levels (least → most severe): trace, debug, **info**, notice, warning, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - This template is only evaluated if the entry will be emitted (i.e. if `logger.level` is `info` or any level listed
   *   before `info` in the level order above).
   *
   * Values in template literals are stringified using the logger's formatting rules (BaseLogger uses `stringify()` with
   * its configured stringify options). In particular:
   *
   * - Error objects stringify to their message text by default (e.g., `${new Error('Connection failed')}` becomes
   *   'Connection failed')
   * - Dates stringify to ISO strings by default (unless configured otherwise)
   * - Functions used as template values are executed and their return values stringified (useful for lazy/expensive
   *   values)
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.i`Operation started`;
   *
   * // With computed values
   * logger.i`Processing item ${itemId} at ${new Date()}`;
   * logger.i`Expensive computed value: ${() => expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.args(error).i`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly i: (strings: LogTemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs a notice-level entry for normal but significant events (e.g., configuration changes).
   *
   * Log levels (least → most severe): trace, debug, info, **notice**, warning, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Notice entries are only emitted if `logger.level` is `notice` or any level listed before `notice` in the level
   *   order above.
   * - The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   *   when the message is expensive to construct, as the function will only be invoked if the entry will actually be
   *   emitted based on the current logger level.
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
   * Logs a notice-level entry using a template string.
   *
   * Log levels (least → most severe): trace, debug, info, **notice**, warning, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - This template is only evaluated if the entry will be emitted (i.e. if `logger.level` is `notice` or any level
   *   listed before `notice` in the level order above).
   *
   * Values in template literals are stringified using the logger's formatting rules (BaseLogger uses `stringify()` with
   * its configured stringify options). In particular:
   *
   * - Error objects stringify to their message text by default (e.g., `${new Error('Connection failed')}` becomes
   *   'Connection failed')
   * - Dates stringify to ISO strings by default (unless configured otherwise)
   * - Functions used as template values are executed and their return values stringified (useful for lazy/expensive
   *   values)
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.n`Configuration updated`;
   *
   * // With computed values
   * logger.n`Processing item ${itemId} at ${new Date()}`;
   * logger.n`Expensive computed value: ${() => expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.args(error).n`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly n: (strings: LogTemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs a warning-level entry for warning conditions (e.g., deprecated feature usage).
   *
   * Log levels (least → most severe): trace, debug, info, notice, **warning**, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Warning entries are only emitted if `logger.level` is `warning` or any level listed before `warning` in the level
   *   order above.
   * - The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   *   when the message is expensive to construct, as the function will only be invoked if the entry will actually be
   *   emitted based on the current logger level.
   *
   * The warning entry content can be:
   *
   * - A direct value that is logged as is,
   * - A function that returns a value, useful for messages that are expensive to compute,
   * - An Error object, which is automatically stringified and added as an additional argument,
   * - An object with an `error` property that is logged as a string and added as an additional argument - use this
   *   whenever logging an error of type unknown.
   *
   * @example
   *
   * ```ts
   * logger.warning('Feature X is deprecated and will be removed in version 2.0');
   * logger.warning(() => `Slow operation detected: ${operation} took ${duration}ms`);
   * logger.warning(new Error('Connection timeout... Retrying...'), error);
   * logger.warning({ error: ['Connection timeout... Retrying...', errorCode] });
   * ```
   *
   * @param input The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly warning: (input: LogMessage | Error | { error: unknown }, ...args: unknown[]) => void;

  /**
   * Logs a warning-level entry using a template string.
   *
   * Log levels (least → most severe): trace, debug, info, notice, **warning**, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - This template is only evaluated if the entry will be emitted (i.e. if `logger.level` is `warning` or any level
   *   listed before `warning` in the level order above).
   *
   * Values in template literals are stringified using the logger's formatting rules (BaseLogger uses `stringify()` with
   * its configured stringify options). In particular:
   *
   * - Error objects stringify to their message text by default (e.g., `${new Error('Connection failed')}` becomes
   *   'Connection failed')
   * - Dates stringify to ISO strings by default (unless configured otherwise)
   * - Functions used as template values are executed and their return values stringified (useful for lazy/expensive
   *   values)
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.w`Feature X is deprecated and will be removed in version 2.0`;
   *
   * // With computed values
   * logger.w`Processing item ${itemId} at ${new Date()}`;
   * logger.w`Expensive computed value: ${() => expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.args(error).w`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly w: (strings: LogTemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an error-level entry for error conditions (e.g., operation failures).
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, **error**, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Error entries are only emitted if `logger.level` is `error` or any level listed before `error` in the level order
   *   above.
   *
   * The error entry input can be:
   *
   * - A direct value that is logged as is,
   * - A function that returns a value, useful for messages that are expensive to compute,
   * - An Error object, which is automatically stringified and added as an additional argument,
   * - An object with an `error` property that is logged as a string and added as an additional argument - use this
   *   whenever logging an error of type unknown.
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
   * @param input The error content, Error object, or function that returns content
   * @param args Additional arguments to include in the log entry
   */
  readonly error: (input: LogMessage | Error | { error: unknown }, ...args: unknown[]) => void;

  /**
   * Logs an error-level entry using a template string.
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, **error**, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - This template is only evaluated if the entry will be emitted (i.e. if `logger.level` is `error` or any level listed
   *   before `error` in the level order above).
   *
   * Values in template literals are stringified using the logger's formatting rules (BaseLogger uses `stringify()` with
   * its configured stringify options). In particular:
   *
   * - Error objects stringify to their message text by default (e.g., `${new Error('Connection failed')}` becomes
   *   'Connection failed')
   * - Dates stringify to ISO strings by default (unless configured otherwise)
   * - Functions used as template values are executed and their return values stringified (useful for lazy/expensive
   *   values)
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.e`Failed to connect to database`;
   *
   * // With computed values
   * logger.e`Processing item ${itemId} at ${new Date()}`;
   * logger.e`Expensive computed value: ${() => expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.args(error).e`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly e: (strings: LogTemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs a critical-level entry for critical conditions (e.g., system component failures).
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, error, **critical**, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Critical entries are only emitted if `logger.level` is `critical` or any level listed before `critical` in the
   *   level order above.
   *
   * The critical entry input can be:
   *
   * - A direct value that is logged as is,
   * - A function that returns a value, useful for messages that are expensive to compute,
   * - An Error object, which is automatically stringified and added as an additional argument,
   * - An object with an `error` property that is logged as a string and added as an additional argument - use this
   *   whenever logging an error of type unknown.
   *
   * @example
   *
   * ```ts
   * logger.critical('Database connection pool exhausted');
   * logger.critical(() => `System memory usage critical: ${memoryUsage}%`);
   * logger.critical(new Error('Connection timeout'), error);
   * logger.critical({ error: ['Database connection failed', errorCode] });
   * ```
   *
   * @param input The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly critical: (input: LogMessage | Error | { error: unknown }, ...args: unknown[]) => void;

  /**
   * Logs a critical-level entry using a template string.
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, error, **critical**, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - This template is only evaluated if the entry will be emitted (i.e. if `logger.level` is `critical` or any level
   *   listed before `critical` in the level order above).
   *
   * Values in template literals are stringified using the logger's formatting rules (BaseLogger uses `stringify()` with
   * its configured stringify options). In particular:
   *
   * - Error objects stringify to their message text by default (e.g., `${new Error('Connection failed')}` becomes
   *   'Connection failed')
   * - Dates stringify to ISO strings by default (unless configured otherwise)
   * - Functions used as template values are executed and their return values stringified (useful for lazy/expensive
   *   values)
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.c`Database connection pool exhausted`;
   *
   * // With computed values
   * logger.c`Processing item ${itemId} at ${new Date()}`;
   * logger.c`Expensive computed value: ${() => expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.args(error).c`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly c: (strings: LogTemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an alert-level entry for conditions where action must be taken immediately (e.g., data corruption detected).
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, error, critical, **alert**, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Alert entries are only emitted if `logger.level` is `alert` or any level listed before `alert` in the level order
   *   above.
   *
   * The alert entry input can be:
   *
   * - A direct value that is logged as is,
   * - A function that returns a value, useful for messages that are expensive to compute,
   * - An Error object, which is automatically stringified and added as an additional argument,
   * - An object with an `error` property that is logged as a string and added as an additional argument - use this
   *   whenever logging an error of type unknown.
   *
   * @example
   *
   * ```ts
   * logger.alert('Data corruption detected in customer database');
   * logger.alert(() => `Security breach detected from IP ${ipAddress}`);
   * logger.alert(new Error('Connection timeout'), error);
   * logger.alert({ error: ['Database connection failed', errorCode] });
   * ```
   *
   * @param input The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly alert: (input: LogMessage | Error | { error: unknown }, ...args: unknown[]) => void;

  /**
   * Logs an alert-level entry using a template string.
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, error, critical, **alert**, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - This template is only evaluated if the entry will be emitted (i.e. if `logger.level` is `alert` or any level listed
   *   before `alert` in the level order above).
   *
   * Values in template literals are stringified using the logger's formatting rules (BaseLogger uses `stringify()` with
   * its configured stringify options). In particular:
   *
   * - Error objects stringify to their message text by default (e.g., `${new Error('Connection failed')}` becomes
   *   'Connection failed')
   * - Dates stringify to ISO strings by default (unless configured otherwise)
   * - Functions used as template values are executed and their return values stringified (useful for lazy/expensive
   *   values)
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.a`Data corruption detected in customer database`;
   *
   * // With computed values
   * logger.a`Processing item ${itemId} at ${new Date()}`;
   * logger.a`Expensive computed value: ${() => expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.args(error).a`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly a: (strings: LogTemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an emergency-level entry for when the system is unusable (e.g., complete system failure).
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, error, critical, alert, **emergency**.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - Emergency entries are emitted at all logger levels except when `logger.level` is `off`.
   *
   * The emergency entry input can be:
   *
   * - A direct value that is logged as is,
   * - A function that returns a value, useful for messages that are expensive to compute,
   * - An Error object, which is automatically stringified and added as an additional argument,
   * - An object with an `error` property that is logged as a string and added as an additional argument - use this
   *   whenever logging an error of type unknown.
   *
   * @example
   *
   * ```ts
   * logger.emergency('System is shutting down due to critical failure');
   * logger.emergency(() => `Fatal error in primary system: ${errorDetails}`);
   * logger.emergency(new Error('Connection timeout'), error);
   * logger.emergency({ error: ['Database connection failed', errorCode] });
   * ```
   *
   * @param input The entry content or function that returns the content
   * @param args Additional arguments to include in the log entry
   */
  readonly emergency: (input: LogMessage | Error | { error: unknown }, ...args: unknown[]) => void;

  /**
   * Logs an emergency-level entry using a template string.
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, error, critical, alert, **emergency**.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - This template is only evaluated if the entry will be emitted (i.e. if `logger.level` is not `off`).
   *
   * Values in template literals are stringified using the logger's formatting rules (BaseLogger uses `stringify()` with
   * its configured stringify options). In particular:
   *
   * - Error objects stringify to their message text by default (e.g., `${new Error('Connection failed')}` becomes
   *   'Connection failed')
   * - Dates stringify to ISO strings by default (unless configured otherwise)
   * - Functions used as template values are executed and their return values stringified (useful for lazy/expensive
   *   values)
   *
   * @example
   *
   * ```ts
   * // Basic template literal
   * logger.em`System is shutting down due to critical failure`;
   *
   * // With computed values
   * logger.em`Processing item ${itemId} at ${new Date()}`;
   * logger.em`Expensive computed value: ${() => expensiveOperation()}`;
   *
   * // With error objects - message is automatically extracted
   * const error = new Error('Missing configuration');
   * logger.args(error).em`Config status: ${error}`; // Logs: "Config status: Missing configuration"
   * ```
   *
   * @param strings The template strings
   * @param values The values to be interpolated into the template
   */
  readonly em: (strings: LogTemplateStringsArray, ...values: unknown[]) => void;

  /**
   * Logs an entry at a specific severity level. This method is useful for dynamically setting the level without having
   * to call the specific level method directly.
   *
   * Log levels (least → most severe): trace, debug, info, notice, warning, error, critical, alert, emergency.
   *
   * Details:
   *
   * - Role of the level: the level tags the entry's severity and is used for filtering (`logger.level`) and downstream
   *   routing/alerting.
   * - The entry is only emitted if `logger.level` is `level` or any level listed before `level` in the level order above.
   * - The entry content can be either a direct value or a function that returns a value. Using a function is recommended
   *   when the message is expensive to construct, as the function will only be invoked if the entry will actually be
   *   emitted based on the current logger level.
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

  /**
   * Flushes any buffered log entries, ensuring they are written to their destination.
   *
   * This method is optional and may not be available on all logger implementations. It is primarily used by loggers
   * that buffer entries for performance reasons (such as batch loggers or file loggers) to force immediate writing of
   * pending entries.
   *
   * The method can be either synchronous or asynchronous depending on the underlying implementation:
   *
   * - **Synchronous**: Returns `void` when the flush operation completes immediately
   * - **Asynchronous**: Returns a `Promise<void>` that resolves when the flush operation completes
   *
   * @example Handling both sync and async flush
   *
   * ```ts
   * const logger = createSomeLogger();
   * logger.info('Important message');
   *
   * // This approach simple calls the flush without investigating
   * // if it's defined, async or sync
   * await logger?.flush();
   * ```
   *
   * @example Synchronous flush
   *
   * ```ts
   * import { createConsoleLogLogger } from 'emitnlog/logger';
   *
   * const logger = createConsoleLogLogger();
   * logger.info('Buffered message');
   *
   * if (logger.flush) {
   *   logger.flush(); // Synchronous flush
   * }
   * ```
   *
   * @example Asynchronous flush
   *
   * ```ts
   * import { createFileLogger } from 'emitnlog/logger/node';
   *
   * const logger = createFileLogger('app.log');
   * logger.info('Buffered message');
   *
   * if (logger.flush) {
   *   await logger.flush(); // Asynchronous flush
   * }
   * ```
   *
   * @returns Either void for synchronous flush or Promise<void> for asynchronous flush, or undefined if not supported
   */
  readonly flush?: () => void | Promise<void>;

  /**
   * Closes the logger and releases any associated resources.
   *
   * This method is optional and may not be available on all logger implementations. It should be called when the logger
   * is no longer needed to ensure proper cleanup of resources such as file handles, network connections, or other
   * system resources.
   *
   * The method can be either synchronous or asynchronous depending on the underlying implementation:
   *
   * - **Synchronous**: Returns `void` when the close operation completes immediately
   * - **Asynchronous**: Returns a `Promise<void>` that resolves when the close operation completes
   *
   * After calling `close()`, the logger should not be used for further logging operations. Calling `flush()` before
   * `close()` is recommended to ensure all pending log entries are written before cleanup.
   *
   * @example Handling both sync and async close
   *
   * ```ts
   * const logger = createSomeLogger();
   * logger.info('Important message');
   *
   * // This approach simple calls the flush without investigating
   * // if it's defined, async or close
   * await logger?.close();
   * ```
   *
   * @example Synchronous close
   *
   * ```ts
   * import { createConsoleLogLogger } from 'emitnlog/logger';
   *
   * const logger = createConsoleLogLogger();
   * logger.info('Final message');
   *
   * if (logger.close) {
   *   logger.close(); // Synchronous close
   * }
   * ```
   *
   * @example Asynchronous close with file logger
   *
   * ```ts
   * import { createFileLogger } from 'emitnlog/logger/node';
   *
   * const logger = createFileLogger('app.log');
   * logger.info('Final message');
   *
   * if (logger.close) {
   *   await logger.close(); // Asynchronous close
   * }
   * ```
   *
   * @example A shutdown sequence that precisely investigates if the methods are sync or async.
   *
   * ```ts
   * const logger = createSomeLogger();
   * logger.info('Application shutting down');
   *
   * // Flush pending entries before closing
   * if (logger.flush) {
   *   const flushResult = logger.flush();
   *   if (flushResult instanceof Promise) {
   *     await flushResult;
   *   }
   * }
   *
   * // Close and release resources
   * if (logger.close) {
   *   const closeResult = logger.close();
   *   if (closeResult instanceof Promise) {
   *     await closeResult;
   *   }
   * }
   * ```
   *
   * @returns Either void for synchronous close or Promise<void> for asynchronous close, or undefined if not supported
   */
  readonly close?: () => void | Promise<void>;
}
