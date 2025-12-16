import type { SyncClosable } from '../utils/common/closable.ts';

/**
 * A type-safe event notifier that manages event listeners and notifications.
 *
 * @template T The type of events this notifier will handle
 *
 *   EventNotifier provides:
 *
 *   - Type-safe event subscriptions via `onEvent`
 *   - Synchronized event notifications via `notify`
 *   - Automatic cleanup of resources via `close`
 */
export type EventNotifier<T = void> = {
  /**
   * Registers a listener function to be called when events are notified. Listeners are notified in the order they were
   * registered.
   *
   * @example
   *
   * ```ts
   * import { createEventNotifier } from 'emitnlog/notifier';
   *
   * const notifier = createEventNotifier<string>();
   * const subscription = notifier.onEvent((message) => {
   *   console.log(`Received message: ${message}`);
   * });
   *
   * // Later, to stop listening:
   * subscription.close();
   * ```
   *
   * @param listener A function that will be called with the notified event
   * @returns A closable to unregister the listener (all listeners are unregistered when the notifier is closed).
   */
  readonly onEvent: OnEvent<T>;

  /**
   * Returns a promise that resolves to the next event notified by this notifier.
   *
   * This method allows clients to await a single event without registering a persistent listener. It is especially
   * useful in scenarios where the client prefers a promise-based flow or only needs to observe the next occurrence of
   * an event.
   *
   * The returned promise:
   *
   * - Resolves with the next notified event
   * - Does not interfere with existing listeners. Moreover, the promise is resolved after the listeners are notified.
   * - Only rejects if the notifier is closed before a notified event - in this case the promise rejects with a
   *   `emitnlog/utils/ClosedError`.
   *
   * It is important to notice that the returned promise is tied to a single event: to wait for a subsequent event after
   * the returned promise is settled, call `waitForEvent()` again. Also, avoid caching the returned promise unless the
   * intent is to observe only the next event.
   *
   * @example Basic usage
   *
   * ```ts
   * import { createEventNotifier } from 'emitnlog/notifier';
   *
   * const notifier = createEventNotifier<string>();
   *
   * const event = await notifier.waitForEvent();
   * console.log(`Received event: ${event}`);
   * ```
   *
   * @example Using in a loop
   *
   * ```ts
   * import type { EventNotifier } from 'emitnlog/notifier';
   *
   * async function logNext5(notifier: EventNotifier<string>) {
   *   for (let i = 0; i < 5; i++) {
   *     const value = await notifier.waitForEvent();
   *     console.log(`Received #${i + 1}:`, value);
   *   }
   * }
   * ```
   *
   * @returns A promise that resolves to the next event.
   */
  readonly waitForEvent: () => Promise<T>;

  /**
   * Notifies all registered listeners with the provided event.
   *
   * This method:
   *
   * - Calls all registered listeners with the event in their registration order
   * - Ignores errors thrown by listeners (they won't affect other listeners)
   * - Ignores returned promises (results are not awaited)
   * - Does nothing if there are no listeners and no pending waiters (created via `waitForEvent()`)
   * - If the event is a function, it will be called if there are listeners or a pending waiter, and its return value will
   *   be used as the event.
   * - When `T` is `void`, `notify()` can be called without arguments.
   *
   * @example
   *
   * ```ts
   * import { createEventNotifier } from 'emitnlog/notifier';
   *
   * const notifier = createEventNotifier<{ type: string; value: number }>();
   * notifier.onEvent((event) => {
   *   console.log(`Received ${event.type} with value:`, event.value);
   * });
   *
   * notifier.notify({ type: 'progress', value: 75 });
   * ```
   *
   * @param event The event to send to all listeners or a function that returns such event.
   */
  readonly notify: Notify<T>;

  /**
   * Closes the notifier and removes all listeners.
   *
   * @warning Failing to call `close()` on subscriptions or the notifier itself may lead to memory leaks.
   */
  readonly close: () => void;
};

/**
 * A type-safe event subscription that can be closed.
 *
 * @template T The type of events this subscription will handle
 * @param listener A function that will be called with the notified event
 * @returns A closable to unregister the listener (all listeners are unregistered when the notifier is closed).
 */
export type OnEvent<T = void> = (listener: (event: T) => unknown) => SyncClosable;

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type IsExactlyVoid<T> = [T] extends [void] ? ([void] extends [T] ? true : false) : false;
type Notify<T> = IsExactlyVoid<T> extends true ? (event?: T | (() => T)) => void : (event: T | (() => T)) => void;
