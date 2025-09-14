import { delay } from './delay.ts';

/**
 * Wraps a given promise and resolves with its value if it completes within the specified timeout. If the timeout
 * elapses, the returned promise resolves with a provided fallback value or undefined if no `timeoutValue` is provided.
 *
 * Note: The original promise continues to run in the background even if the timeout occurs. If caching promises,
 * consider caching the original promise instead of the timed one, since it may resolve successfully on a subsequent
 * access. If the original promise is not consumed elsewhere and later rejects, it may trigger an unhandled rejection;
 * consider attaching a `.catch()` to the original or otherwise observing its outcome.
 *
 * @example
 *
 * ```ts
 * import { withTimeout } from 'emitnlog/utils';
 *
 * const promise: Promise<string | undefined> = withTimeout(fetchContent(uri), 5000);
 * const content: string = await promise.then((value) => value ?? '');
 * ```
 *
 * @example
 *
 * ```ts
 * import { withTimeout } from 'emitnlog/utils';
 *
 * const promise: Promise<string | -1> = withTimeout(fetchContent(uri), 5000, -1);
 * const content: string | undefined = await promise.then((value) => (value === -1 ? undefined : value));
 * ```
 *
 * @param promise The promise to be wrapped with a timeout.
 * @param timeout The maximum duration (in milliseconds) to wait before resolving with `timeoutValue`. (0 if negatived,
 *   and ceil if decimal).
 * @param timeoutValue The value to resolve with if the timeout is reached before the promise completes.
 * @returns A promise that resolves with the original promise's value if completed within the timeout, or with
 *   `timeoutValue` otherwise.
 */
export const withTimeout = <T, const R = undefined>(
  promise: Promise<T>,
  timeout: number,
  timeoutValue?: R,
): Promise<T | R> => Promise.race<T | R>([promise, delay(timeout).then(() => timeoutValue as R)]);
