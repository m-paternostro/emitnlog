/**
 * A value the exposes a promise that can be resolved or rejected by external clients.
 *
 * Clients should cache the DeferredValue instance itself rather than its properties (like `promise`). This enables
 * proper usage of features like `renew()`, which may creates a new internal promise.
 *
 * @template T - The type of the promise's value.
 */
export interface DeferredValue<T> {
  /**
   * The promise that can be resolved or rejected.
   */
  readonly promise: Promise<T>;

  /**
   * Whether the promise has been resolved.
   */
  readonly resolved: boolean;

  /**
   * Whether the promise has been rejected.
   */
  readonly rejected: boolean;

  /**
   * Whether the promise has been settled, i.e., if it has been resolved or rejected.
   */
  readonly settled: boolean;

  /**
   * Resolves the deferred value's promise with a value. Calling this method has no effect if the deferred value is
   * already settled.
   */
  readonly resolve: (value: T | PromiseLike<T>) => void;

  /**
   * Rejects the deferred value's promise with a reason. Calling this method has no effect if the deferred value is
   * already settled.
   */
  readonly reject: (reason?: unknown) => void;

  /**
   * Resets a settled (i.e., resolved or rejected) promise to an unsettled state, allowing the same deferred value
   * instance to be used in a new asynchronous operation after the previous one has completed. Calling this method has
   * no effect if the deferred value is not settled (i.e., if its promise is neither resolved nor rejected.)
   *
   * @example Reusing a deferred value
   *
   * ```ts
   * import { createDeferredValue } from 'emitnlog/utils';
   *
   * const deferred = createDeferredValue<string>();
   *
   * // First use
   * deferred.resolve('first');
   * await deferred.promise; // resolves to "first"
   *
   * // Renew for second use
   * deferred.renew();
   * deferred.resolve('second');
   * await deferred.promise; // resolves to "second"
   * ```
   *
   * @example Chainable usage
   *
   * ```ts
   * import { createDeferredValue } from 'emitnlog/utils';
   *
   * const deferred = createDeferredValue<number>();
   * deferred.resolve(1);
   * await deferred.promise;
   *
   * // Chain renew and resolve
   * deferred.renew().resolve(2);
   * await deferred.promise; // resolves to 2
   * ```
   *
   * @returns The same deferred value instance, allowing for method chaining.
   */
  readonly renew: () => this;
}

/**
 * Creates deferred value that exposes a promise that can be resolved or rejected by external clients. This is useful
 * for scenarios where you need to control when a promise resolves or rejects from outside the promise's executor
 * function, such as in event-driven architectures, manual coordination of asynchronous operations, or implementing
 * custom waiting mechanisms.
 *
 * Clients should cache the DeferredValue instance itself rather than destructuring its properties (like `promise`).
 * This ensures proper usage of features like `renew()`, which may creates a new internal promise.
 *
 * @example Basic usage
 *
 * ```ts
 * // Create a deferred value to be resolved later
 * const deferred = createDeferredValue<string>();
 *
 * // Pass the promise to consumers that need to wait for the value
 * function waitForValue(): Promise<string> {
 *   return deferred.promise;
 * }
 *
 * // Later, resolve the promise when the value becomes available
 * function provideValue(value: string): void {
 *   deferred.resolve(value);
 * }
 * ```
 *
 * @example Using with event listeners
 *
 * ```ts
 * // Create a deferred that will be resolved when an event occurs
 * function waitForEvent(notifier: EventNotifier, eventName: string): Promise<any> {
 *   const deferred = createDeferredValue<any>();
 *
 *   const handler = (data: any) => {
 *     deferred.resolve(data);
 *     emitter.off(eventName, handler);
 *   };
 *
 *   notifier.onEvent(eventName, handler);
 *   return deferred.promise;
 * }
 * ```
 *
 * @template T The type of value that the promise will resolve to.
 * @returns An object containing the promise and functions to resolve or reject it.
 */
export const createDeferredValue = <T = void>(): DeferredValue<T> => {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: unknown) => void;

  let resolved = false;
  let rejected = false;

  const createPromise = () =>
    new Promise<T>((res, rej) => {
      resolve = (value) => {
        if (resolved || rejected) {
          return;
        }

        resolved = true;
        res(value);
      };

      reject = (reason) => {
        if (resolved || rejected) {
          return;
        }

        rejected = true;
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        rej(reason);
      };
    });

  let promise = createPromise();

  const deferred: DeferredValue<T> = {
    get promise() {
      return promise;
    },

    get resolved() {
      return resolved;
    },

    get rejected() {
      return rejected;
    },

    get settled() {
      return resolved || rejected;
    },

    resolve: (value) => {
      resolve!(value);
    },

    reject: (reason) => {
      reject!(reason);
    },

    renew: () => {
      if (deferred.settled) {
        resolved = false;
        rejected = false;

        promise = createPromise();
      }

      return deferred;
    },
  };

  return deferred;
};
