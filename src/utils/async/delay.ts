import { CanceledError } from '../common/canceled-error.ts';
import { toNonNegativeInteger } from '../common/duration.ts';
import type { Timeout } from './types.ts';

/**
 * Delays the execution of the code for the specified amount of milliseconds.
 *
 * @example
 *
 * ```ts
 * import { delay } from 'emitnlog/utils';
 *
 * // Wait for 500 milliseconds before continuing
 * await delay(500);
 * console.log('This will be logged after 500ms');
 *
 * // Chain multiple operations with delays
 * async function processWithDelays() {
 *   await step1();
 *   await delay(1000); // 1 second cooldown
 *   await step2();
 *   await delay(2000); // 2 second cooldown
 *   await step3();
 * }
 * ```
 *
 * @param milliseconds The amount of milliseconds to wait (0 if negatived, and ceil if decimal).
 * @returns A promise that resolves after the specified amount of milliseconds.
 */
export const delay = (milliseconds: number): Promise<void> => cancelableDelay(milliseconds).promise;

export type CancelableDelay = Readonly<{ promise: Promise<void>; cancel: () => void }>;

/**
 * Delays the execution of the code for the specified amount of milliseconds, with cancellation support.
 *
 * Invoking the returned `cancel` function causes the promise to reject with a `CanceledError`. This is the only
 * expected case in which the promise can reject.
 *
 * @example
 *
 * ```ts
 * import { CanceledError, cancelableDelay } from 'emitnlog/utils';
 *
 * const { promise, cancel } = cancelableDelay(500);
 * setTimeout(() => cancel(), 250);
 *
 * try {
 *   await promise;
 * } catch (error) {
 *   if (error instanceof CanceledError) {
 *     console.log('Canceled');
 *   }
 * }
 * ```
 *
 * @param milliseconds The amount of milliseconds to wait (0 if negatived, and ceil if decimal).
 * @returns A promise that resolves after the specified amount of milliseconds, and a cancel function that rejects the
 *   promise with `CanceledError` when invoked.
 */
export const cancelableDelay = (milliseconds: number): CancelableDelay => {
  const duration = toNonNegativeInteger(milliseconds);
  let timeoutId: Timeout | undefined;
  let settled = false;
  let rejectDelay: ((error: CanceledError) => void) | undefined;

  const promise = new Promise<void>((resolve, reject) => {
    rejectDelay = reject as (error: CanceledError) => void;
    timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      timeoutId = undefined;
      resolve();
    }, duration);
  });

  const cancel = (): void => {
    if (settled) {
      return;
    }

    settled = true;

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    rejectDelay?.(new CanceledError());
  };

  return { promise, cancel };
};
