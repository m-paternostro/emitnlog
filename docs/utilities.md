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

## Data Utilities

### stringify

Safe and flexible value stringification for logging and display purposes.

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

#### stringify Options

```ts
interface StringifyOptions {
  pretty?: boolean; // Pretty-print JSON objects
  includeStack?: boolean; // Include stack trace for Error objects
  useLocale?: boolean; // Use locale-specific date formatting
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
interface DebounceOptions<TArgs extends readonly unknown[], TResult> {
  delay?: number; // Debounce delay in milliseconds
  leading?: boolean; // Execute immediately on first call
  waitForPrevious?: boolean; // Wait for previous promise to resolve
  accumulator?: (previous: TArgs | undefined, current: TArgs) => TArgs; // Combine arguments
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
interface PollingOptions<T> {
  interrupt?: (result: T) => boolean; // Stop polling when condition is met
  timeout?: number; // Maximum polling duration
  onError?: (error: Error) => void; // Error handler
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
      onError: (error) => console.error('Polling error:', error),
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
      onError: (error) => logger.error('Health check failed:', error),
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

// Exponential backoff polling
let interval = 1000;
const { wait, close } = startPolling(
  async () => {
    const result = await checkCondition();
    if (!result) {
      interval = Math.min(interval * 1.5, 10000); // Increase up to 10s
    }
    return result;
  },
  () => interval, // Dynamic interval
  { interrupt: (result) => result === true, timeout: 120000 },
);

// Polling with retries
const { wait, close } = startPolling(
  async () => {
    try {
      return await unstableOperation();
    } catch (error) {
      console.log('Operation failed, will retry...');
      return null; // Continue polling
    }
  },
  2000,
  { interrupt: (result) => result !== null, timeout: 60000 },
);
```

---

[← Back to main README](../README.md)
