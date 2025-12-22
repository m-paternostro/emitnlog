# Emit n' Log: Tracker

The tracker module provides utilities for monitoring function calls, coordinating async operations, and caching expensive computations. It offers structured observability without requiring external tracing systems or heavy instrumentation.

## Table of Contents

- [Invocation Tracker](#invocation-tracker)
- [Promise Tracker](#promise-tracker)
- [Promise Holder](#promise-holder)
- [Promise Vault](#promise-vault)
- [Promise Tracking Comparison](#promise-tracking-comparison)
- [Advanced Usage](#advanced-usage)

## Invocation Tracker

The invocation tracker is a focused utility for monitoring function calls — it emits detailed lifecycle events, optionally logs invocation details, and supports metadata tagging.

### Basic Usage

```ts
import { createInvocationTracker } from 'emitnlog/tracker';

const tracker = createInvocationTracker({ tags: { service: 'auth' } });

tracker.onCompleted((invocation) => {
  appLogger.i`✔ ${invocation.key.operation} completed in ${invocation.stage.duration}ms`;
  updateUI(invocation.args[0]);
});

const login = tracker.track('login', (user) => {
  doLogin(user);
});

login('Cayde');
```

### Async and Nested Tracking

The tracker automatically handles both sync and async functions, and can maintain parent-child invocation relationships:

```ts
import { createInvocationTracker } from 'emitnlog/tracker';
import { exhaustiveCheck } from 'emitnlog/utils';

// Creates a tracker for two specific operations
const tracker = createInvocationTracker<'saveUser' | 'createUser'>();

tracker.onInvoked((invocation) => {
  const operation = invocation.key.operation;
  switch (operation) {
    case 'saveUser':
      if (invocation.stage.type === 'completed' && invocation.parentKey?.operation === 'createUser') {
        void loadNewUserProfile();
      }
      break;

    case 'createUser':
      if (invocation.stage.type === 'errored') {
        void handleUserCreationError(invocation.stage.error);
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

### Tracking Methods on Objects and Classes

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

### Tracking Class Instances

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

### Invocation Tracker Options

```ts
import { createInvocationTracker } from 'emitnlog/tracker';

interface InvocationTrackerOptions {
  // Metadata tags; array of { name, value } or record { [name]: value }
  tags?:
    | readonly { name: string; value: string | number | boolean }[]
    | { readonly [name: string]: string | number | boolean };
  logger?: Logger; // Optional logger for automatic logging
  stack?: InvocationStack; // Custom stack for parent-child relationships
}

const tracker = createInvocationTracker<'login' | 'logout'>({
  tags: { service: 'auth', version: '1.0' },
  logger: myLogger,
});
```

### Invocation Events

The tracker emits detailed events for each invocation:

```ts
tracker.onInvoked((invocation) => {
  // Called for all stages: 'started', 'completed', 'errored'
  console.log(`${invocation.key.operation} stage: ${invocation.stage.type}`);
});

tracker.onCompleted((invocation) => {
  // Only called when function completes successfully
  console.log(`${invocation.key.operation} completed in ${invocation.stage.duration}ms`);
});

tracker.onErrored((invocation) => {
  // Only called when function throws an error
  console.error(`${invocation.key.operation} failed:`, invocation.stage.error);
});
```

### Invocation Data Structure

```ts
type InvocationBase<TOperation extends string> = {
  key: InvocationKey<TOperation>;
  parentKey?: InvocationKey;
  args?: readonly unknown[];
  tags?: readonly { name: string; value: string | number | boolean }[];
};

type StartedInvocation<TOperation extends string> = InvocationBase<TOperation> & { stage: { type: 'started' } };

type CompletedInvocation<TOperation extends string> = InvocationBase<TOperation> & {
  stage: { type: 'completed'; duration: number; promiseLike?: boolean; result?: unknown };
};

type ErroredInvocation<TOperation extends string> = InvocationBase<TOperation> & {
  stage: { type: 'errored'; duration: number; promiseLike?: boolean; error: unknown };
};
```

### Method Tracking Options

```ts
interface TrackMethodsOptions<T> {
  methods?: Array<keyof T>; // Specific methods to track
  includeConstructor?: boolean; // Include constructor when methods not specified
  trackBuiltIn?: boolean; // Allow tracking built-in types like Array/Map/Set
  tags?:
    | readonly { name: string; value: string | number | boolean }[]
    | { readonly [name: string]: string | number | boolean };
}

trackMethods(tracker, service, {
  methods: ['createUser', 'updateUser'], // Only track these methods
  tags: { component: 'user-service' },
});
```

## Promise Tracker

A utility for monitoring and coordinating multiple unrelated promises — perfect for scenarios like server shutdown coordination, background task monitoring, or waiting for various async operations to complete.

### Basic Usage

```ts
import { trackPromises } from 'emitnlog/tracker';

const tracker = trackPromises();

// Track some operations
const result1 = tracker.track('fetch-user', fetchUserData());
const result2 = tracker.track('save-config', saveConfiguration());

// Wait for all tracked promises to settle
await tracker.wait();
console.log('All operations complete');
```

### Server Shutdown Coordination

```ts
import { trackPromises } from 'emitnlog/tracker';
import { withTimeout } from 'emitnlog/utils';

const shutdownTracker = trackPromises({ logger: serverLogger });

// Track cleanup operations
shutdownTracker.track('db-close', database.close());
shutdownTracker.track('cache-flush', cache.flush());
shutdownTracker.track('server-close', server.close());

// Graceful shutdown with timeout
try {
  await withTimeout(shutdownTracker.wait(), 30000);
  console.log('Graceful shutdown completed');
} catch {
  console.log('Shutdown timeout - forcing exit');
}
```

### Performance Monitoring

```ts
import { trackPromises } from 'emitnlog/tracker';

const tracker = trackPromises();

// Monitor promise performance
tracker.onSettled((event) => {
  const status = event.rejected ? 'FAILED' : 'SUCCESS';
  const label = event.label ?? 'unlabeled';
  console.log(`${label}: ${event.duration}ms - ${status}`);
});

// Track operations with labels
tracker.track('api-request', apiCall());
tracker.track('data-processing', () => processData()); // More accurate timing
```

### Promise Tracker Options

```ts
import { trackPromises } from 'emitnlog/tracker';

interface PromiseTrackerOptions {
  logger?: Logger; // Optional logger for automatic logging
}

const tracker = trackPromises({ logger: myLogger });
```

### Promise Supplier Functions

You can track functions that return promises for more accurate timing:

```ts
import { trackPromises } from 'emitnlog/tracker';

const tracker = trackPromises();

// Track promise supplier for accurate timing
const result = tracker.track('expensive-operation', () => {
  // Timing starts here, not when promise was created
  return expensiveAsyncOperation();
});

// vs tracking an existing promise
const existingPromise = expensiveAsyncOperation();
const result2 = tracker.track('existing-promise', existingPromise); // Less accurate timing
```

### Promise Tracker Events

```ts
tracker.onSettled((event) => {
  console.log(`Promise ${event.label ?? '(unlabeled)'} settled in ${event.duration}ms`);
  if (event.rejected) {
    console.error('Promise failed:', event.result);
  } else {
    console.log('Promise result:', event.result);
  }
});
```

### Promise Event Data Structure

```ts
interface PromiseSettledEvent {
  label?: string;
  duration: number;
  rejected?: boolean;
  // When resolved, result is the resolved value; when rejected, result is the error
  result?: unknown;
}
```

### Key Features

- **Centralized Waiting**: `wait()` takes a snapshot of current promises - new promises tracked during the wait aren't included
- **Real-time Events**: Get notified when promises settle with detailed timing and result information
- **Promise Suppliers**: Track functions that return promises for more accurate timing measurements
- **Automatic Cleanup**: Promises are automatically removed when they settle to prevent memory leaks

## Promise Holder

Promise Holder is a specialized [Promise Tracker](#promise-tracker) that adds transient caching capabilities. It prevents duplicate execution of expensive operations by caching ongoing promises by ID — the cache is automatically cleared when promises settle (resolve or reject).

This is perfect for scenarios where the same expensive operation might be requested multiple times simultaneously, such as API calls, database queries, or file operations.

### Basic Usage

```ts
import { holdPromises } from 'emitnlog/tracker';

const holder = holdPromises();

// Multiple simultaneous requests for the same operation
const [result1, result2, result3] = await Promise.all([
  holder.track('user-123', () => fetchUserFromAPI(123)),
  holder.track('user-123', () => fetchUserFromAPI(123)),
  holder.track('user-123', () => fetchUserFromAPI(123)),
]);
// Only one API call was made, all get the same result
```

### Database Query Deduplication

```ts
import { holdPromises } from 'emitnlog/tracker';

const queryHolder = holdPromises({ logger: dbLogger });

const getUserById = (id: number) => {
  return queryHolder.track(`user-${id}`, async () => {
    console.log(`Executing query for user ${id}`);
    return await db.query('SELECT * FROM users WHERE id = ?', [id]);
  });
};

// Multiple components requesting the same user
const user1 = await getUserById(456);
const user2 = await getUserById(456); // Uses cached result, no duplicate query

// After the promise settles, the cache is cleared
// Next request will execute a fresh query
const user3 = await getUserById(456); // New query executed
```

### Promise Holder Options

```ts
import { holdPromises } from 'emitnlog/tracker';

interface PromiseHolderOptions {
  logger?: Logger; // Optional logger for automatic logging
}

const holder = holdPromises({ logger: myLogger });
```

### Cache Inspection

```ts
import { holdPromises } from 'emitnlog/tracker';

const holder = holdPromises();

// Check if operation is cached
if (holder.has('user-123')) {
  console.log('User 123 request is already in progress');
}

// Current cache size
console.log(`Cache contains ${holder.size} ongoing operations`);
```

### Key Features

- **Transient Caching**: Operations are cached only while their promises are unsettled
- **Automatic Cleanup**: Cache entries are automatically removed when promises settle
- **Deduplication**: Multiple requests for the same ID share the same promise instance
- **Full Promise Tracker API**: Inherits all tracking, waiting, and event capabilities

## Promise Vault

Promise Vault is a specialized [Promise Holder](#promise-holder) that provides persistent caching of expensive operations. Unlike Promise Holder which automatically clears the cache when promises settle, Promise Vault retains cached promises indefinitely until manually cleared.

This is ideal for operations that should execute only once per application lifecycle, such as initialization routines, configuration loading, or API calls for static data.

### Basic Usage

```ts
import { vaultPromises } from 'emitnlog/tracker';

const vault = vaultPromises();

// Application initialization that happens only once
const initializeApp = () => vault.track('app-init', () => setupApplication());
const loadConfig = () => vault.track('config', () => fetchConfiguration());

// Multiple calls return the same cached result
const app1 = await initializeApp(); // Executes setupApplication()
const app2 = await initializeApp(); // Uses cached result
const config = await loadConfig(); // Executes fetchConfiguration()
```

### Configuration Management

```ts
import { vaultPromises } from 'emitnlog/tracker';

const configVault = vaultPromises({ logger: configLogger });

const getConfig = (environment: string) => {
  return configVault.track(`config-${environment}`, async () => {
    console.log(`Loading config for ${environment}...`);
    return await fetchConfigFromRemote(environment);
  });
};

// Initial load
const config1 = await getConfig('production');

// Subsequent calls use cached result (no network call)
const config2 = await getConfig('production');

// Force refresh when needed
configVault.forget('config-production');
const freshConfig = await getConfig('production'); // New network call
```

### Per-Operation Cache Control

You can control caching behavior on a per-operation basis using the `forget` option. When `forget: true`, the operation behaves like [Promise Holder](#promise-holder) (transient caching), while `forget: false` or default provides the standard persistent caching:

```ts
import { vaultPromises } from 'emitnlog/tracker';

const vault = vaultPromises();

// Mix persistent and transient caching in the same vault
const config = await vault.track('app-config', () => loadConfig()); // Persistent
const liveData = await vault.track('live-feed', () => fetchLiveFeed(), { forget: true }); // Transient

// config stays cached, liveData is cleared after settlement
const sameConfig = await vault.track('app-config', () => loadConfig()); // Uses cache
const newLiveData = await vault.track('live-feed', () => fetchLiveFeed(), { forget: true }); // Executes again
```

### Automatically Forget to Allow Retry on Failure

```ts
import { vaultPromises } from 'emitnlog/tracker';

// Vault that automatically clears failed operations for retry
const retryVault = vaultPromises({ forgetOnRejection: true, logger: apiLogger });

const fetchData = async (id: string) => {
  return retryVault.track(`data-${id}`, async () => {
    const response = await fetch(`/api/data/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    return response.json();
  });
};

// First attempt fails and is automatically removed from cache
try {
  await fetchData('123');
} catch (error) {
  console.log('First attempt failed, will retry');
}

// Second attempt executes fresh (not cached)
const data = await fetchData('123'); // New attempt
```

### Cache Management

```ts
import { vaultPromises } from 'emitnlog/tracker';

const vault = vaultPromises();

// Check if operation is cached
if (vault.has('expensive-operation')) {
  console.log('Operation already cached');
}

// Clear specific cache entry
vault.forget('expensive-operation');

// Clear all cached entries
vault.clear();

// Current cache size
console.log(`Cache contains ${vault.size} entries`);
```

### Promise Vault Options

```ts
import { vaultPromises } from 'emitnlog/tracker';

interface PromiseVaultOptions {
  forgetOnRejection?: boolean; // Automatically clear failed operations
  logger?: Logger; // Optional logger for automatic logging
}

const vault = vaultPromises({
  forgetOnRejection: true, // Clear failed operations
  logger: myLogger,
});
```

### Key Features

- **Persistent Caching**: Promises remain cached even after settlement
- **Manual Cache Control**: Use `clear()` or `forget()` to invalidate cache entries
- **Full Promise Holder API**: Inherits all caching, tracking, and event capabilities

## Promise Tracking Comparison

| Feature             | [Promise Tracker](#promise-tracker) | [Promise Holder](#promise-holder)    | [Promise Vault](#promise-vault)        |
| ------------------- | ----------------------------------- | ------------------------------------ | -------------------------------------- |
| **Primary Purpose** | Coordinate multiple operations      | Prevent duplicate execution          | Long-term result caching               |
| **Caching**         | No caching                          | Transient (during promise lifecycle) | Persistent (until manually cleared)    |
| **Use Cases**       | Shutdown coordination, monitoring   | API calls, database queries          | Initialization, configuration, caching |
| **Cache Cleanup**   | N/A                                 | Automatic on settlement              | Manual via `clear()` or `forget()`     |
| **Error Handling**  | Pass-through                        | Cached temporarily                   | Configurable via `forgetOnRejection`   |
| **API**             | Basic tracking                      | Adds `has()` method                  | Adds `clear()`, `forget()` methods     |
| **Memory Usage**    | Minimal                             | Low (auto-cleanup)                   | Higher (manual cleanup required)       |

### When to Use Each

- **Promise Tracker**: Use when you need to coordinate multiple different operations (like server shutdown) or monitor promise performance without caching
- **Promise Holder**: Use when you want to prevent duplicate execution of expensive operations that might be requested multiple times during their lifecycle
- **Promise Vault**: Use when you need long-term caching of expensive operations that should execute only once per application session

## Advanced Usage

### Custom Stacks for Invocation Tracking

You can provide a custom stack implementation to control parent-child relationship tracking:

```ts
import { createInvocationTracker } from 'emitnlog/tracker';

// Custom stack for test isolation
import type { InvocationKey, InvocationStack } from 'emitnlog/tracker';

class TestStack implements InvocationStack {
  private stack: InvocationKey[] = [];

  close() {
    this.stack.length = 0;
  }

  peek() {
    return this.stack.at(-1);
  }

  push(item: InvocationKey) {
    this.stack.push(item);
  }

  pop() {
    return this.stack.pop();
  }
}

const tracker = createInvocationTracker({ stack: new TestStack() });
```

### Combining Trackers

You can combine different types of trackers for comprehensive monitoring:

```ts
import { createInvocationTracker, trackPromises } from 'emitnlog/tracker';

// Track function calls
const invocationTracker = createInvocationTracker();

// Track promise coordination
const promiseTracker = trackPromises();

// Combined service
class UserService {
  async createUser(userData) {
    // Track the function call
    return invocationTracker.track('createUser', async () => {
      // Track the database operation
      const dbPromise = promiseTracker.track('db-insert', db.insert(userData));

      // Track the email notification
      const emailPromise = promiseTracker.track('send-email', sendWelcomeEmail(userData));

      await Promise.all([dbPromise, emailPromise]);
      return userData;
    });
  }
}
```

### Error Handling Best Practices

```ts
import { createInvocationTracker } from 'emitnlog/tracker';

const tracker = createInvocationTracker();

// Track errors with context
tracker.onErrored((invocation) => {
  console.error(`Operation ${invocation.key.operation} failed:`, {
    error: invocation.stage.error,
    args: invocation.args,
    duration: invocation.stage.duration,
    tags: invocation.tags,
  });

  // Send to error tracking service
  errorTracker.captureException(invocation.stage.error, {
    tags: invocation.tags,
    extra: { operation: invocation.key.operation, args: invocation.args, duration: invocation.stage.duration },
  });
});
```

### Performance Optimization

```ts
import { createInvocationTracker } from 'emitnlog/tracker';

const tracker = createInvocationTracker();

// Only track in development/staging
const trackFunction =
  process.env.NODE_ENV === 'production'
    ? <T extends (...args: any[]) => any>(name: string, fn: T) => fn
    : tracker.track.bind(tracker);

// Usage remains the same
const processData = trackFunction('processData', (data) => {
  // Processing logic
});
```

### Integration with Logging

```ts
import { createInvocationTracker } from 'emitnlog/tracker';
import { createConsoleLogLogger } from 'emitnlog/logger';

const logger = createConsoleLogLogger();
const tracker = createInvocationTracker({ logger });

// Automatic logging is enabled
tracker.onCompleted((invocation) => {
  logger.i`${invocation.key.operation} completed in ${invocation.stage.duration}ms`;
});

tracker.onErrored((invocation) => {
  logger.e`${invocation.key.operation} failed after ${invocation.stage.duration}ms: ${invocation.stage.error}`;
});
```

---

[← Back to main README](../../README.md)
