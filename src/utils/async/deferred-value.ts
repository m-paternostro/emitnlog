/**
 * A promise that can be resolved or rejected by external clients.
 *
 * @template T - The type of the promise's value.
 */
export type DeferredValue<T> = {
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
   * Whether the promise has been settled.
   */
  readonly settled: boolean;

  /**
   * Resolves the promise with a value.
   */
  readonly resolve: (value: T | PromiseLike<T>) => void;

  /**
   * Rejects the promise with a reason.
   */
  readonly reject: (reason?: unknown) => void;
};

/**
 * Creates a promise that can be resolved or rejected by external clients. This is useful for scenarios where you need
 * to control when a promise resolves or rejects from outside the promise's executor function, such as in event-driven
 * architectures, manual coordination of asynchronous operations, or implementing custom waiting mechanisms.
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
 * function waitForEvent(emitter: EventEmitter, eventName: string): Promise<any> {
 *   const deferred = createDeferredValue<any>();
 *
 *   const handler = (data: any) => {
 *     deferred.resolve(data);
 *     emitter.off(eventName, handler);
 *   };
 *
 *   emitter.on(eventName, handler);
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

  const promise = new Promise<T>((res, rej) => {
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

  return {
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

    resolve: resolve!,

    reject: reject!,
  };
};
