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
export const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(), Math.max(0, Math.ceil(milliseconds)));
  });
