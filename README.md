[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/m-paternostro/emitnlog/blob/main/LICENSE)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/m-paternostro/emitnlog)](https://github.com/m-paternostro/emitnlog/releases)
[![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?logo=npm&logoColor=white)](https://www.npmjs.com/package/emitnlog)
[![Version](https://img.shields.io/github/package-json/v/m-paternostro/emitnlog)](https://github.com/m-paternostro/emitnlog/blob/main/package.json)
[![CI](https://github.com/m-paternostro/emitnlog/actions/workflows/ci.yaml/badge.svg)](https://github.com/m-paternostro/emitnlog/actions/workflows/ci.yaml)
[![Coverage](https://m-paternostro.github.io/emitnlog/coverage/coverage-badge.svg)](https://m-paternostro.github.io/emitnlog/coverage/)

# Emit n' Log

A modern, type-safe library for logging and event notifications in JavaScript/TypeScript apps.

Practical utilities for modern projects:

- Clear logs with structured data and lazy evaluation
- Lightweight observables without full-blown streams
- Zero dependencies
- Built with TypeScript from the ground up with precise types and full type inference, while remaining lightweight and fully functional in JavaScript environments.

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Logger](#logger)
- [Event Notifier](#event-notifier)
- [Logger + Notifier Combined](#logger--notifier-combined)
- [Utilities](#utilities)

## Installation

```bash
npm install emitnlog
```

## Features

- **Flexible Logger** with 9 severity levels and template literal magic
- **Type-safe Event Notifier** to broadcast events only when someone's listening
- **Lazy Evaluation** – compute messages and events only when needed
- **Multiple Logger Targets** – console, stderr, file, or no-op
- **Tiny Footprint** – no runtime bloat

## Logger

A powerful logger inspired by [RFC5424](https://datatracker.ietf.org/doc/html/rfc5424), supporting both template-literal and traditional logging.

### Log Levels

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

### Log Formats

Defines the format used to emit a log entry.

```
plain            - One plain text line per entry, no styling.
colorful         - ANSI-colored line, ideal for dev terminals.
json             - One structured JSON line per entry.
unformatted-json - Compact JSON line, raw and delimiter-safe.
```

### Template Logging

```ts
import { ConsoleLogger } from 'emitnlog/logger';

// Defaults to 'info'
const logger = new ConsoleLogger();

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

#### Lazy Evaluation

Template logging uses lazy evaluation - values are only computed when the log level matches:

```ts
import { ConsoleLogger } from 'emitnlog/logger';

// Loggers initialized to the `warning` level
const logger = new ConsoleLogger('warning');

// This expensive calculation isn't executed because debug < warning
logger.d`Complex calculation: ${() => performExpensiveOperation()}`;

// This will be executed because error > warning
logger.e`Application error: ${() => generateErrorReport()}`;
```

### Traditional Logging

For those who prefer the traditional approach:

```ts
import { ConsoleErrorLogger } from 'emitnlog/logger';

const logger = new ConsoleErrorLogger('debug');

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

### File Logging (Node.js only)

For persistent logging in Node.js environments:

```ts
import { FileLogger } from 'emitnlog/logger/node';

// Simple file logger (writes to OS temp directory if path is relative)
const logger = new FileLogger('app.log', 'debug');
logger.i`Application started at ${new Date()}`;

// Advanced configuration
const configuredLogger = new FileLogger({
  filePath: '/var/log/my-app.log', // Absolute path
  level: 'warning', // Only warning and above
  keepAnsiColors: true, // Preserve colors in log file
  omitArgs: false, // Include additional arguments
  errorHandler: (err) => console.error('Logging error:', err),
});
configuredLogger.e`Database connection error: ${new Error('Connection timeout')}`;
```

### Available Loggers

All loggers implement the same interface, making them interchangeable:

- `ConsoleLogger`: Logs to console (stdout) with color formatting enabled by default
- `ConsoleErrorLogger`: Logs to stderr with color formatting enabled by default
- `FileLogger`: Logs to a file with optional configuration (Node.js only)
- `OFF_LOGGER`: Discards all logs (useful for testing or quickly silencing the code)

### Tee Logger

Log to multiple destinations simultaneously:

```ts
import { tee, ConsoleLogger } from 'emitnlog/logger';
import { FileLogger } from 'emitnlog/logger/node';

// Create individual loggers
const consoleLogger = new ConsoleLogger('info');
const fileLogger = new FileLogger('/var/log/app.log');

// Combine them with tee
const logger = tee(consoleLogger, fileLogger);

// Log messages go to both console and file
logger.i`Server started successfully`;
logger.args({ requestId: '12345' }).e`Database query failed: ${new Error('Timeout')}`;
```

### Environment-Driven Configuration

Configure logging behavior through environment variables for easy deployment-time adjustments without code changes:

> **Note:** Supported on Node.js or on runtimes where `process.env` exposes the environment variables.

```ts
import { fromEnv } from 'emitnlog/logger';

// Creates logger based on environment variables
const logger = fromEnv();

logger.i`Application started`;
```

#### Environment Variables

Configure your logger with these environment variables:

```bash
# Logger type (required)
EMITNLOG_LOGGER=console                # Use ConsoleLogger
EMITNLOG_LOGGER=console-error          # Use ConsoleErrorLogger
EMITNLOG_LOGGER=file:/var/log/app.log  # Use FileLogger with specified path

# Log level (optional)
EMITNLOG_LEVEL=debug                   # Set minimum log level

# Output format (optional)
EMITNLOG_FORMAT=colorful               # Use colored output
```

#### Fallback Configuration

Provide defaults and fallback behavior when environment variables aren't set:

```ts
import { fromEnv, ConsoleLogger } from 'emitnlog/logger';

// With fallback options
const logger = fromEnv({
  level: 'info', // Default level if EMITNLOG_LEVEL not set
  format: 'unformatted-json', // Default format if EMITNLOG_FORMAT not set
  fallbackLogger: () => new ConsoleLogger(),
});

// For development vs production
const logger = fromEnv({
  level: 'debug',
  fallbackLogger: (level, format) => {
    // In development, default to console logging
    if (process.env.NODE_ENV === 'development') {
      return new ConsoleLogger(level, format);
    }
    // In production, require explicit configuration
    return undefined; // Returns OFF_LOGGER
  },
});
```

#### Example

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
import { fromEnv } from 'emitnlog/logger';

const logger = fromEnv({
  level: 'info', // Reasonable default
  format: 'colorful', // Good for development
});

logger.i`Server starting on port ${process.env.PORT || 3000}`;
logger.w`Database connection retrying...`;
logger.e`Failed to connect to external service: ${error}`;
```

### Creating Custom Loggers

You can create your own logger by extending `BaseLogger`:

```ts
import type { LogLevel } from 'emitnlog/logger';
import { BaseLogger, emitLine, emitColorfulLine } from 'emitnlog/logger';

class MyCustomLogger extends BaseLogger {
  protected override emitLine(level: LogLevel, message: string, args: readonly unknown[]): void {
    // Format the log entry using the formatter utilities
    const line = emitColorfulLine(level, message);

    // Do something with the formatted line and args
    // e.g., send to a remote logging service
    myLoggingService.send({ line, args });
  }
}
```

### Prefixed Logger

Categorize and organize your logs by adding fixed prefixes to any logger:

```ts
import { ConsoleLogger, withPrefix } from 'emitnlog/logger';

const logger = new ConsoleLogger();

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

#### Building Prefix Hierarchies

For more complex applications, you can build sophisticated prefix hierarchies:

```ts
import { ConsoleLogger, withPrefix, appendPrefix, resetPrefix } from 'emitnlog/logger';

const logger = new ConsoleLogger();

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

**Key Functions:**

- `withPrefix(logger, prefix)` - Creates a new prefixed logger or extends an existing prefix chain
- `appendPrefix(prefixedLogger, suffix)` - Utility to append a prefix to an existing prefixed logger
- `resetPrefix(logger, newPrefix)` - Utility to replace any existing prefix with a completely new one

## Event Notifier

A simple way to implement observable patterns. Listeners only get notified when something happens — and only if they're subscribed.

### Basic Usage

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<string>();

const subscription = notifier.onEvent((msg) => {
  console.log(`Received: ${msg}`);
});

notifier.notify('Hello!');
subscription.close();
```

### Lazy Notifications

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<string>();

// No listeners yet, this won't execute the function
notifier.notify(() => {
  console.log('This is never executed because no listeners');
  return 'Hello world';
});

// Now add a listener
const subscription = notifier.onEvent((message) => console.log(message));

// This will execute the function since we have a listener
notifier.notify(() => {
  console.log('This runs only when someone is listening');
  return 'Hello again!';
});

// Clean up
subscription.close();
```

### Promise-based Event Waiting

Use `waitForEvent()` to get a Promise that resolves when the next event occurs, without interfering with subscribed listeners.

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<string>();

// Somewhere in an async function
async function handleNextEvent() {
  // This will wait until the next event is notified
  const eventData = await notifier.waitForEvent();
  console.log(`Received event: ${eventData}`);
}

// Wait for multiple events sequentially
async function handleMultipleEvents() {
  // These will wait for two separate events in sequence
  const first = await notifier.waitForEvent();
  const second = await notifier.waitForEvent();
  console.log(`Got two events: ${first}, ${second}`);
}

// Caution: This doesn't wait for two separate events!
// Both promises resolve with the same event
async function incorrectUsage() {
  const [event1, event2] = await Promise.all([notifier.waitForEvent(), notifier.waitForEvent()]);
  // event1 and event2 will be identical
}
```

## Logger + Notifier Combined

Here's an example that uses both the logger and the event notifier:

```ts
import type { OnEvent } from 'emitnlog/notifier';
import { createEventNotifier } from 'emitnlog/notifier';
import { ConsoleLogger } from 'emitnlog/logger';

type Progress = { filename: string; percent: number };

interface Uploader {
  onProgress: OnEvent<Progress>;
  upload(filename: string): void;
}

class FileUploader implements Uploader {
  private _logger = new ConsoleLogger('debug');
  private _notifier = createEventNotifier<Progress>();
  public onProgress = this._notifier.onEvent;

  public upload(filename: string) {
    this._logger.i`Starting upload of ${filename}`;

    for (let i = 0; i <= 100; i += 25) {
      this._notifier.notify(() => ({ filename, percent: i }));
      this._logger.d`Progress for ${filename}: ${i}%`;
    }

    this._logger.i`Finished upload of ${filename}`;
  }
}

const uploader = new FileUploader();

const subscription = uploader.onProgress(({ filename, percent }) => {
  // your UI/render function
  renderProgress(filename, percent);
});

uploader.upload('video.mp4');
subscription.close();
```

## Invocation Tracker

The invocation tracker is a focused utility for monitoring function calls — it emits detailed lifecycle events, optionally logs invocation details, and supports metadata tagging. It builds on top of the core emit/log foundation, offering structured observability without requiring external tracing systems or heavy instrumentation. It is also a great example of how to use this library!

You can use the invocation tracker to track any function, and even entire objects or class instances as shown below.

### Basic usage

```ts
import { createInvocationTracker } from 'emitnlog/tracker';

const tracker = createInvocationTracker({ tags: [{ service: 'auth' }] });

tracker.onCompleted((invocation) => {
  appLogger.i`✔ ${invocation.key.operation} completed in ${invocation.duration}ms`;
  updateUI(invocation.args[0]);
});

const login = tracker.track('login', (user) => {
  doLogin(user);
});

login('Cayde');
```

### Async and nested tracking

The tracker automatically handles both sync and async functions, and can maintain parent-child invocation relationships:

```ts
import { createInvocationTracker } from 'emitnlog/tracker';
import { exhaustiveCheck } from 'emitnlog/utils';

// Creates a tracker for two specific operations.
const tracker = createInvocationTracker<'saveUser' | 'createUser'>();

tracker.onInvoked((invocation) => {
  const operation = invocation.key.operation;
  switch (operation) {
    case 'saveUser':
      if (invocation.phase === 'completed' && invocation.parentKey?.operation === 'createUser') {
        void loadNewUserProfile();
      }
      break;

    case 'createUser':
      if (invocation.phase === 'errored') {
        void handleUserCreationError(invocation.error);
      }
      break;

    default:
      exhaustiveCheck(operation);
  }
});

const saveUser = tracker.track('saveUser', async (user) => {
  await db.insert(user);
});

const createUser = tracker.track('createUser', async (user) => {
  await saveUser(user);
});
```

### Tracking methods on objects and classes

You can use `trackMethods` to automatically wrap all (or specific) methods on an object or class instance:

```ts
import { trackMethods } from 'emitnlog/tracker';

const math = {
  add(a, b) {
    return a + b;
  },

  subtract(a, b) {
    return a - b;
  },
};

trackMethods(tracker, math); // wraps all methods
math.add(1, 2); // tracked!
```

### Tracking class instances

```ts
import { trackMethods } from 'emitnlog/tracker';

class UserService {
  createUser(name) {
    return { id: 1, name };
  }

  deleteUser(id) {
    return true;
  }
}

const service = new UserService();

trackMethods(tracker, service, {
  methods: ['createUser', 'deleteUser'], // optional: only track these
});
```

The methods are wrapped in-place and preserve their `this` context. You can also use this with inherited methods or mixins.

### Advanced use

Consult the code documentation to see how you can:

- Pass tags per operation to enrich events
- Inject a custom stack to control parent-child relationship tracking (useful for advanced tracing or test isolation)
- Track method names automatically (excluding constructor and built-ins by default)

## Utilities

A set of helpful utilities used internally but also available for direct use:

### stringify

Safe and flexible value stringification for logging:

```ts
import { stringify } from 'emitnlog/utils';

// Basic usage
stringify('hello'); // 'hello'
stringify(123); // '123'
stringify(new Date()); // '2023-04-21 12:30:45.678'

// Objects with custom options
const data = {
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ],
};
stringify(data); // compact JSON
stringify(data, { pretty: true }); // pretty-printed JSON

// Error handling
const error = new Error('Something went wrong');
stringify(error); // 'Something went wrong'
stringify(error, { includeStack: true }); // includes stack trace

// Date formatting options
const now = new Date();
stringify(now); // '2023-04-21 12:30:45.678' (ISO format without timezone)
stringify(now, { useLocale: true }); // e.g., '4/21/2023, 12:30:45 PM' (depends on user's locale)

// Handles circular references
const circular = { name: 'circular' };
circular.self = circular;
stringify(circular); // safely handles the circular reference
```

The `stringify` utility never throws, making it safe for all logging contexts.

### errorify

Convert any value to an Error object:

```ts
import { errorify } from 'emitnlog/utils';

// Convert string to Error
const error = errorify('Something went wrong');

// Preserve existing Error objects
const originalError = new Error('Original error');
const sameError = errorify(originalError); // Returns the original Error
```

### exhaustiveCheck

TypeScript utility for exhaustive switch statements:

```ts
import { exhaustiveCheck } from 'emitnlog/utils';

type Status = 'pending' | 'success' | 'error';

function handleStatus(status: Status): string {
  switch (status) {
    case 'pending':
      return 'Loading...';
    case 'success':
      return 'Operation completed';
    case 'error':
      return 'An error occurred';
    default:
      // Compile-time error if we missed a case
      return exhaustiveCheck(status);
  }
}
```

### isNotNullable

Type guard for filtering out `null` and `undefined` values:

```ts
import { isNotNullable } from 'emitnlog/utils';

const values: Array<string | null | undefined> = ['a', null, 'b', undefined, 'c'];
const filtered: string[] = values.filter(isNotNullable);

console.log(filtered); // ['a', 'b', 'c']
```

Useful when working with APIs that return possibly nullable values, or when narrowing types for safe usage.

### delay

Waits for a specified duration before continuing:

```ts
import { delay } from 'emitnlog/utils';

await delay(500); // wait 500ms
console.log('This logs after half a second');
```

Often useful in cooldowns, stabilization intervals, and tests.

### withTimeout

Wraps a promise to enforce a timeout, optionally falling back to a value:

```ts
import { withTimeout } from 'emitnlog/utils';

const fetchCompleted = (): Promise<boolean> => {...};
const result1: boolean | undefined = await withTimeout(fetchCompleted(), 1000);
const result2: boolean | 'timeout' = await withTimeout(fetchCompleted(), 1000, 'timeout');
```

Returns the original promise result if it resolves in time, otherwise returns the fallback. Helpful for safe async handling in flaky environments.

### createDeferredValue

Creates a promise that can be resolved or rejected later:

```ts
import { createDeferredValue } from 'emitnlog/utils';

const deferred = createDeferredValue<string>();

setTimeout(() => deferred.resolve('done'), 1000);
const result = await deferred.promise;
console.log(result); // 'done'
```

Useful for coordinating async operations manually, like event-driven triggers or testing deferred resolution.

### startPolling

Continuously runs an operation at intervals until stopped or a condition is met:

```ts
import { startPolling } from 'emitnlog/utils';

const { wait, close } = startPolling(fetchStatus, 1000, { interrupt: (result) => result === 'done', timeout: 10_000 });

const final = await wait;
```

Polling stops automatically on timeout or interrupt. Call `close()` to stop early. Works with sync or async functions and handles exceptions safely.

## API Docs

See source JSDoc for full types and examples.

## License

MIT
