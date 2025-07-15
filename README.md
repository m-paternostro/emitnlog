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

## Quick Start

```bash
npm install emitnlog
```

### Logger

Clean, template-literal logging with multiple output formats and lazy evaluation:

```ts
import { ConsoleLogger } from 'emitnlog/logger';

const logger = new ConsoleLogger();

// Template logging with lazy evaluation
const userId = 'user123';
logger.i`User ${userId} logged in successfully`;

// Only computed when log level matches
logger.d`Expensive calculation: ${() => performExpensiveOperation()}`;

// Rich object logging
const data = { id: 123, items: ['a', 'b', 'c'] };
logger.d`Request data: ${data}`;
```

**[→ Full Logger Documentation](docs/logger.md)**

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

**[→ Full Notifier Documentation](docs/notifier.md)**

### Function & Promise Tracking

Monitor function calls, coordinate async operations, and cache expensive computations:

```ts
import { createInvocationTracker, trackPromises, holdPromises } from 'emitnlog/tracker';

// Function call tracking
const tracker = createInvocationTracker();
tracker.onCompleted((inv) => console.log(`${inv.key.operation} took ${inv.duration}ms`));

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

**[→ Full Tracker Documentation](docs/tracker.md)**

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

**[→ Full Utilities Documentation](docs/utilities.md)**

## Features

- **🎯 Type-Safe**: Built with TypeScript from the ground up
- **🪶 Lightweight**: Zero dependencies, minimal runtime overhead
- **⚡ Lazy Evaluation**: Compute values only when needed
- **🔧 Flexible**: Multiple logger targets, customizable formats
- **🎪 Environment-Driven**: Configure via environment variables
- **🔄 Promise-Friendly**: First-class async/await support

## Documentation

| Component     | Description                                                    | Documentation                          |
| ------------- | -------------------------------------------------------------- | -------------------------------------- |
| **Logger**    | Structured logging with template literals and multiple outputs | [docs/logger.md](docs/logger.md)       |
| **Notifier**  | Type-safe event notifications with lazy evaluation             | [docs/notifier.md](docs/notifier.md)   |
| **Tracker**   | Function call tracking, promise coordination, and caching      | [docs/tracker.md](docs/tracker.md)     |
| **Utilities** | Async helpers, type guards, and data utilities                 | [docs/utilities.md](docs/utilities.md) |

## Logger + Notifier Example

Here's how the logger and notifier components work together:

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
  renderProgress(filename, percent);
});

uploader.upload('video.mp4');
```

## API Reference

See source JSDoc for complete API documentation with examples.

## License

[MIT](LICENSE)
