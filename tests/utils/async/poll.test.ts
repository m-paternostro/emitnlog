import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { startPolling } from '../../../src/utils/index.ts';
import { createTestLogger, flushFakeTimePromises } from '../../jester.setup.ts';

describe('emitnlog.utils.poll', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should call operation at specified intervals', async () => {
    const operation = jest.fn().mockReturnValue('result');
    const { close } = startPolling(operation, 1000);

    expect(operation).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(3);

    await close();
  });

  test('should resolve wait with the last result when closed', async () => {
    const operation = jest.fn().mockReturnValueOnce('first').mockReturnValueOnce('second').mockReturnValue('third');

    const { wait, close } = startPolling(operation, 1000);

    jest.advanceTimersByTime(2000);
    await close();

    await expect(wait).resolves.toBe('second');
  });

  test('should stop polling when interrupt returns true', async () => {
    const operation = jest
      .fn()
      .mockReturnValueOnce('continue')
      .mockReturnValueOnce('continue')
      .mockReturnValueOnce('stop');

    const interrupt = jest.fn((val: unknown): boolean => val === 'stop');

    const { wait } = startPolling(operation, 1000, { invokeImmediately: true, interrupt });

    expect(operation).toHaveBeenCalledTimes(1);
    expect(interrupt).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(interrupt).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(interrupt).toHaveBeenCalledTimes(3);

    // No more calls after interrupt returns true
    jest.advanceTimersByTime(5000);
    expect(operation).toHaveBeenCalledTimes(3);

    await expect(wait).resolves.toBe('stop');
  });

  test('should stop polling after timeout', async () => {
    const operation = jest.fn().mockReturnValue('result');

    const { wait } = startPolling(operation, 1000, { timeout: 3500 });

    expect(operation).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(3000);
    expect(operation).toHaveBeenCalledTimes(3);

    jest.advanceTimersByTime(500);

    // No more calls after timeout
    await flushFakeTimePromises();
    jest.advanceTimersByTime(5000);
    expect(operation).toHaveBeenCalledTimes(3);

    await expect(wait).resolves.toBe('result');
  });

  test('should stop polling after timeout and return timeoutValue', async () => {
    const operation = jest.fn().mockReturnValue('result');

    const { wait } = startPolling(operation, 1000, { timeout: 3500, timeoutValue: 'timeout' });

    expect(operation).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(3000);
    expect(operation).toHaveBeenCalledTimes(3);

    jest.advanceTimersByTime(500);

    // No more calls after timeout
    await flushFakeTimePromises();
    jest.advanceTimersByTime(5000);
    expect(operation).toHaveBeenCalledTimes(3);

    await expect(wait).resolves.toBe('timeout');
  });

  test('should handle async operations', async () => {
    let resolvePromise: (value: string) => void;
    const asyncOperation = jest.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePromise = resolve;
        }),
    );

    const { wait, close } = startPolling(asyncOperation, 1000);

    jest.advanceTimersByTime(1000);

    expect(asyncOperation).toHaveBeenCalledTimes(1);

    // Resolve the first promise
    resolvePromise!('first result');
    await flushFakeTimePromises();
    jest.advanceTimersByTime(1000);
    expect(asyncOperation).toHaveBeenCalledTimes(2);

    // Resolve the second promise
    resolvePromise!('second result');
    await flushFakeTimePromises();

    await close();

    await expect(wait).resolves.toBe('second result');
  });

  test('should skip interval if previous promise is still resolving', async () => {
    let resolvePromise: (value: string) => void;
    const asyncOperation = jest.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePromise = resolve;
        }),
    );

    startPolling(asyncOperation, 1000);

    expect(asyncOperation).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1000);
    expect(asyncOperation).toHaveBeenCalledTimes(1);

    // Advance time without resolving promise
    jest.advanceTimersByTime(3000);

    // Should still only have been called once since promise hasn't resolved
    expect(asyncOperation).toHaveBeenCalledTimes(1);

    // Now resolve the promise
    resolvePromise!('result');
    await flushFakeTimePromises();

    // Next tick should call the operation again
    jest.advanceTimersByTime(1000);
    expect(asyncOperation).toHaveBeenCalledTimes(2);
  });

  test('should stop polling when interrupt returns true for async operation', async () => {
    const asyncOperation = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve('continue'))
      .mockImplementationOnce(() => Promise.resolve('stop'));

    const interrupt = jest.fn((val: unknown, _index: number): boolean => val === 'stop');

    const { wait } = startPolling(asyncOperation, 1000, { interrupt });

    expect(asyncOperation).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1000);
    await flushFakeTimePromises();

    expect(asyncOperation).toHaveBeenCalledTimes(1);
    expect(interrupt).toHaveBeenCalledTimes(1);
    expect(interrupt).toHaveBeenCalledWith('continue', 0);

    jest.advanceTimersByTime(1000);
    await flushFakeTimePromises();

    expect(asyncOperation).toHaveBeenCalledTimes(2);
    expect(interrupt).toHaveBeenCalledTimes(2);
    expect(interrupt).toHaveBeenCalledWith('stop', 1);

    // No more calls after interrupt returns true
    jest.advanceTimersByTime(5000);
    expect(asyncOperation).toHaveBeenCalledTimes(2);

    await expect(wait).resolves.toBe('stop');
  });

  test('should continue polling if operation throws error', async () => {
    const logger = createTestLogger();
    const operation = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('test error');
      })
      .mockReturnValueOnce('result')
      .mockImplementationOnce(() => {
        throw new Error('another error');
      })
      .mockReturnValue('final');

    const { wait, close } = startPolling(operation, 1000, { invokeImmediately: true, logger });

    expect(operation).toHaveBeenCalledTimes(1);
    expect(logger).toHaveLoggedWith('error', 'test error');

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(logger).toHaveLoggedWith('error', 'another error');

    jest.advanceTimersByTime(1000);
    await close();

    await expect(wait).resolves.toBe('final');
  });

  test('should continue polling if async operation rejects', async () => {
    const logger = createTestLogger();
    const operation = jest
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error('rejection')))
      .mockImplementationOnce(() => Promise.resolve('success'))
      .mockImplementationOnce(() => Promise.reject(new Error('another rejection')))
      .mockImplementation(() => Promise.resolve('final'));

    const { wait, close } = startPolling(operation, 1000, { logger });

    expect(operation).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(1);
    await flushFakeTimePromises();
    expect(logger).toHaveLoggedWith('error', 'rejection');

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(2);
    await flushFakeTimePromises();

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(3);
    await flushFakeTimePromises();
    expect(logger).toHaveLoggedWith('error', 'another rejection');

    jest.advanceTimersByTime(1000);
    await flushFakeTimePromises();
    await close();

    await expect(wait).resolves.toBe('final');
  });

  test('should log debug messages when polling starts and finishes', async () => {
    const logger = createTestLogger();
    const operation = jest.fn().mockReturnValue('result');

    const { close } = startPolling(operation, 1000, { logger, timeout: 2500 });

    expect(logger).not.toHaveLoggedWith('debug', /.*/);

    jest.advanceTimersByTime(1000);
    expect(logger).toHaveLoggedWith('debug', 'invoking the operation for the 1 time');

    jest.advanceTimersByTime(1000);
    expect(logger).toHaveLoggedWith('debug', 'invoking the operation for the 2 time');

    jest.advanceTimersByTime(1000);
    expect(logger).toHaveLoggedWith('debug', 'invoking the operation for the 3 time');

    await flushFakeTimePromises();
    jest.advanceTimersByTime(500);
    expect(logger).toHaveLoggedWith('debug', 'timeout for the operation reached after 2500ms');
    expect(logger).toHaveLoggedWith('debug', /closing the poll after \d+ invocations/);

    await close();
  });

  test('should stop polling after retryLimit is reached', async () => {
    const logger = createTestLogger();
    const operation = jest.fn().mockReturnValue('result');

    const { wait } = startPolling(operation, 1000, { retryLimit: 3, logger });

    expect(operation).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(3);

    // This should trigger retryLimit
    jest.advanceTimersByTime(1000);
    await flushFakeTimePromises();

    // No more calls after retryLimit
    jest.advanceTimersByTime(5000);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(logger).toHaveLoggedWith('debug', 'reached maximum retries (3)');

    await expect(wait).resolves.toBe('result');
  });

  test('should stop polling based on the earliest of retryLimit, timeout or interrupt', async () => {
    const logger = createTestLogger();
    const operation = jest
      .fn()
      .mockReturnValueOnce('first')
      .mockReturnValueOnce('second')
      .mockReturnValueOnce('stop')
      .mockReturnValue('should not reach');

    const interrupt = jest.fn((val: unknown): boolean => val === 'stop');

    const { wait } = startPolling(operation, 1000, { retryLimit: 5, timeout: 5000, interrupt, logger });

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1000);
    expect(operation).toHaveBeenCalledTimes(3);
    await flushFakeTimePromises();

    // Should have stopped on interrupt condition (third call returns 'stop')
    jest.advanceTimersByTime(5000);
    expect(operation).toHaveBeenCalledTimes(3);

    await expect(wait).resolves.toBe('stop');
  });
});
