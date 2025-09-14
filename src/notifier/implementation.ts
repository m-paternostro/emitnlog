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
 * @template E Optional error type (defaults to Error).
 * @param options Optional configuration including debounce delay.
 * @returns An EventNotifier that supports listener registration, notification, and error handling.
 */
export const createEventNotifier = <T = void, E = Error>(options?: {
  readonly debounceDelay?: number;
}): EventNotifier<T, E> => {
  const listeners = new Set<(event: T) => unknown>();
  let errorHandler: ((error: E) => void) | undefined;
  let deferredEvent: DeferredValue<T> | undefined;

  const basicNotify = (event?: T | (() => T)) => {
    if (!listeners.size && !deferredEvent) {
      return;
    }

    const value: T = typeof event === 'function' ? (event as () => T)() : (event as T);

    for (const listener of listeners) {
      try {
        void listener(value);
      } catch (error) {
        if (errorHandler) {
          try {
            errorHandler(error as E);
          } catch {
            // ignore
          }
        }
      }
    }

    if (deferredEvent) {
      deferredEvent.resolve(value);
      deferredEvent = undefined;
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

      errorHandler = undefined;
    },

    onEvent: (listener) => {
      listeners.add(listener);
      return {
        close: () => {
          listeners.delete(listener);
        },
      };
    },

    waitForEvent: () => (deferredEvent || (deferredEvent = createDeferredValue<T>())).promise,

    notify,

    onError: (handler) => {
      errorHandler = handler;
    },
  };
};
