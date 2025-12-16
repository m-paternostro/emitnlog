# Event Notifier Documentation

A simple way to implement observable patterns. Listeners only get notified when something happens — and only if they're subscribed.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Lazy Notifications](#lazy-notifications)
- [Promise-based Event Waiting](#promise-based-event-waiting)
- [Debounced Notifications](#debounced-notifications)
- [Event Notifier Options](#event-notifier-options)
- [Event Mapping and Filtering](#event-mapping-and-filtering)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)

## Basic Usage

Create an event notifier, subscribe to events, and emit notifications:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<string>();

const subscription = notifier.onEvent((msg) => {
  console.log(`Received: ${msg}`);
});

notifier.notify('Hello!');
subscription.close();
```

### Multiple Listeners

You can have multiple listeners for the same event notifier:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<{ user: string; action: string }>();

// First listener for logging
const logSubscription = notifier.onEvent(({ user, action }) => {
  console.log(`User ${user} performed: ${action}`);
});

// Second listener for analytics
const analyticsSubscription = notifier.onEvent(({ user, action }) => {
  analytics.track('user_action', { user, action });
});

// Notify all listeners
notifier.notify({ user: 'Alice', action: 'login' });

// Clean up subscriptions
logSubscription.close();
analyticsSubscription.close();
```

## Lazy Notifications

Notifications support lazy evaluation - the notification function is only called if there are active listeners:

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

### Lazy Evaluation Benefits

Lazy evaluation is particularly useful for expensive operations:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const progressNotifier = createEventNotifier<{ progress: number; details: string }>();

// Expensive operation that only runs when needed
progressNotifier.notify(() => {
  const expensiveDetails = generateDetailedProgressReport(); // Only called if listeners exist
  return { progress: 75, details: expensiveDetails };
});
```

## Promise-based Event Waiting

Use `waitForEvent()` to get a Promise that resolves when the next event occurs, without interfering with subscribed listeners. The promise only rejects if the notifier is closed before the next event is emitted - in this case it rejects with a `ClosedError`.

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
```

### Important Note About Concurrent Waiting

Multiple concurrent `waitForEvent()` calls will all resolve with the same event:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<string>();

// Caution: This doesn't wait for two separate events!
// Both promises resolve with the same event
async function incorrectUsage() {
  const [event1, event2] = await Promise.all([notifier.waitForEvent(), notifier.waitForEvent()]);
  // event1 and event2 will be identical
}
```

### Combining Subscriptions and Waiting

You can combine regular subscriptions with promise-based waiting:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const statusNotifier = createEventNotifier<'connecting' | 'connected' | 'disconnected'>();

// Regular subscription for logging
const logSubscription = statusNotifier.onEvent((status) => {
  console.log(`Status changed to: ${status}`);
});

// Wait for connection
async function waitForConnection() {
  let status = await statusNotifier.waitForEvent();

  while (status !== 'connected') {
    status = await statusNotifier.waitForEvent();
  }

  console.log('Successfully connected!');
}

// Both the subscription and the waiting will receive events
statusNotifier.notify('connecting');
statusNotifier.notify('connected');

### Closing Behavior

- `waitForEvent()` will reject with an error if `close()` is called before the next event occurs.
- After closing, you can still call `waitForEvent()` again; a new internal waiter will be created and the next `notify()` will resolve it.

### Lazy Evaluation Nuance

If you call `notify()` with a function, it will only be executed when there are active listeners or a pending waiter created by `waitForEvent()`. This ensures lazy computations still happen when someone is awaiting the next event, even if no listeners are registered.
```

## Debounced Notifications

The notifier can be created with a debounced delay for scenarios where events are notified too quickly:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

// Create a debounced notifier with 300ms delay
const debouncedNotifier = createEventNotifier<string>({ debounceDelay: 300 });

const subscription = debouncedNotifier.onEvent((msg) => {
  console.log(`Debounced message: ${msg}`);
});

// Rapid notifications - only the last one will be emitted
debouncedNotifier.notify('First message');
debouncedNotifier.notify('Second message');
debouncedNotifier.notify('Third message');
// After 300ms: Only "Third message" will be logged

subscription.close();
```

### Debounced Notifications with Lazy Evaluation

Debouncing works seamlessly with lazy evaluation:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const searchNotifier = createEventNotifier<string>({ debounceDelay: 500 });

searchNotifier.onEvent((query) => {
  // This will only be called after 500ms of inactivity
  performSearch(query);
});

// Simulate rapid typing
searchNotifier.notify(() => {
  console.log('Computing search for "h"'); // Won't execute
  return 'h';
});

searchNotifier.notify(() => {
  console.log('Computing search for "he"'); // Won't execute
  return 'he';
});

searchNotifier.notify(() => {
  console.log('Computing search for "hello"'); // Will execute after 500ms
  return 'hello';
});
```

## Event Notifier Options

Configure behavior when creating the notifier:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<string>({
  debounceDelay: 100,
  onError: (error) => {
    errorTracker.captureException(error);
  },
  onChange: ({ active, reason }) => {
    console.log(`notifier is ${active ? 'active' : 'idle'} because of ${reason}`);
  },
});
```

### Option Reference

- `debounceDelay?: number` — Debounces notifications so rapid calls collapse into the last event after the specified delay (milliseconds). Both listeners and `waitForEvent()` receive the debounced value.
- `onError?: (error: unknown) => void` — Called whenever a listener throws synchronously or returns a promise that later rejects. Errors thrown by the handler are ignored so notification flow continues uninterrupted.
- `onChange?: (event: { active?: boolean; reason: ChangeReason }) => void` — Notifies you whenever the notifier state changes. `reason` is one of `listener-added`, `listener-removed`, `waiter-added`, `waiter-resolved`, or `closed`. `active` tells you whether at least one listener or waiter exists after the transition.

Both callbacks are optional; omit them if you do not need centralized hooks. They remain in effect even if the notifier is closed and re-used later.

## Event Mapping and Filtering

The `mapOnEvent` function allows you to transform and filter events from existing notifiers, creating new event streams with different types or conditional logic.

Note: If a mapper throws, the error is reported via the source notifier's `onError` option (if provided). Mappers run inside the source listener context.

### Basic Event Mapping

```ts
import { createEventNotifier, mapOnEvent, SKIP_MAPPED_EVENT } from 'emitnlog/notifier';

// Original notifier with raw storage events
const storageNotifier = createEventNotifier<{ action: string; data: unknown }>();

// Map to user-specific events
const userEvents = mapOnEvent(storageNotifier.onEvent, (event) => {
  if (event.action === 'user_created') {
    return { type: 'user_created' as const, userId: event.data.id, timestamp: new Date() };
  }
  if (event.action === 'user_updated') {
    return { type: 'user_updated' as const, userId: event.data.id, changes: event.data.changes };
  }
  // Skip other events
  return SKIP_MAPPED_EVENT;
});

// Subscribe to the mapped events
const subscription = userEvents((userEvent) => {
  console.log(`User event: ${userEvent.type} for user ${userEvent.userId}`);
});
```

### Conditional Event Filtering

Use `SKIP_MAPPED_EVENT` to filter out events you don't want to pass to listeners:

```ts
import { createEventNotifier, mapOnEvent, SKIP_MAPPED_EVENT } from 'emitnlog/notifier';

const systemNotifier = createEventNotifier<{ level: string; message: string }>();

// Only pass through error and warning events
const errorEvents = mapOnEvent(systemNotifier.onEvent, (event) => {
  if (event.level === 'error' || event.level === 'warning') {
    return event; // Pass through
  }
  return SKIP_MAPPED_EVENT; // Skip info/debug events
});

errorEvents((event) => {
  console.error(`${event.level.toUpperCase()}: ${event.message}`);
});

// These will be passed through
systemNotifier.notify({ level: 'error', message: 'Database connection lost' });
systemNotifier.notify({ level: 'warning', message: 'High memory usage' });

// This will be skipped
systemNotifier.notify({ level: 'info', message: 'User logged in' });
```

### Creating Derived Event Streams

You can create multiple derived event streams from a single source:

```ts
import { createEventNotifier, mapOnEvent, SKIP_MAPPED_EVENT } from 'emitnlog/notifier';

interface ApiEvent {
  method: string;
  path: string;
  status: number;
  duration: number;
}

const apiNotifier = createEventNotifier<ApiEvent>();

// Create error-specific events
const errorEvents = mapOnEvent(apiNotifier.onEvent, (event) => {
  if (event.status >= 400) {
    return { error: true, status: event.status, endpoint: `${event.method} ${event.path}`, duration: event.duration };
  }
  return SKIP_MAPPED_EVENT;
});

// Create slow request events
const slowRequestEvents = mapOnEvent(apiNotifier.onEvent, (event) => {
  if (event.duration > 1000) {
    return { slow: true, endpoint: `${event.method} ${event.path}`, duration: event.duration };
  }
  return SKIP_MAPPED_EVENT;
});

// Subscribe to different event types
errorEvents((event) => {
  console.error(`API Error ${event.status}: ${event.endpoint}`);
});

slowRequestEvents((event) => {
  console.warn(`Slow request: ${event.endpoint} took ${event.duration}ms`);
});
```

## Advanced Usage

### Typed Event Notifiers

You can create strongly-typed event notifiers for complex data structures:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

interface UserEvent {
  userId: string;
  action: 'login' | 'logout' | 'update';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const userNotifier = createEventNotifier<UserEvent>();

userNotifier.onEvent((event) => {
  // TypeScript knows the exact shape of the event
  console.log(`User ${event.userId} performed ${event.action} at ${event.timestamp}`);

  if (event.metadata) {
    console.log('Additional metadata:', event.metadata);
  }
});

userNotifier.notify({ userId: 'user123', action: 'login', timestamp: new Date(), metadata: { source: 'web' } });
```

### Event Processing

You can implement conditional logic in your event handlers:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const errorNotifier = createEventNotifier<Error>();

errorNotifier.onEvent((error) => {
  if (error.message.includes('network')) {
    handleNetworkError(error);
  } else {
    handleGenericError(error);
  }
});

// You can conditionally call notify based on your logic
function notifyError(error: Error) {
  if (error.message.includes('CRITICAL')) {
    errorNotifier.notify(error); // Only notify for critical errors
  }
  // Non-critical errors are simply not notified
}
```

### Event Notifier Cleanup

Always clean up subscriptions to prevent memory leaks:

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<string>();

class EventManager {
  private subscriptions: Array<{ close(): void }> = [];

  addSubscription(handler: (event: string) => void) {
    const subscription = notifier.onEvent(handler);
    this.subscriptions.push(subscription);
    return subscription;
  }

  cleanup() {
    this.subscriptions.forEach((sub) => sub.close());
    this.subscriptions = [];
  }
}

const manager = new EventManager();
manager.addSubscription((msg) => console.log(msg));

// Later, clean up all subscriptions
manager.cleanup();
```

## Best Practices

### 1. Use Lazy Evaluation for Expensive Operations

```ts
// Good: Expensive operation only runs when needed
notifier.notify(() => {
  const expensiveData = computeExpensiveData();
  return { data: expensiveData, timestamp: Date.now() };
});

// Less optimal: Always computes expensive data
const expensiveData = computeExpensiveData();
notifier.notify({ data: expensiveData, timestamp: Date.now() });
```

### 2. Clean Up Subscriptions

```ts
// Good: Clean up subscriptions
const subscription = notifier.onEvent(handler);
// ... later
subscription.close();

// Use try-finally or similar patterns for guaranteed cleanup
try {
  const subscription = notifier.onEvent(handler);
  // ... do work
} finally {
  subscription.close();
}
```

### 3. Use Debouncing for Rapid Events

```ts
// Good: Debounce rapid UI events
const searchNotifier = createEventNotifier<string>({ debounceDelay: 300 });

searchNotifier.onEvent((query) => {
  performSearch(query); // Only called after user stops typing
});

// Input handler
function onSearchInput(event: InputEvent) {
  const query = (event.target as HTMLInputElement).value;
  searchNotifier.notify(query);
}
```

### 4. Use Strong Types

```ts
// Good: Strongly typed events
interface AppEvent {
  type: 'user_action' | 'system_event';
  data: unknown;
  timestamp: Date;
}

const appNotifier = createEventNotifier<AppEvent>();

// Less optimal: Weak typing
const weakNotifier = createEventNotifier<any>();
```

### 5. Handle Errors Gracefully

```ts
import { createEventNotifier } from 'emitnlog/notifier';

const notifier = createEventNotifier<string>();

// Good: Handle errors in listeners
notifier.onEvent((msg) => {
  try {
    processMessage(msg);
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Good: Handle errors in lazy notifications
notifier.notify(() => {
  try {
    return computeComplexData();
  } catch (error) {
    console.error('Error computing data:', error);
    return 'fallback data';
  }
});
```

### 6. Use Meaningful Event Types

```ts
// Good: Descriptive event types
interface DatabaseEvent {
  operation: 'insert' | 'update' | 'delete';
  table: string;
  recordId: string;
  success: boolean;
}

const dbNotifier = createEventNotifier<DatabaseEvent>();

// Less optimal: Generic events
const genericNotifier = createEventNotifier<{ type: string; data: unknown }>();
```

### 7. Use mapOnEvent for Conditional Notifications

For conditional event filtering and transformation, use `mapOnEvent` rather than complex logic in listeners:

```ts
import { createEventNotifier, mapOnEvent, SKIP_MAPPED_EVENT } from 'emitnlog/notifier';

// Good: Use mapOnEvent for filtering
const rawEvents = createEventNotifier<{ severity: string; message: string }>();
const criticalEvents = mapOnEvent(rawEvents.onEvent, (event) => {
  if (event.severity === 'critical') {
    return { message: event.message, timestamp: new Date() };
  }
  return SKIP_MAPPED_EVENT;
});

criticalEvents((event) => {
  sendAlert(event.message);
});

// Less optimal: Complex filtering in listeners
rawEvents.onEvent((event) => {
  if (event.severity === 'critical') {
    sendAlert(event.message);
  }
  // Other severities are processed but ignored
});
```

---

[← Back to main README](../README.md)
