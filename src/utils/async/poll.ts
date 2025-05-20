import type { Logger } from '../../logger/definition.ts';
import { OFF_LOGGER } from '../../logger/off-logger.ts';
import { createDeferredValue } from './deferred-value.ts';
import { delay } from './delay.ts';

/**
 * Configuration options for polling operations.
 *
 * @template T The type of value that the polling operation returns
 * @template V The type of value to return when a timeout occurs
 */
export type PollingOptions<T, V> = {
  /**
   * Whether to invoke the operation immediately or instead wait for the first interval.
   */
  readonly invokeImmediately?: boolean;

  /**
   * Maximum time in milliseconds to poll before auto-stopping.
   */
  readonly timeout?: number;

  /**
   * Value to return when a timeout occurs.
   */
  readonly timeoutValue?: V;

  /**
   * Maximum number of times to call the operation before auto-stopping.
   */
  readonly retryLimit?: number;

  /**
   * Function that evaluates each result and returns true if polling should stop.
   *
   * @param result The result returned by the operation
   * @param invocationIndex The current invocation count (0-based)
   * @returns `true` to stop polling, `false` to continue
   */
  readonly interrupt?: (result: T, invocationIndex: number) => boolean;

  /**
   * Logger to capture polling events and errors.
   */
  readonly logger?: Logger;
};

/**
 * Polls a function at regular intervals until a condition is met, a timeout occurs, maximum retries are reached, or
 * it's manually stopped. Returns both a method to stop polling and a promise that resolves with the last result.
 *
 * The polling operation handles both synchronous and asynchronous (Promise-returning) functions. If the operation
 * throws an error or rejects, polling continues but the error is logged. If a previous asynchronous operation is still
 * resolving when the next interval occurs, that polling iteration is skipped.
 *
 * @example Simple polling at regular intervals
 *
 * ```ts
 * // Poll every 5 seconds until manually stopped
 * const closeable = startPolling(() => fetchLatestData(), 5_000);
 *
 * // Stop polling after 30 seconds
 * await delay(30_000).then(close);
 *
 * // Get the final result
 * const finalData = await wait;
 * ```
 *
 * @example Basic polling until a condition is met
 *
 * ```ts
 * const { wait, close } = startPolling(() => fetchStatus(), 1000, {
 *   interrupt: (status) => status === 'completed',
 * });
 *
 * // Later get the final result
 * const finalStatus = await wait;
 * ```
 *
 * @example Polling with timeout
 *
 * ```ts
 * const { wait } = startPolling(() => checkJobStatus(jobId), 2000, {
 *   timeout: 30000, // Stop after 30 seconds
 *   interrupt: (status) => ['completed', 'failed'].includes(status),
 *   logger: console,
 * });
 *
 * const finalStatus = await wait;
 * if (finalStatus === 'completed') {
 *   // Job finished successfully
 * } else {
 *   // Either timed out or job failed
 * }
 * ```
 *
 * @example Polling with maximum retries
 *
 * ```ts
 * const { wait } = startPolling(() => checkJobStatus(jobId), 2000, {
 *   retryLimit: 5, // Stop after 5 attempts
 *   logger: console,
 * });
 *
 * const finalStatus = await wait;
 * ```
 *
 * @example Manual control of polling
 *
 * ```ts
 * const poll = startPolling(() => fetchDataPoints(), 5000);
 *
 * // Stop polling after some external event
 * eventEmitter.on('stop-polling', () => {
 *   poll.close();
 * });
 *
 * // Get the last result when polling stops
 * const lastDataPoints = await poll.wait;
 * ```
 *
 * @param operation Function to execute on each poll interval. Can return a value or a Promise.
 * @param interval Time in milliseconds between poll attempts
 * @param options Optional configuration for polling behavior
 * @returns An object with a `close()` method to manually stop polling and a `wait` Promise that resolves with the last
 *   result when polling stops
 */
export const startPolling = <T, const V = undefined>(
  operation: () => T | Promise<T>,
  interval: number,
  options?: PollingOptions<T, V>,
): { readonly wait: Promise<T | V | undefined>; readonly close: () => Promise<void> } => {
  const deferred = createDeferredValue<T | V | undefined>();

  let resolving = false;
  let invocationIndex = -1;
  let active = true;
  let lastResult: T | V | undefined;

  const logger = options?.logger ?? OFF_LOGGER;

  const polledOperation = (): void => {
    if (resolving || !active) {
      return;
    }

    invocationIndex++;

    // Check if we've reached the maximum number of retries
    if (options?.retryLimit !== undefined && invocationIndex >= options.retryLimit) {
      logger.d`emitnlog.poll: reached maximum retries (${options.retryLimit})`;
      void close();
      return;
    }

    try {
      logger.d`emitnlog.poll: invoking the operation for the ${invocationIndex + 1} time`;
      const result = operation();

      if (result instanceof Promise) {
        resolving = true;
        void result
          .then((value) => {
            lastResult = value;

            if (options?.interrupt && options.interrupt(value, invocationIndex)) {
              void close();
            }
          })
          .catch((error: unknown) => {
            logger.args(error).e`emitnlog.poll: the operation rejected with an error: ${error}`;
          })
          .finally(() => {
            resolving = false;
          });

        return;
      }

      lastResult = result;

      if (options?.interrupt && options.interrupt(result, invocationIndex)) {
        void close();
        return;
      }
    } catch (error) {
      logger.args(error).e`emitnlog.poll: the operation threw an error: ${error}`;
    }
  };

  const close = async (): Promise<void> => {
    if (active) {
      active = false;

      logger.d`emitnlog.poll: closing the poll after ${invocationIndex + 1} invocations`;
      clearInterval(intervalId);
      deferred.resolve(lastResult);
    }

    await deferred.promise;
  };

  if (options?.invokeImmediately) {
    polledOperation();

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!active) {
      return { close, wait: deferred.promise };
    }
  }

  const intervalId = setInterval(polledOperation, interval);

  if (options?.timeout && options.timeout >= 0) {
    void delay(options.timeout).then(() => {
      if (active) {
        if ('timeoutValue' in options) {
          lastResult = options.timeoutValue;
        }

        logger.d`emitnlog.poll: timeout for the operation reached after ${options.timeout}ms`;
        void close();
      }
    });
  }

  return { close, wait: deferred.promise };
};
