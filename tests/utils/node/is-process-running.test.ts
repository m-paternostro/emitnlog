import { afterEach, describe, expect, test, vi } from 'vitest';

import { isProcessRunning } from '../../../src/utils/index-node.ts';

describe('emitnlog.utils.node.is-process-running', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns true for the current process id', () => {
    expect(isProcessRunning(process.pid)).toBe(true);
  });

  test('returns false for an invalid process id', () => {
    expect(isProcessRunning(Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  test('returns false for non-positive or non-integer ids without invoking kill', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => undefined as never);

    expect(isProcessRunning(0)).toBe(false);
    expect(isProcessRunning(-1)).toBe(false);
    expect(isProcessRunning(1.5)).toBe(false);
    expect(isProcessRunning(Number.NaN)).toBe(false);
    expect(isProcessRunning(Infinity)).toBe(false);
    expect(isProcessRunning(undefined as unknown as number)).toBe(false);
    expect(isProcessRunning(null as unknown as number)).toBe(false);
    expect(isProcessRunning('123' as unknown as number)).toBe(false);

    expect(killSpy).not.toHaveBeenCalled();
  });

  test('returns true when the process exists but permissions are missing', () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      const error = new Error('No permission');
      (error as unknown as Record<string, unknown>).code = 'EPERM';
      throw error;
    });

    expect(isProcessRunning(1234)).toBe(true);
    expect(killSpy).toHaveBeenCalledWith(1234, 0);
  });

  test('returns false when permissions are missing and option treats EPERM as dead', () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      const error = new Error('No permission');
      (error as unknown as Record<string, unknown>).code = 'EPERM';
      throw error;
    });

    expect(isProcessRunning(1234, { assumeDeadOnEPERM: true })).toBe(false);
  });
});
