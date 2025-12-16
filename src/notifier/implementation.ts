import { debounce } from '../utils/async/debounce.ts';
import type { DeferredValue } from '../utils/async/deferred-value.ts';
import { createDeferredValue } from '../utils/async/deferred-value.ts';
import { ClosedError } from '../utils/common/closed-error.ts';
import type { EventNotifier } from './definition.ts';

/**
 * Creates a type-safe event notifier.
 *
 * This utility helps you implement observable patterns in a lightweight way.
 *
 * The typical usage pattern is:
 *
 * - Create a private notifier using `createEventNotifier()`
 * - Expose a public `onEvent` method so clients can register listeners
 * - Use notify to emit events when something happens and listeners are registered.
 * - Optionally handle listener errors using `onError`
 * - Optionally observe lifecycle changes (listener/waiter activity or closure) using `onChange`
 *
 * All listeners are automatically cleaned up via the returned `close()` methods.
 *
 * When `debounceDelay` is specified, rapid successive calls to `notify()` will be debounced, ensuring that all
 * listeners (and `waitForEvent()`) receive only the final event after the delay period. This is useful for scenarios
 * like file watching, user input handling, or batching rapid state changes. For more complex debouncing needs (argument
 * accumulation, leading edge execution, etc.), consider using the `debounce` utility directly on your notification
 * logic.
 *
 * @example Basic usage
 *
 * ```ts
 * import { createEventNotifier } from 'emitnlog/notifier';
 *
 * class Car {
 *   private _onStartNotifier = createEventNotifier<{ mileage: number }>();
 *   public onStart = this._onStartNotifier.onEvent;
 *
 *   private _onStopNotifier = createEventNotifier<{ engineOn: boolean }>();
 *   public onStop = this._onStopNotifier.onEvent;
 *
 *   public start() {
 *     // Use lazy evaluation: compute only if someone is listening
 *     this._onStartNotifier.notify(() => ({ mileage: this.computeMileage() }));
 *   }
 *
 *   public stop() {
 *     this._onStopNotifier.notify({ engineOn: this.isRunning() });
 *   }
 *
 *   private computeMileage(): number {
 *     // expensive computation
 *     return 42;
 *   }
 *
 *   private isRunning(): boolean {
 *     return true;
 *   }
 * }
 *
 * const car = new Car();
 *
 * const startListener = car.onStart((event) => {
 *   console.log(`Car started with mileage ${event.mileage}`);
 * });
 *
 * const stopListener = car.onStop((event) => {
 *   console.log(`Car stopped. Engine on? ${event.engineOn}`);
 * });
 *
 * car.start();
 * car.stop();
 *
 * // Unsubscribe later
 * startListener.close();
 * stopListener.close();
 * ```
 *
 * @example With debounced notifications
 *
 * ```ts
 * import { createEventNotifier } from 'emitnlog/notifier';
 *
 * const fileWatcher = createEventNotifier<{ path: string }>({ debounceDelay: 300 });
 *
 * fileWatcher.onEvent(({ path }) => {
 *   console.log(`File changed: ${path}`);
 * });
 *
 * // Rapid file changes - only the last one triggers listeners
 * fileWatcher.notify({ path: 'file1.txt' });
 * fileWatcher.notify({ path: 'file2.txt' });
 * fileWatcher.notify({ path: 'file3.txt' });
 * // After 300ms: logs "File changed: file3.txt"
 *
 * // waitForEvent also gets the debounced result
 * const finalEvent = await fileWatcher.waitForEvent(); // { path: 'file3.txt' }
 * ```
 *
 * @template T The shape of the event data.
 * @param options Optional configuration including debounce delay.
 * @returns An EventNotifier that supports listener registration, notification, and error handling.
 */
export const createEventNotifier = <T = void>(options?: {
  /**
   * The debounce delay for notifications in milliseconds.
   */
  readonly debounceDelay?: number;

  /**
   * Sets an error handler for the notifier, to be called whenever a listener throws an error.
   *
   * Errors throw by the handler are ignored.
   */
  readonly onError?: (error: unknown) => void;

  /**
   * Sets a handler for the notifier, to be called whenever the notifier state changes.
   *
   * Errors throw by the handler are ignored.
   */
  readonly onChange?: (event: {
    /**
     * Whether the notifier is active, i.e., if there is at least one listener or one wait event.
     */
    readonly active?: boolean;

    /**
     * The reason for the state change.
     */
    readonly reason: ChangeReason;
  }) => void;
}): EventNotifier<T> => {
  const listeners = new Set<(event: T) => unknown>();
  let deferredEvent: DeferredValue<T> | undefined;

  const onChange = options?.onChange;
  const notifyOnChange = onChange
    ? (reason: ChangeReason) => {
        try {
          onChange({ active: Boolean(listeners.size || deferredEvent), reason });
        } catch {
          // ignore
        }
      }
    : undefined;

  const basicNotify = (event?: T | (() => T)) => {
    if (!listeners.size && !deferredEvent) {
      return;
    }

    const value: T = typeof event === 'function' ? (event as () => T)() : (event as T);

    for (const listener of listeners) {
      try {
        const result = listener(value);
        if (result instanceof Promise) {
          void result.catch((error: unknown) => {
            if (options?.onError) {
              try {
                options.onError(error);
              } catch {
                // ignore
              }
            }
          });
        }
      } catch (error) {
        if (options?.onError) {
          try {
            options.onError(error);
          } catch {
            // ignore
          }
        }
      }
    }

    if (deferredEvent) {
      deferredEvent.resolve(value);
      deferredEvent = undefined;
      notifyOnChange?.('waiter-resolved');
    }
  };

  const debounced = options?.debounceDelay !== undefined ? debounce(basicNotify, options.debounceDelay) : undefined;
  const notify: (event?: T | (() => T)) => void = debounced
    ? (event?: T | (() => T)) => {
        void debounced(event);
      }
    : basicNotify;

  return {
    close: () => {
      debounced?.cancel(true);
      listeners.clear();

      if (deferredEvent) {
        deferredEvent.reject(new ClosedError('EventNotifier closed'));
        deferredEvent = undefined;
      }

      notifyOnChange?.('closed');
    },

    onEvent: (listener) => {
      const beforeAddSize = listeners.size;
      listeners.add(listener);
      if (beforeAddSize !== listeners.size) {
        notifyOnChange?.('listener-added');
      }
      return {
        close: () => {
          const beforeDeleteSize = listeners.size;
          listeners.delete(listener);
          if (beforeDeleteSize !== listeners.size) {
            notifyOnChange?.('listener-removed');
          }
        },
      };
    },

    waitForEvent: () => {
      if (!deferredEvent) {
        deferredEvent = createDeferredValue<T>();
        notifyOnChange?.('waiter-added');
      }
      return deferredEvent.promise;
    },

    notify,
  };
};

type ChangeReason = 'listener-added' | 'listener-removed' | 'waiter-added' | 'waiter-resolved' | 'closed';
