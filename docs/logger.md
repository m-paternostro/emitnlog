# Logger Documentation

A powerful logger inspired by [RFC5424](https://datatracker.ietf.org/doc/html/rfc5424), supporting both template-literal and traditional logging approaches.

## Table of Contents

- [Log Levels](#log-levels)
- [Log Formats](#log-formats)
- [Template Logging](#template-logging)
- [Traditional Logging](#traditional-logging)
- [Available Loggers](#available-loggers)
- [File Logging (Node.js)](#file-logging-nodejs)
- [Environment-Driven Configuration](#environment-driven-configuration)
- [Tee Logger](#tee-logger)
- [Prefixed Logger](#prefixed-logger)
- [Creating Custom Loggers](#creating-custom-loggers)
- [Advanced Features](#advanced-features)

## Log Levels

Defines the minimum level of the log entries that are emitted.

```
trace     - Extremely detailed debugging information
debug     - Diagnostic messages
info      - General informational messages (default)
notice    - Normal but significant events
warning   - Warning conditions
error     - Error conditions
critical  - System component failure
alert     - Action must be taken now
emergency - System is unusable
```

## Log Formats

Defines the format used to emit a log entry.

```
plain            - One plain text line per entry, no styling.
colorful         - ANSI-colored line, ideal for dev terminals.
json             - One structured JSON line per entry.
unformatted-json - Compact JSON line, raw and delimiter-safe.
```

## Template Logging

Template logging uses tagged template literals for a clean, readable syntax with automatic lazy evaluation.

```ts
import { createConsoleLogLogger } from 'emitnlog/logger';

// Defaults to 'info' level
const logger = createConsoleLogLogger();

// Simple message
logger.i`Server started on port 3000`;

// Using template values
const userId = 'user123';
logger.i`User ${userId} logged in successfully`;

// With error handling
const error = new Error('Connection lost');
logger.args(error).e`Something went wrong: ${error}`;

// Complex objects are handled automatically
const data = { id: 123, items: ['a', 'b', 'c'], timestamp: new Date() };
logger.d`Request data: ${data}`;
```

### Lazy Evaluation

Template logging uses lazy evaluation - values are only computed when the log level matches:

```ts
import { createConsoleLogLogger } from 'emitnlog/logger';

// Logger initialized to the `warning` level
const logger = createConsoleLogLogger('warning');

// This expensive calculation isn't executed because debug < warning
logger.d`Complex calculation: ${() => performExpensiveOperation()}`;

// This will be executed because error > warning
logger.e`Application error: ${() => generateErrorReport()}`;
```

### Template Methods

All loggers support these template methods:

```ts
logger.t`trace message`; // trace level
logger.d`debug message`; // debug level
logger.i`info message`; // info level
logger.n`notice message`; // notice level
logger.w`warning message`; // warning level
logger.e`error message`; // error level
logger.c`critical message`; // critical level
logger.a`alert message`; // alert level
logger.em`emergency message`; // emergency level
```

## Traditional Logging

For those who prefer the traditional approach:

```ts
import { createConsoleErrorLogger } from 'emitnlog/logger';

const logger = createConsoleErrorLogger('debug');

// Simple static message
logger.info('Server started on port 3000');

// With arguments
const userId = 'user123';
logger.info(`User ${userId} logged in successfully`);

// With error handling
const error = new Error('Connection lost');
logger.error('Something went wrong', error);

// With lazy evaluation
logger.debug(() => `Expensive operation result: ${computeExpensiveValue()}`);
```

### Traditional Methods

All loggers support these traditional methods:

```ts
logger.trace('message', ...args);
logger.debug('message', ...args);
logger.info('message', ...args);
logger.notice('message', ...args);
logger.warning('message', ...args);
logger.error('message', ...args);
logger.critical('message', ...args);
logger.alert('message', ...args);
logger.emergency('message', ...args);
```

## Available Loggers

All loggers implement the same interface, making them interchangeable. Use factory functions to create logger instances:

### Console Log Logger

Logs to console (stdout) with intelligent routing and color formatting.

```ts
import { createConsoleLogLogger } from 'emitnlog/logger';

// All logs go to console.log
const logger = createConsoleLogLogger('info', 'colorful');
logger.i`Server started on port 3000`;
```

### Console Error Logger

Logs to stderr with color formatting enabled by default.

```ts
import { createConsoleErrorLogger } from 'emitnlog/logger';

// All logs go to console.error
const logger = createConsoleErrorLogger('error');
logger.e`Database connection failed`;
```

### Console By Level Logger

Automatically routes logs based on severity - lower levels to console.log, higher levels to console.error.

```ts
import { createConsoleByLevelLogger } from 'emitnlog/logger';

const logger = createConsoleByLevelLogger('info', 'colorful');
logger.i`Info message`; // -> console.log
logger.w`Warning message`; // -> console.error
logger.e`Error message`; // -> console.error
```

### OFF_LOGGER

Discards all logs (useful for testing or quickly silencing code).

```ts
import { OFF_LOGGER } from 'emitnlog/logger';

// All log calls are ignored
OFF_LOGGER.i`This won't appear anywhere`;
```

The `withLogger` utility uses the `OFF_LOGGER` to ensure the code is handling a defined logger.

```ts
import type { Logger } from 'emitnlog/logger';
import { withLogger } from 'emitnlog/logger';

export const compute = ({ logger?: Logger }) => {
  // computeLogger is guaranteed to be defined
  const computeLogger = withLogger(logger);
}
```

## File Logging (Node.js)

For persistent logging in Node.js environments:

```ts
import { createFileLogger } from 'emitnlog/logger/node';

// Simple file logger
const logger = createFileLogger('app.log', 'debug');
logger.i`Application started at ${new Date()}`;

// With custom format
const jsonLogger = createFileLogger('/var/log/my-app.log', 'warning', 'json-compact');
jsonLogger.e`Database connection error: ${new Error('Connection timeout')}`;
```

### File Logger Factory Function

```ts
createFileLogger(
  filePath: string,
  level?: LogLevel,
  format?: LogFormat,
  options?: BaseLoggerOptions
): Logger
```

## Environment-Driven Configuration

Configure logging behavior through environment variables for easy deployment-time adjustments without code changes.

> **Note:** Supported on Node.js or on runtimes where `process.env` exposes the environment variables.

```ts
import { fromEnv } from 'emitnlog/logger/environment';

// Creates logger based on environment variables
const logger = fromEnv();

logger.i`Application started`;
```

### Environment Variables

Configure your logger with these environment variables:

```bash
# Logger type (required)
EMITNLOG_LOGGER=console                # Use ConsoleLogger
EMITNLOG_LOGGER=console-error          # Use ConsoleErrorLogger
EMITNLOG_LOGGER=file:/var/log/app.log  # Use FileLogger with specified path (Node.js only)

# Log level (optional)
EMITNLOG_LEVEL=debug                   # Set minimum log level

# Output format (optional)
EMITNLOG_FORMAT=colorful               # Use colored output
```

### Fallback Configuration

Provide defaults and fallback behavior when environment variables aren't set:

```ts
import { createConsoleLogLogger } from 'emitnlog/logger';
import { fromEnv } from 'emitnlog/logger/environment';

// With fallback options
const logger = fromEnv({
  level: 'info', // Default level if EMITNLOG_LEVEL not set
  format: 'unformatted-json', // Default format if EMITNLOG_FORMAT not set
  fallbackLogger: () => createConsoleLogLogger(),
});

// For development vs production
const logger = fromEnv({
  level: 'debug',
  fallbackLogger: (level, format) => {
    // In development, default to console logging
    if (process.env.NODE_ENV === 'development') {
      return createConsoleLogLogger(level, format);
    }
    // In production, require explicit configuration
    return undefined; // Returns OFF_LOGGER
  },
});
```

### Choosing the Right `fromEnv` Import

There are three available `fromEnv` variants, depending on your runtime or preferences:

```ts
import { fromEnv } from 'emitnlog/logger/environment'; // dynamic resolution (recommended)
import { fromEnv } from 'emitnlog/logger'; // neutral-only (browser-safe)
import { fromEnv } from 'emitnlog/logger/node'; // Node-only (file support)
```

- The first form (`/logger/environment`) uses conditional exports to automatically select the correct logger at runtime: it supports file logging in Node.js, and gracefully disables it in browser-safe builds. This is the recommended option for most users.

- The second form (`/logger`) is always neutral and safe to use in any environment — but does not support file loggers.

- The third form (`/logger/node`) gives you full control of Node-only features like FileLogger, and should only be used when you're explicitly targeting Node.

### Environment Configuration Example

A typical application setup that adapts to different environments:

```bash
# Development (.env.development)
EMITNLOG_LOGGER=console
EMITNLOG_LEVEL=debug
EMITNLOG_FORMAT=colorful

# Production (.env.production)
EMITNLOG_LOGGER=file:/var/log/app.log
EMITNLOG_LEVEL=warning
EMITNLOG_FORMAT=json

# Testing (.env.test)
EMITNLOG_LOGGER=console-error
EMITNLOG_LEVEL=error
EMITNLOG_FORMAT=plain
```

```ts
// app.ts - Works in all environments
import { fromEnv } from 'emitnlog/logger/environment';

const logger = fromEnv({
  level: 'info', // Reasonable default
  format: 'colorful', // Good for development
});

logger.i`Server starting on port ${process.env.PORT || 3000}`;
logger.w`Database connection retrying...`;
logger.e`Failed to connect to external service: ${error}`;
```

## Tee Logger

Log to multiple destinations simultaneously:

```ts
import { tee, createConsoleLogLogger } from 'emitnlog/logger';
import { createFileLogger } from 'emitnlog/logger/node';

// Create individual loggers
const consoleLogger = createConsoleLogLogger('info');
const fileLogger = createFileLogger('/var/log/app.log');

// Combine them with tee
const logger = tee(consoleLogger, fileLogger);

// Log messages go to both console and file
logger.i`Server started successfully`;
logger.args({ requestId: '12345' }).e`Database query failed: ${new Error('Timeout')}`;
```

### Tee with Different Levels

Each logger in a tee can have different levels:

```ts
import { tee, createConsoleLogLogger } from 'emitnlog/logger';
import { createFileLogger } from 'emitnlog/logger/node';

// Console shows everything, file only shows warnings and above
const logger = tee(createConsoleLogLogger('debug'), createFileLogger('/var/log/app.log', 'warning'));

logger.d`Debug info`; // Only appears in console
logger.w`Warning message`; // Appears in both console and file
```

## Prefixed Logger

Categorize and organize your logs by adding fixed prefixes to any logger:

```ts
import { createConsoleLogLogger, withPrefix } from 'emitnlog/logger';

const logger = createConsoleLogLogger();

// Create a prefixed logger for a component
const dbLogger = withPrefix(logger, 'DB');
dbLogger.i`Connected to database`; // Logs: "DB: Connected to database"

// Create nested prefixes for hierarchical logging
const userDbLogger = withPrefix(dbLogger, 'users');
userDbLogger.w`User not found: ${userId}`; // Logs: "DB.users: User not found: 123"

// Hover over these in your IDE to see their full prefixes!
// Type of dbLogger: PrefixedLogger<'DB'>
// Type of userDbLogger: PrefixedLogger<'DB.users'>

// Errors maintain their original objects
const error = new Error('Connection failed');
dbLogger.error(error); // Logs the prefixed message while preserving the error object

// Works with all log levels and methods
dbLogger.d`Query executed in ${queryTime}ms`;
```

### Building Prefix Hierarchies

For more complex applications, you can build sophisticated prefix hierarchies:

```ts
import { createConsoleLogLogger, appendPrefix, resetPrefix, withPrefix } from 'emitnlog/logger';

const logger = createConsoleLogLogger();

// Start with a base logger
const appLogger = withPrefix(logger, 'APP');
const serviceLogger = appendPrefix(appLogger, 'UserService');
const repoLogger = appendPrefix(serviceLogger, 'Repository');

repoLogger.i`User data saved`; // Logs: "APP.UserService.Repository: User data saved"

// Switch contexts while preserving the root logger
const apiLogger = resetPrefix(repoLogger, 'API');
const v1Logger = appendPrefix(apiLogger, 'v1');

v1Logger.i`Request processed`; // Logs: "API.v1: Request processed"

// Custom separators for different naming conventions
const moduleLogger = withPrefix(logger, 'Auth', { prefixSeparator: '/', messageSeparator: ' >> ' });
const tokenLogger = appendPrefix(moduleLogger, 'Token');

tokenLogger.i`Token validated`; // Logs: "Auth/Token >> Token validated"
```

### Prefix Functions

- **`withPrefix(logger, prefix)`** - Creates a new prefixed logger or extends an existing prefix chain
- **`appendPrefix(prefixedLogger, suffix)`** - Utility to append a prefix to an existing prefixed logger
- **`resetPrefix(logger, newPrefix)`** - Utility to replace any existing prefix with a completely new one

### Prefix Options

```ts
interface PrefixOptions {
  prefixSeparator?: string; // Default: '.'
  messageSeparator?: string; // Default: ': '
}
```

## Creating Custom Loggers

### Emitter Logger

You can create your own custom logging destinations by implementing a LogSink and using the `emitter.createLogger` function:

```ts
import type { LogLevel } from 'emitnlog/logger';
import { emitter } from 'emitnlog/logger';

// Custom sink that writes logs to a database
const databaseSink = (dbConnection: any): emitter.LogSink => {
  return {
    sink: (level: LogLevel, message: string, args: readonly unknown[]) => {
      // Write log entry to the database
      dbConnection.insert({
        timestamp: new Date().toISOString(),
        level,
        message,
        args: args.length > 0 ? args : undefined,
      });
    },
    close: async (): Promise<void> => {
      // Close the database connection
      await dbConnection.close();
    },
  };
};

// Create a logger using the database sink
const logger = emitter.createLogger('info', databaseSink(myDatabaseConnection));
logger.i`Application started`;

// Add batching to the database sink
const batchedLogger = emitter.createLogger(
  'info',
  batchSink(databaseSink(myDatabaseConnection), { maxBufferSize: 50, flushDelayMs: 2000 }),
);
batchedLogger.i`Application started with batching`;
```

### Available Formatters

You can use built-in formatters to format log messages before sending them to your custom sink:

```ts
import { emitter } from 'emitnlog/logger';

// Available formatters
const formatters = {
  plain: emitter.plainFormatter,
  colorful: emitter.colorfulFormatter,
  jsonCompact: emitter.jsonCompactFormatter,
  jsonPretty: emitter.jsonPrettyFormatter,
  basic: emitter.basicFormatter,
};

// Use a formatter in your custom sink
const formattedSink = (formatter: emitter.LogFormatter): emitter.LogSink => ({
  sink: (level: LogLevel, message: string, args: readonly unknown[]) => {
    const formattedLine = formatter(level, message, args);
    // Send formatted line to your destination
    sendToCustomDestination(formattedLine);
  },
});
```

### Advanced Custom Sink with Lifecycle Methods

```ts
import type { LogLevel } from 'emitnlog/logger';
import { emitter } from 'emitnlog/logger';
import type { Timeout } from 'emitnlog/utils';

// Custom sink with batching and resource management
const batchingSink = (endpoint: string): emitter.LogSink => {
  let buffer: Array<{ level: LogLevel; message: string; args: readonly unknown[] }> = [];
  let flushTimeout: Timeout | undefined;

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;

    const entries = buffer.splice(0); // Clear buffer
    const payload = entries.map((entry) => ({
      timestamp: new Date().toISOString(),
      level: entry.level,
      message: entry.message,
      args: entry.args.length > 0 ? entry.args : undefined,
    }));

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to send logs:', error);
      // Could re-add to buffer or implement retry logic
    }
  };

  return {
    sink: (level: LogLevel, message: string, args: readonly unknown[]) => {
      buffer.push({ level, message, args });

      // Auto-flush after 10 entries or 5 seconds
      if (buffer.length >= 10) {
        void flush();
      } else if (!flushTimeout) {
        flushTimeout = setTimeout(() => {
          flushTimeout = undefined;
          void flush();
        }, 5000);
      }
    },
    flush: async (): Promise<void> => {
      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = undefined;
      }
      await flush();
    },
    close: async (): Promise<void> => {
      await flush(); // Flush remaining entries before closing
    },
  };
};

// Create logger with lifecycle management
const logger = emitter.createLogger('info', batchingSink('https://logs.example.com/api'));

// Use the logger
logger.i`Application event occurred`;

// Properly shut down
if (logger.flush) {
  await logger.flush();
}
if (logger.close) {
  await logger.close();
}
```

### Base Logger

You can also create your own logger by extending `BaseLogger`:

```ts
import type { LogLevel } from 'emitnlog/logger';
import { emitter, implementation } from 'emitnlog/logger';

class MyCustomLogger extends implementation.BaseLogger {
  protected override emit(level: LogLevel, message: string, args: readonly unknown[]): void {
    // Send the log information to a remote logging service
    myLoggingService.send(emitter.asLogEntry(level, message, args));
  }
}
```

## Advanced Features

### Additional Arguments

Add extra context to any log entry:

```ts
import { createConsoleLogLogger } from 'emitnlog/logger';

const logger = createConsoleLogLogger();

// Add structured data
logger.args({ userId: 123, requestId: 'req-456' }).i`User authenticated`;

// Chain multiple args calls
logger.args({ traceId: 'trace-789' }).args({ component: 'auth' }).i`Authentication successful`;
```

### Level-based Filtering

Loggers respect the configured level and only emit messages at or above that level:

```ts
import { createConsoleLogLogger } from 'emitnlog/logger';

const logger = createConsoleLogLogger('warning');

logger.d`This debug message won't appear`;
logger.i`This info message won't appear`;
logger.w`This warning message will appear`;
logger.e`This error message will appear`;
```

### Dynamic Level Support

The logger architecture supports dynamic levels through functions:

```ts
import { emitter } from 'emitnlog/logger';

// Dynamic level based on environment variable or runtime condition
let currentLevel: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

const logger = emitter.createLogger(
  () => currentLevel, // Function that returns current level
  emitter.consoleLogSink(emitter.colorfulFormatter),
);

// Change level at runtime
currentLevel = 'warning';

logger.d`This won't appear (debug < warning)`;
logger.w`This will appear (warning >= warning)`;
```
