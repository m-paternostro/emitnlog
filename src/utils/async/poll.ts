import type { Logger } from '../../logger/logger.ts';
import { OFF_LOGGER } from '../../logger/off-logger.ts';
import { createDeferredValue } from './deferred-value.ts';
import { delay } from './delay.ts';

/**
 * Polls a function at regular intervals until a condition is met, a timeout occurs, or it's manually stopped. Returns
 * both a method to stop polling and a promise that resolves with the last result.
 *
 * The polling operation handles both synchronous and asynchronous (Promise-returning) functions. If the operation
 * throws an error or rejects, polling continues but the error is logged. If a previous asynchronous operation is still
 * resolving when the next interval occurs, that polling iteration is skipped.
 *
 * @example Simple polling at regular intervals
 *
 * ```ts
 * // Poll every 5 seconds until manually stopped
 * const closeable = poll(() => fetchLatestData(), 5_000);
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
 * const { wait, close } = poll(() => fetchStatus(), 1000, { interrupt: (status) => status === 'completed' });
 *
 * // Later get the final result
 * const finalStatus = await wait;
 * ```
 *
 * @example Polling with timeout
 *
 * ```ts
 * const { wait } = poll(() => checkJobStatus(jobId), 2000, {
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
 * @example Manual control of polling
 *
 * ```ts
 * const poller = poll(() => fetchDataPoints(), 5000);
 *
 * // Stop polling after some external event
 * eventEmitter.on('stop-polling', () => {
 *   poller.close();
 * });
 *
 * // Get the last result when polling stops
 * const lastDataPoints = await poller.wait;
 * ```
 *
 * @param operation Function to execute on each poll interval. Can return a value or a Promise.
 * @param interval Time in milliseconds between poll attempts
 * @param options Optional configuration
 * @param options.invokeImmediately Whether to invoke the operation immediately or instead wait for the first interval
 * @param options.timeout Maximum time in milliseconds to poll before auto-stopping
 * @param options.interrupt Function that evaluates each result and returns true if polling should stop
 * @param options.logger Logger to capture polling events and errors
 * @returns An object with a `close()` method to manually stop polling and a `wait` Promise that resolves with the last
 *   result when polling stops
 */
export const poll = <T, const V = undefined>(
  operation: () => T | Promise<T>,
  interval: number,
  options?: {
    readonly invokeImmediately?: boolean;
    readonly timeout?: number;
    readonly timeoutValue?: V;
    readonly interrupt?: (result: unknown) => boolean;
    readonly logger?: Logger;
  },
): { readonly wait: Promise<T | V | undefined>; readonly close: () => Promise<void> } => {
  const deferred = createDeferredValue<T | V | undefined>();

  let resolving = false;
  let invocations = 0;
  let active = true;
  let lastResult: T | V | undefined;

  const logger = options?.logger ?? OFF_LOGGER;

  const polledOperation = (): void => {
    if (resolving || !active) {
      return;
    }

    invocations++;
    try {
      logger.d`emitnlog.poll: invoking the operation for the ${invocations} time`;
      const result = operation();

      if (result instanceof Promise) {
        resolving = true;
        void result
          .then((value) => {
            lastResult = value;

            if (options?.interrupt && options.interrupt(value)) {
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

      if (options?.interrupt && options.interrupt(result)) {
        void close();
        return;
      }
    } catch (error) {
      logger.args(error).e`emitnlog.poll: the operation threw an error: ${error}`;
    }
  };

  const close = (): Promise<void> => {
    if (active) {
      active = false;

      logger.d`emitnlog.poll: closing the poll after ${invocations} invocations`;
      clearInterval(intervalId);
      deferred.resolve(lastResult);
    }
    return deferred.promise.then(() => undefined);
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
