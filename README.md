[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/m-paternostro/emitnlog/blob/main/LICENSE)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/m-paternostro/emitnlog)](https://github.com/m-paternostro/emitnlog/releases)
[![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?logo=npm&logoColor=white)](https://www.npmjs.com/package/emitnlog)
[![Version](https://img.shields.io/github/package-json/v/m-paternostro/emitnlog)](https://github.com/m-paternostro/emitnlog/blob/main/package.json)
[![CI](https://github.com/m-paternostro/emitnlog/actions/workflows/ci.yaml/badge.svg)](https://github.com/m-paternostro/emitnlog/actions/workflows/ci.yaml)

# 🚦 Emit n' Log

A modern, type-safe library for logging and event notifications in JavaScript/TypeScript apps.

Practical utilities for modern TypeScript projects:

- 🧪 Clear logs with structured data and lazy evaluation
- 🧩 Lightweight observables without full-blown streams
- 🛠 Zero dependencies

---

## 🗺 Table of Contents

- [Installation](#-installation)
- [Features](#-features)
- [Logger](#-logger)
- [Event Notifier](#-event-notifier)
- [Logger + Notifier Combined](#-logger--notifier-combined)
- [Utilities](#-utilities)

---

## 🛠 Installation

```bash
npm install emitnlog
```

---

## ✨ Features

- 📢 **Flexible Logger** with 9 severity levels and template literal magic
- 🔔 **Type-safe Event Notifier** to broadcast events only when someone's listening
- 🧵 **Lazy Evaluation** – compute messages and events only when needed
- 💾 **Multiple Logger Targets** – console, stderr, file, or no-op
- 📦 **Tiny Footprint** – no runtime bloat

---

## 📋 Logger

A powerful logger inspired by [RFC5424](https://datatracker.ietf.org/doc/html/rfc5424), supporting both template-literal and traditional logging.

### Log Levels

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

const logger = new ConsoleLogger();

// This expensive calculation isn't executed because debug < info
logger.d`Complex calculation: ${() => performExpensiveOperation()}`;

// This will be executed because error > info
logger.e`Application error: ${() => generateErrorReport()}`;
```

### Traditional Logging

For those who prefer the traditional approach:

```ts
import { ConsoleLogger } from 'emitnlog/logger';

const logger = new ConsoleLogger('debug');

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
const logger = new FileLogger('app.log');
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

### Available Loggers

All loggers implement the same interface, making them interchangeable:

- `ConsoleLogger`: Logs to console (stdout) with color formatting enabled by default
- `ConsoleErrorLogger`: Logs to stderr with color formatting enabled by default
- `OFF_LOGGER`: Discards all logs (useful for testing or quickly silencing the code)
- `FileLogger`: Logs to a file with optional configuration (Node.js only)

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

---

## 🔔 Event Notifier

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

---

## 🧩 Logger + Notifier Combined

Here's an example that uses both the logger and the event notifier:

```ts
import { createEventNotifier } from 'emitnlog/notifier';
import { ConsoleLogger } from 'emitnlog/logger';

type Progress = { filename: string; percent: number };

class FileUploader {
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

## 🔧 Utilities

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

---

## 📘 API Docs

See source JSDoc for full types and examples.

---

## 📄 License

MIT
