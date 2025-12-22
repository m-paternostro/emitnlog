[![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?logo=npm&logoColor=white)](https://www.npmjs.com/package/emitnlog)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/m-paternostro/emitnlog)](https://github.com/m-paternostro/emitnlog/releases)
[![CI](https://github.com/m-paternostro/emitnlog/actions/workflows/ci.yaml/badge.svg)](https://github.com/m-paternostro/emitnlog/actions/workflows/ci.yaml)
[![Coverage](https://m-paternostro.github.io/emitnlog/coverage/coverage-badge.svg)](https://m-paternostro.github.io/emitnlog/coverage/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/m-paternostro/emitnlog/blob/main/LICENSE)

# Emit n' Log

A modern, type-safe library for logging, event notifications, and observability in JavaScript/TypeScript apps.

**Perfect for modern projects that need:**

- Clear, structured logging with lazy evaluation
- Lightweight event notifications without heavy observable libraries
- Function call tracking with detailed lifecycle events
- Promise coordination, deduplication, and caching
- Zero dependencies with full TypeScript support
- ESM and CJS supported

## Quick Start

```bash
npm install emitnlog
```

### Logger

Clean, template-literal logging with multiple output formats and lazy evaluation:

```ts
import { createConsoleLogLogger } from 'emitnlog/logger';

const logger = createConsoleLogLogger();

// Template logging with lazy evaluation
const userId = 'user123';
logger.i`User ${userId} logged in successfully`;

// Only computed when log level matches
logger.d`Expensive calculation: ${() => performExpensiveOperation()}`;

// Rich object logging
const data = { id: 123, items: ['a', 'b', 'c'] };
logger.d`Request data: ${data}`;
```

**[→ Full Logger Documentation](src/logger/README.md)**

### Event Notifier

Simple, type-safe event notifications with lazy evaluation:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<string>();

// Subscribe to events
const subscription = notifier.onEvent((msg) => {
  console.log(`Received: ${msg}`);
});

// Notify with lazy evaluation
notifier.notify(() => {
  return expensiveEventData(); // Only called if listeners exist
});

// Promise-based event waiting
const nextEvent = await notifier.waitForEvent();
```

Need lifecycle hooks or centralized error tracking? See the notifier documentation for optional `onError`/`onChange` hooks and other configuration details.

**[→ Full Notifier Documentation](src/notifier/README.md)**

### Function & Promise Tracking

Monitor function calls, coordinate async operations, and cache expensive computations:

```ts
import { createInvocationTracker, trackPromises, holdPromises } from 'emitnlog/tracker';

// Function call tracking
const tracker = createInvocationTracker();
tracker.onCompleted((inv) => console.log(`${inv.key.operation} took ${inv.stage.duration}ms`));

const login = tracker.track('login', async (user) => {
  await authenticateUser(user);
});

// Promise coordination
const promiseTracker = trackPromises();
promiseTracker.track('cleanup', database.close());
await promiseTracker.wait(); // Wait for all tracked promises

// Promise deduplication
const holder = holdPromises();
const [user1, user2] = await Promise.all([
  holder.track('user-123', () => fetchUser(123)),
  holder.track('user-123', () => fetchUser(123)), // Same promise, no duplicate fetch
]);
```

**[→ Full Tracker Documentation](src/tracker/README.md)**

### Utilities

Helpful utilities for async operations, type safety, and data handling:

```ts
import { debounce, withTimeout, stringify, exhaustiveCheck } from 'emitnlog/utils';

// Debounced operations
const debouncedSave = debounce(saveData, 500);
await debouncedSave(data);

// Timeout handling
const result = await withTimeout(longRunningOperation(), 5000, 'timeout');

// Safe stringification
const logMessage = stringify(complexObject);

// Exhaustive type checking
function handleStatus(status: 'pending' | 'success' | 'error') {
  switch (status) {
    case 'pending':
      return 'Loading...';
    case 'success':
      return 'Done!';
    case 'error':
      return 'Failed!';
    default:
      return exhaustiveCheck(status); // Compile-time error if case missed
  }
}
```

**[→ Full Utilities Documentation](src/utils/README.md)**

## Features

- **Type-Safe**: Built with TypeScript from the ground up
- **Lightweight**: Zero dependencies, minimal runtime overhead
- **Lazy Evaluation**: Compute values only when needed
- **Flexible**: Multiple logger targets, customizable formats
- **Environment-Aware**: Automatically detects NodeJS vs browser/neutral environments
- **Promise-Friendly**: First-class async/await support

## Documentation

| Component     | Description                                                    | Documentation                      |
| ------------- | -------------------------------------------------------------- | ---------------------------------- |
| **Logger**    | Structured logging with template literals and multiple outputs | [logger](src/logger/README.md)     |
| **Notifier**  | Type-safe event notifications with lazy evaluation             | [notifier](src/notifier/README.md) |
| **Tracker**   | Function call tracking, promise coordination, and caching      | [tracker](src/tracker/README.md)   |
| **Utilities** | Async helpers, type guards, and data utilities                 | [utils](src/utils/README.md)       |

## Logger + Notifier Example

Here's how the logger and notifier components work together:

```ts
import { createEventNotifier } from 'emitnlog/notifier';
import { createConsoleLogLogger } from 'emitnlog/logger';

type Progress = { filename: string; percent: number };

class FileUploader {
  private _logger = createConsoleLogLogger('debug');
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
  renderProgress(filename, percent);
});

uploader.upload('video.mp4');
```

## Advanced Import Concepts

This section is for developers who want more control over how modules are resolved and used, especially in projects that need to support multiple runtime environments. If you're just getting started, the standard imports shown on the examples will "just work" — no special handling required.

### Runtime-Specific Imports

By default, `emitnlog` automatically detects the runtime environment (NodeJS or neutral like browser/edge runtimes) and loads the appropriate implementation. However, if you're building a library or SDK and want stricter control — for example, to guarantee that only runtime-neutral features are included, you can explicitly import from the `emitnlog/neutral` variant:

```ts
import { createConsoleLogLogger } from 'emitnlog/neutral/logger';
```

This ensures your code remains portable and avoids accidentally depending on Node-only features like file-based loggers.

### Import Styles

You can import from `emitnlog` using different styles depending on your project structure and preferences.

The examples use **path imports** for clarity, but you have three import styles to choose from:

#### Path Imports

```ts
import { createConsoleLogLogger } from 'emitnlog/logger';
import { createEventNotifier } from 'emitnlog/notifier';
import { createInvocationTracker } from 'emitnlog/neutral/tracker';
import { debounce } from 'emitnlog/utils';
```

#### Flat Imports

```ts
import { createConsoleLogLogger, createEventNotifier, createInvocationTracker, debounce } from 'emitnlog';
```

#### Namespace Imports

```ts
import { logging, notifying, tracking, utils } from 'emitnlog/neutral';

const logger = logging.createConsoleLogLogger();
const notifier = notifying.createEventNotifier();
const tracker = tracking.createInvocationTracker();
const debouncedFn = utils.debounce(fn, 500);
```

Path imports are used throughout the examples because they:

- Make it clear which module each function comes from
- Enable better tree-shaking in bundlers
- Provide more predictable IDE auto-imports

But feel free to use whichever style fits your project best!

All styles and import paths are compatible with both CommonJS and ESM environments.

## API Reference

See source JSDoc for complete API documentation with examples.

## License

[MIT](LICENSE)
