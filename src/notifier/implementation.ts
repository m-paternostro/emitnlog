import type { DeferredValue } from '../utils/async/deferred-value.ts';
import { createDeferredValue } from '../utils/async/deferred-value.ts';
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
 * @example
 *
 * ```ts
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
 * @template T The shape of the event data.
 * @template E Optional error type (defaults to Error).
 * @returns An EventNotifier that supports listener registration, notification, and error handling.
 */
export const createEventNotifier = <T = void, E = Error>(): EventNotifier<T, E> => {
  const listeners = new Set<(event: T) => unknown>();
  let errorHandler: ((error: E) => void) | undefined;
  let deferredEvent: DeferredValue<T> | undefined;

  return {
    close: () => {
      listeners.clear();
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

    notify: (event: T | (() => T)) => {
      if (!listeners.size && !deferredEvent) {
        return;
      }

      if (typeof event === 'function') {
        event = (event as () => T)();
      }

      for (const listener of listeners) {
        try {
          void listener(event);
        } catch (error) {
          if (errorHandler) {
            errorHandler(error as E);
          }
        }
      }

      if (deferredEvent) {
        deferredEvent.resolve(event);
        deferredEvent = undefined;
      }
    },

    onError: (handler) => {
      errorHandler = handler;
    },
  };
};
