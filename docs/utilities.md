# Utilities Documentation

A set of helpful utilities for async operations, type safety, and data handling. These utilities are used internally by the library but are also available for direct use in your applications.

## Table of Contents

- [Data Utilities](#data-utilities)
  - [stringify](#stringify)
  - [errorify](#errorify)
- [Type Utilities](#type-utilities)
  - [exhaustiveCheck](#exhaustivecheck)
  - [isNotNullable](#isnotnullable)
- [Async Utilities](#async-utilities)
  - [delay](#delay)
  - [debounce](#debounce)
  - [withTimeout](#withtimeout)
  - [createDeferredValue](#createdeferredvalue)
  - [startPolling](#startpolling)
- [Lifecycle Management](#lifecycle-management)
  - [closeAll](#closeall)
  - [asClosable](#asclosable)
  - [asSafeClosable](#assafeclosable)
  - [createCloser](#createcloser)
- [QoL](#qol)
  - [Terminal Formatting](#terminal-formatting)
  - [Empty Array](#empty-array)

## Data Utilities

### stringify

Safe and flexible value stringification for logging and display purposes.

```ts
import { stringify } from 'emitnlog/utils';

// Basic usage
stringify('hello'); // 'hello'
stringify(123); // '123'
stringify(new Date()); // ISO string, e.g., '2023-04-21T12:30:45.678Z'

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
stringify(now); // '2023-04-21T12:30:45.678Z' (ISO 8601 with UTC 'Z')
stringify(now, { useLocale: true }); // e.g., '4/21/2023, 12:30:45 PM' (depends on user's locale)

// Handles circular references
const circular = { name: 'circular' };
circular.self = circular;
stringify(circular); // safely handles the circular reference
```

#### stringify Options

```ts
interface StringifyOptions {
  includeStack?: boolean; // Include stack trace for Error objects (default: false)
  pretty?: boolean; // Pretty-print JSON objects (default: false)
  maxDepth?: number; // Max depth for nested structures; negative disables limit (default: 5)
  useLocale?: boolean; // Use locale-specific date formatting (default: false)
  maxArrayElements?: number; // Max array items before truncation; negative disables (default: 100)
  maxProperties?: number; // Max object properties before truncation; negative disables (default: 50)
}
```

The `stringify` utility never throws, making it safe for all logging contexts.

#### Advanced Usage

```ts
import { stringify } from 'emitnlog/utils';

// Custom object with toString method
class CustomObject {
  constructor(private value: string) {}

  toString() {
    return `CustomObject(${this.value})`;
  }
}

const obj = new CustomObject('test');
stringify(obj); // 'CustomObject(test)'

// Functions are converted to their string representation
const fn = () => 'hello';
stringify(fn); // '() => "hello"'

// Undefined and null handling
stringify(undefined); // 'undefined'
stringify(null); // 'null'

// Complex nested objects
const complex = {
  user: { id: 1, name: 'Alice' },
  tasks: ['task1', 'task2'],
  meta: { created: new Date(), active: true },
};
stringify(complex, { pretty: true });
// Pretty-printed JSON with proper indentation
```

### errorify

Convert any value to an Error object, preserving existing Error instances.

```ts
import { errorify } from 'emitnlog/utils';

// Convert string to Error
const error = errorify('Something went wrong');
console.log(error instanceof Error); // true
console.log(error.message); // 'Something went wrong'

// Preserve existing Error objects
const originalError = new Error('Original error');
const sameError = errorify(originalError); // Returns the original Error
console.log(sameError === originalError); // true

// Handle various input types
const stringError = errorify('String error');
const numberError = errorify(404);
const objectError = errorify({ message: 'Object error' });
const nullError = errorify(null);
```

#### Use Cases

```ts
import { errorify } from 'emitnlog/utils';

// In promise rejection handling
Promise.reject('Network timeout')
  .catch(errorify)
  .catch((error: Error) => {
    console.log(error.message); // 'Network timeout'
    console.log(error.stack); // Stack trace available
  });

// In function that should always throw Error objects
function processData(data: unknown) {
  if (!data) {
    throw errorify('Data is required');
  }
  // Process data...
}

// In error logging
function logError(error: unknown) {
  const errorObj = errorify(error);
  logger.error(`Error occurred: ${errorObj.message}`, { stack: errorObj.stack, name: errorObj.name });
}
```

## Type Utilities

### exhaustiveCheck

TypeScript utility for exhaustive switch statements that ensures all cases are handled.

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

#### Advanced Usage

```ts
import { exhaustiveCheck } from 'emitnlog/utils';

// With union types
type Theme = 'light' | 'dark' | 'auto';
type Language = 'en' | 'es' | 'fr';

function getThemeConfig(theme: Theme, lang: Language): string {
  switch (theme) {
    case 'light':
      return getConfig('light', lang);
    case 'dark':
      return getConfig('dark', lang);
    case 'auto':
      return getConfig('auto', lang);

    default:
      exhaustiveCheck(theme); // Ensures all Theme values are handled
      return 'unknown';
  }
}

// With discriminated unions
type Action = { type: 'increment'; value: number } | { type: 'decrement'; value: number } | { type: 'reset' };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case 'increment':
      return state + action.value;
    case 'decrement':
      return state - action.value;
    case 'reset':
      return 0;

    default:
      exhaustiveCheck(action); // Ensures all Action types are handled
      return 0;
  }
}
```

### isNotNullable

Type guard for filtering out `null` and `undefined` values from arrays.

```ts
import { isNotNullable } from 'emitnlog/utils';

const values: Array<string | null | undefined> = ['a', null, 'b', undefined, 'c'];
const filtered: string[] = values.filter(isNotNullable);
console.log(filtered); // ['a', 'b', 'c']
```

#### Use Cases

```ts
import { isNotNullable } from 'emitnlog/utils';

// API response filtering
interface User {
  id: number;
  name: string;
  email?: string;
}

const users: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
];

const emails: string[] = users.map((user) => user.email).filter(isNotNullable);
console.log(emails); // ['alice@example.com', 'charlie@example.com']

// With optional chaining
const nestedData = [{ user: { profile: { name: 'Alice' } } }, { user: { profile: null } }, { user: null }, null];
const names: string[] = nestedData.map((item) => item?.user?.profile?.name).filter(isNotNullable);
console.log(names); // ['Alice']

// Method chaining
const processedData = rawData
  .map(transformData)
  .filter(isNotNullable)
  .map((item) => item.processedValue);
```

## Async Utilities

### delay

Waits for a specified duration before continuing execution.

```ts
import { delay } from 'emitnlog/utils';

await delay(500); // wait 500ms
console.log('This logs after half a second');

// In async functions
async function processWithDelay() {
  console.log('Starting process...');
  await delay(1000);
  console.log('Process completed after 1 second');
}

// For rate limiting
async function rateLimitedRequests(urls: string[]) {
  const results = [];

  for (const url of urls) {
    const response = await fetch(url);
    results.push(await response.json());

    // Wait between requests
    await delay(100);
  }

  return results;
}
```

Often useful in cooldowns, stabilization intervals, and tests.

### debounce

Delays function execution until after calls have stopped for a specified period. Returns promises that resolve when the operation completes.

```ts
import { debounce } from 'emitnlog/utils';

// Basic debouncing
const debouncedSave = debounce(saveUserData, 500);

// Multiple calls - only the last executes
const promise1 = debouncedSave({ name: 'Alice' });
const promise2 = debouncedSave({ name: 'Bob' });
// After 500ms: saves Bob's data, both promises resolve with same result

// Cancel or flush pending calls
debouncedSave.cancel(); // Cancels pending execution
debouncedSave.flush(); // Executes immediately

// Advanced options
const debouncedFetch = debounce(fetchData, {
  delay: 300,
  leading: true, // Execute immediately on first call
  waitForPrevious: true, // Wait for previous promise
  accumulator: (prev, current) => [...(prev || []), ...current], // Combine arguments
});
```

#### debounce Options

```ts
interface DebounceOptions<TArgs extends readonly unknown[]> {
  delay: number; // Debounce delay in milliseconds
  leading?: boolean; // Execute immediately on first call (leading edge)
  waitForPrevious?: boolean; // Wait for previous promise to resolve before executing
  accumulator?: (previous: TArgs | undefined, current: TArgs) => TArgs; // Combine arguments across calls
}
```

#### Advanced Usage

```ts
import { debounce } from 'emitnlog/utils';

// Search functionality
const debouncedSearch = debounce(async (query: string) => {
  const response = await fetch(`/api/search?q=${query}`);
  return response.json();
}, 300);

// UI event handler
function onSearchInput(event: Event) {
  const query = (event.target as HTMLInputElement).value;
  debouncedSearch(query).then((results) => {
    updateSearchResults(results);
  });
}

// Batch operations
const batchedLog = debounce(
  (messages: string[]) => {
    console.log('Batched messages:', messages);
  },
  { delay: 100, accumulator: (prev, current) => [...(prev || []), ...current] },
);

batchedLog(['message1']);
batchedLog(['message2']);
batchedLog(['message3']);
// After 100ms: logs ["message1", "message2", "message3"]
```

Perfect for handling rapid user input, API calls, or file system events where you only need the final result.

### withTimeout

Wraps a promise to enforce a timeout, optionally falling back to a value.

```ts
import { withTimeout } from 'emitnlog/utils';

const fetchCompleted = (): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 2000);
  });
};

const result1: boolean | undefined = await withTimeout(fetchCompleted(), 1000);
const result2: boolean | 'timeout' = await withTimeout(fetchCompleted(), 1000, 'timeout');
```

#### Use Cases

```ts
import { withTimeout } from 'emitnlog/utils';

// API calls with timeout
async function fetchUserData(id: string) {
  try {
    const userData = await withTimeout(
      fetch(`/api/users/${id}`).then((r) => r.json()),
      5000, // 5 second timeout
    );
    return userData;
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      return null; // Handle timeout gracefully
    }
    throw error;
  }
}

// Database operations
async function queryDatabase(query: string) {
  const result = await withTimeout(
    database.query(query),
    10000, // 10 second timeout
    [], // Default to empty array on timeout
  );
  return result;
}

// File operations
async function readFileWithTimeout(path: string) {
  return await withTimeout(
    fs.readFile(path, 'utf8'),
    3000, // 3 second timeout
    'File read timeout', // Fallback message
  );
}
```

Returns the original promise result if it resolves in time, otherwise returns the fallback. Helpful for safe async handling in flaky environments.

### createDeferredValue

Creates a promise that can be resolved or rejected later, useful for manual promise control.

```ts
import { createDeferredValue } from 'emitnlog/utils';

const deferred = createDeferredValue<string>();

setTimeout(() => deferred.resolve('done'), 1000);
const result = await deferred.promise;
console.log(result); // 'done'
```

#### Use Cases

```ts
import { createDeferredValue } from 'emitnlog/utils';

// Event-driven coordination
class EventCoordinator {
  private connectionDeferred = createDeferredValue<void>();

  async waitForConnection() {
    return this.connectionDeferred.promise;
  }

  onConnected() {
    this.connectionDeferred.resolve();
  }

  onConnectionFailed(error: Error) {
    this.connectionDeferred.reject(error);
  }
}

// Manual promise resolution in tests
async function testAsyncOperation() {
  const operationComplete = createDeferredValue<string>();

  // Start async operation
  startAsyncOperation((result) => {
    operationComplete.resolve(result);
  });

  // Wait for completion
  const result = await operationComplete.promise;
  expect(result).toBe('expected result');
}

// Request/response pattern
class RequestManager {
  private pendingRequests = new Map<string, ReturnType<typeof createDeferredValue>>();

  async sendRequest(id: string, data: unknown) {
    const deferred = createDeferredValue();
    this.pendingRequests.set(id, deferred);

    // Send request
    this.sendMessage({ id, data });

    return deferred.promise;
  }

  handleResponse(id: string, response: unknown) {
    const deferred = this.pendingRequests.get(id);
    if (deferred) {
      deferred.resolve(response);
      this.pendingRequests.delete(id);
    }
  }
}
```

Useful for coordinating async operations manually, like event-driven triggers or testing deferred resolution.

### startPolling

Continuously runs an operation at intervals until stopped or a condition is met.

```ts
import { startPolling } from 'emitnlog/utils';

const { wait, close } = startPolling(fetchStatus, 1000, { interrupt: (result) => result === 'done', timeout: 10_000 });

const final = await wait;
```

#### Polling Options

```ts
interface PollingOptions<T, V> {
  invokeImmediately?: boolean; // Invoke once immediately instead of waiting for first interval (default: false)
  timeout?: number; // Maximum polling duration in ms; stops polling on reach
  timeoutValue?: V; // Value to resolve when timeout occurs (default: undefined)
  retryLimit?: number; // Max number of invocations before auto-stop
  interrupt?: (result: T, invocationIndex: number) => boolean; // Return true to stop polling
  logger?: Logger; // Optional logger to record debug/errors (emitnlog logger)
}
```

#### Use Cases

```ts
import { startPolling } from 'emitnlog/utils';

// Job status polling
async function waitForJobCompletion(jobId: string) {
  const { wait, close } = startPolling(
    () => checkJobStatus(jobId),
    2000, // Check every 2 seconds
    {
      interrupt: (status) => status === 'completed' || status === 'failed',
      timeout: 60000, // Stop after 1 minute
      logger, // Provide a logger to capture errors
    },
  );

  try {
    const finalStatus = await wait;
    return finalStatus;
  } finally {
    close(); // Always clean up
  }
}

// Health check monitoring
function monitorServiceHealth(serviceUrl: string) {
  const { wait, close } = startPolling(
    async () => {
      const response = await fetch(`${serviceUrl}/health`);
      return response.ok;
    },
    5000, // Check every 5 seconds
    {
      interrupt: (isHealthy) => !isHealthy, // Stop when service becomes unhealthy
      logger, // Use a logger to record errors
    },
  );

  return { wait, close };
}

// Resource availability polling
async function waitForResourceAvailability(resourceId: string) {
  const { wait, close } = startPolling(
    async () => {
      const resource = await getResource(resourceId);
      return resource?.status;
    },
    1000,
    { interrupt: (status) => status === 'available', timeout: 30000 },
  );

  const finalStatus = await wait;
  close();

  return finalStatus === 'available';
}
```

Polling stops automatically on timeout or interrupt. Call `close()` to stop early. Works with sync or async functions and handles exceptions safely.

#### Advanced Features

```ts
import { startPolling } from 'emitnlog/utils';

// Limit attempts and stop on interrupt
const { wait } = startPolling(() => fetchJobStatus(), 1000, {
  retryLimit: 10,
  interrupt: (status) => status === 'done',
  timeout: 60_000,
});

// Use timeoutValue to signal timeouts explicitly
const { wait: timedWait } = startPolling(() => checkHealth(), 2000, {
  timeout: 30_000,
  timeoutValue: 'timeout' as const,
});
```

## Lifecycle Management

Utilities for managing lifecycle and cleanup operations with robust error handling.

### closeAll

Closes multiple resources at once, handling both synchronous and asynchronous closables with error accumulation.

```ts
import { closeAll } from 'emitnlog/utils';

// Synchronous resources
const timer = { close: () => clearInterval(timerId) };
const listener = { close: () => removeEventListener('click', handler) };

closeAll(timer, listener); // Returns void immediately

// Mixed sync and async resources
const dbConnection = { close: async () => await db.disconnect() };
const fileHandle = { close: () => fs.closeSync(fd) };

await closeAll(dbConnection, fileHandle); // Returns Promise<void>
```

Error handling ensures all resources are closed even if some fail:

```ts
import { closeAll } from 'emitnlog/utils';

const failing = {
  close: () => {
    throw new Error('Cleanup failed');
  },
};
const working = { close: () => console.log('Cleaned up') };

try {
  closeAll(failing, working);
} catch (error) {
  console.log(error.message); // 'Cleanup failed'
  // Both close methods were called despite the error
}

// Multiple failures are accumulated
const failing1 = {
  close: () => {
    throw new Error('Error 1');
  },
};
const failing2 = {
  close: async () => {
    throw new Error('Error 2');
  },
};

try {
  await closeAll(failing1, failing2);
} catch (error) {
  console.log(error.message); // 'Multiple errors occurred while closing closables'
  console.log(error.cause); // Array with both Error objects
}
```

### asClosable

Converts functions and combines multiple cleanup operations into a single closable resource.

```ts
import { asClosable } from 'emitnlog/utils';

// Convert cleanup functions to closable
const cleanup1 = () => clearTimeout(timerId);
const cleanup2 = () => removeEventListener('resize', handler);

const disposer = asClosable(cleanup1, cleanup2);
disposer.close(); // Calls both cleanup functions

// Combine different types of closables
const syncResource = { close: () => console.log('Sync cleanup') };
const asyncFunction = async () => await db.disconnect();
const logger = createLogger(); // Has optional close method

const combined = asClosable(syncResource, asyncFunction, logger);
await combined.close(); // Returns AsyncClosable due to async input
```

Works with various input types including partial closables like loggers:

```ts
import { asClosable } from 'emitnlog/utils';
import { createConsoleLogLogger } from 'emitnlog/logger';

const logger = createConsoleLogLogger();
const cleanup = () => clearAllTimers();
const resource = { close: async () => await cleanup() };

// Automatically infers return type based on inputs
const combined = asClosable(logger, cleanup, resource);
// Returns AsyncClosable because logger.close can be async
```

### asSafeClosable

Wraps closables to prevent errors during cleanup from propagating, ensuring robust resource management.

```ts
import { asSafeClosable } from 'emitnlog/utils';

const unreliableResource = {
  close: () => {
    throw new Error('Cleanup failed');
  },
};

// Basic usage - errors are silently swallowed
const silent = asSafeClosable(unreliableResource);
silent.close(); // Never throws

// With error handling callback
const withLogging = asSafeClosable(unreliableResource, (error) => {
  console.warn('Cleanup error:', error.message);
});
withLogging.close(); // Logs warning but doesn't throw
```

Perfect for ensuring cleanup operations never fail in critical sections:

```ts
import { asClosable, asSafeClosable } from 'emitnlog/utils';

// Create a robust cleanup chain that never fails
const robustCleanup = asClosable(
  asSafeClosable(riskyResource1, logError),
  asSafeClosable(riskyResource2, logError),
  asSafeClosable(riskyResource3, logError),
);

await robustCleanup.close(); // Guaranteed to never throw or reject

// In application shutdown
process.on('SIGTERM', async () => {
  const cleanup = asClosable(asSafeClosable(database), asSafeClosable(server), asSafeClosable(logger));

  await cleanup.close(); // Safe shutdown even if some resources fail
  process.exit(0);
});
```

### createCloser

Creates a dynamic closable that can accumulate other closables and clean them all up with a single call.

This utility is ideal for situations where resources are initialized conditionally or across different parts of a function. Instead of manually tracking and closing each one, `createCloser()` gives you a single object to register them with. When you're done, just call `closer.close()` to release everything—safely and in reverse order.

It complements [asClosable](#asclosable), which is used to combine existing closables into one. In contrast, `createCloser` gives you a mutable container that grows over time. It also preserves the type of each closable added, which helps maintain type safety in complex setups.

```ts
import { createCloser, asClosable } from 'emitnlog/utils';

const closer = createCloser();

const db = closer.add(asClosable(() => disconnect()));
const logger = closer.add(createLogger());

// Add more closables later if needed
if (enableMetrics) {
  closer.add(asClosable(() => shutdownMetrics()));
}

// At the end (or on error), close all resources
await closer.close(); // Closes in reverse order: metrics, logger, db
```

If `close()` is called multiple times, previously registered closables are not invoked again. Any new closables added after the first `close()` will still be tracked and closed on subsequent calls.

Errors thrown during closing are accumulated and reported consistently using the same strategy as [closeAll](#closeall).

## QoL

### Terminal Formatting

Utilities to format strings for terminals (ANSI escape sequences).

```ts
import { terminalFormatter } from 'emitnlog/utils';

console.log(terminalFormatter.cyan('INFO: ready'));
console.log(terminalFormatter.indent('Indented', 2));
```

### Empty Array

Helper for reusing empty arrays without extra allocations.

```ts
import { emptyArray } from 'emitnlog/utils';

const items = emptyArray<number>(); // readonly number[]
```

---

[← Back to main README](../README.md)
