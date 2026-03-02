/**
 * Checks whether the given PID refers to a currently running process.
 *
 * This helper never throws errors. Also, if the process exists but the current user lacks permissions, it returns
 * `true` (matching the NodeJS semantics) unless `assumeDeadOnEPERM` is set to `true`.
 *
 * @example
 *
 * ```ts
 * import { isProcessRunning } from 'emitnlog/utils';
 *
 * if (isProcessRunning(process.pid)) {
 *   console.log('current process is alive');
 * }
 * ```
 *
 * @param pid The process id to check. Non-integers and values <= 0 return `false`.
 * @param options Optional behavior controls.
 * @returns `true` when a process exists for the PID, otherwise `false`.
 */
export const isProcessRunning = (pid: number, options?: Options): boolean => {
  if (pid <= 0 || !Number.isInteger(pid)) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    if (options?.assumeDeadOnEPERM) {
      return false;
    }

    const code = error && typeof error === 'object' && 'code' in error && error.code;
    return code === 'EPERM';
  }
};

type Options = {
  /**
   * Treat EPERM (no permissions) as a dead process.
   *
   * When `false` (default), EPERM is treated as "alive", matching NodeJS semantics for existence checks via
   * `process.kill(pid, 0)`.
   */
  readonly assumeDeadOnEPERM?: boolean;
};
