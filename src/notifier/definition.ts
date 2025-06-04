/**
 * A type-safe event notifier that manages event listeners and notifications.
 *
 * @template T The type of events this notifier will handle
 * @template E The type of error that can be handled (defaults to Error)
 *
 *   EventNotifier provides:
 *
 *   - Type-safe event subscriptions via `onEvent`
 *   - Synchronized event notifications via `notify`
 *   - Automatic cleanup of resources via `close`
 *   - Status tracking via `active` property
 *   - Error handling via optional error callback
 */
export type EventNotifier<T = void, E = Error> = {
  /**
   * Registers a listener function to be called when events are notified. Listeners are notified in the order they were
   * registered.
   *
   * @example
   *
   * ```ts
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
   * @returns A closeable to unregister the listener (all listeners are unregistered when the notifier is closed).
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
   * - Never rejects
   * - Does not interfere with existing listeners. Moreover, the promise is resolved after the listeners are notified.
   *
   * It is important to notice that the returned promise is tied to a single event: to wait for a subsequent event after
   * the returned promise is settled, call `waitForEvent()` again. Also, avoid caching the returned promise unless the
   * intent is to observe only the next event.
   *
   * @example Basic usage
   *
   * ```ts
   * const notifier = createEventNotifier<string>();
   *
   * const event = await notifier.waitForEvent();
   * console.log(`Received event: ${event}`);
   * ```
   *
   * @example Using in a loop
   *
   * ```ts
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
   * - Does nothing if there are no listeners
   * - If the event is a function, it will be called if there are listeners and its return value will be used as the
   *   event.
   *
   * @example
   *
   * ```ts
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
  readonly notify: (event: T | (() => T)) => void;

  /**
   * Sets the error handler for the notifier, to be called whenever a listener throws an error.
   *
   * @param handler A function that will be called with any errors thrown by listeners.
   */
  readonly onError: (handler: (error: E) => void) => void;

  /**
   * Closes the notifier and removes all listeners.
   *
   * @warning Failing to call close() on subscriptions or the notifier itself may lead to memory leaks.
   */
  readonly close: () => void;
};

/**
 * A type-safe event subscription that can be closed.
 *
 * @template T The type of events this subscription will handle
 */
export type OnEvent<T = void> = (listener: (event: T) => unknown) => { readonly close: () => void };
