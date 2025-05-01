/**
 * A promise that can be resolved or rejected by external clients.
 *
 * @template T - The type of the promise's value.
 */
export type DeferredValue<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
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
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
};
