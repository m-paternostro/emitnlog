/* eslint-disable @typescript-eslint/no-invalid-void-type */
/* eslint-disable @typescript-eslint/no-confusing-void-expression */

import { describe, expect, jest, test } from '@jest/globals';

import type { implementation, Logger } from '../../../src/logger/index.ts';
import { emitter } from '../../../src/logger/index.ts';
import type { AsyncClosable, Closable, SyncClosable } from '../../../src/utils/index.ts';
import { asClosable, asSafeClosable, closeAll, createCloser, delay } from '../../../src/utils/index.ts';

describe('emitnlog.utils.closable', () => {
  describe('closeAll', () => {
    test('should close all sync closables synchronously', () => {
      const closable1 = { close: (): void => undefined };
      const closable2: Closable = { close: () => undefined };
      const closable3: Closable = { close: () => undefined };

      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');
      const spy3 = jest.spyOn(closable3, 'close');

      const result: void = closeAll(closable1, closable2, closable3);
      expect(result).not.toBeInstanceOf(Promise);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
    });

    test('should close all async closables and return Promise', async () => {
      const closable1 = { close: () => Promise.resolve() };
      const closable2: AsyncClosable = { close: async () => undefined };
      const closable3: AsyncClosable = { close: async () => undefined };

      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');
      const spy3 = jest.spyOn(closable3, 'close');

      const result: Promise<void> = closeAll(closable1, closable2, closable3);
      expect(result).toBeInstanceOf(Promise);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);

      await result;

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
    });

    test('should handle mixed sync and async closables and return Promise', async () => {
      const closable1 = { close: () => Promise.resolve() };
      const closable2: Closable = { close: () => undefined };

      let asyncClosed = false;
      const closable3: AsyncClosable = {
        close: async () => {
          await delay(1);
          asyncClosed = true;
        },
      };
      let syncClosed = false;
      const closable4: SyncClosable = {
        close: () => {
          syncClosed = true;
        },
      };

      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');
      const spy3 = jest.spyOn(closable3, 'close');
      const spy4 = jest.spyOn(closable4, 'close');

      const result: Promise<void> = closeAll(closable1, closable2, closable3, closable4);
      expect(result).toBeInstanceOf(Promise);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
      expect(spy4).toHaveBeenCalledTimes(1);

      expect(asyncClosed).toBe(false);
      expect(syncClosed).toBe(true);
      await result;
      expect(asyncClosed).toBe(true);
      expect(syncClosed).toBe(true);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
      expect(spy4).toHaveBeenCalledTimes(1);
    });

    test('should handle empty array', () => {
      const result: void = closeAll();
      expect(result).not.toBeInstanceOf(Promise);
    });

    test('should handle single sync closable', () => {
      const closable = { close: () => undefined };
      const spy = jest.spyOn(closable, 'close');

      const result: void = closeAll(closable);
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('should handle single async closable', async () => {
      const closable: AsyncClosable = { close: () => Promise.resolve() };
      const spy = jest.spyOn(closable, 'close');

      const result: Promise<void> = closeAll(closable);
      expect(result).toBeInstanceOf(Promise);

      expect(spy).toHaveBeenCalledTimes(1);
      await result;
    });

    test('should handle single unknown closable', async () => {
      let closed = false;
      const closable: AsyncClosable = {
        close: async () => {
          await delay(1);
          closed = true;
        },
      };

      const spy = jest.spyOn(closable, 'close');

      const result: Promise<void> = closeAll(closable);
      expect(result).toBeInstanceOf(Promise);
      expect(spy).toHaveBeenCalledTimes(1);

      expect(closed).toBe(false);
      await result;
      expect(closed).toBe(true);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('should accumulate sync errors and throw after closing all', () => {
      const err1 = new Error('err1');
      const err3 = new Error('err3');

      const c1: SyncClosable = {
        close: () => {
          throw err1;
        },
      };
      const c2: SyncClosable = { close: () => undefined };
      const c3: SyncClosable = {
        close: () => {
          throw err3;
        },
      };

      const s1 = jest.spyOn(c1, 'close');
      const s2 = jest.spyOn(c2, 'close');
      const s3 = jest.spyOn(c3, 'close');

      try {
        closeAll(c1, c2, c3);
        // should not reach
        expect(true).toBe(false);
      } catch (error) {
        expect(s1).toHaveBeenCalledTimes(1);
        expect(s2).toHaveBeenCalledTimes(1);
        expect(s3).toHaveBeenCalledTimes(1);

        const thrown = error as Error & { cause?: unknown };
        expect(thrown).toBeInstanceOf(Error);
        expect(thrown.message).toBe('Multiple errors occurred while closing closables');

        const cause = thrown.cause as unknown[] | undefined;
        expect(Array.isArray(cause)).toBe(true);
        expect((cause as unknown[]).length).toBe(2);
        expect((cause as unknown[])[0]).toBeInstanceOf(Error);
        expect((cause as unknown[])[1]).toBeInstanceOf(Error);
      }
    });

    test('should throw single error if only one sync closable fails', () => {
      const err = new Error('boom');
      const c1: SyncClosable = {
        close: () => {
          throw err;
        },
      };
      const c2: SyncClosable = { close: () => undefined };

      const s1 = jest.spyOn(c1, 'close');
      const s2 = jest.spyOn(c2, 'close');

      try {
        closeAll(c1, c2);
        expect(true).toBe(false);
      } catch (error) {
        expect(s1).toHaveBeenCalledTimes(1);
        expect(s2).toHaveBeenCalledTimes(1);

        const thrown = error as Error & { cause?: unknown };
        expect(thrown).toBe(err);
      }
    });

    test('should accumulate mixed sync/async errors and reject after all closables', async () => {
      const syncErr = new Error('sync-fail');
      const asyncErr = new Error('async-fail');

      let asyncOkDone = false;
      const c1: SyncClosable = {
        close: () => {
          throw syncErr;
        },
      };
      const c2: AsyncClosable = {
        close: async () => {
          await delay(1);
        },
      };
      const c3: AsyncClosable = {
        close: async () => {
          await delay(1);
          throw asyncErr;
        },
      };
      const c4: SyncClosable = { close: () => undefined };

      const s1 = jest.spyOn(c1, 'close');
      const s2 = jest.spyOn(c2, 'close');
      const s3 = jest.spyOn(c3, 'close');
      const s4 = jest.spyOn(c4, 'close');

      // Track that the successful async completed
      const c2Wrapped: AsyncClosable = {
        close: async () => {
          await c2.close();
          asyncOkDone = true;
        },
      };

      const promise = closeAll(c1, c2Wrapped, c3, c4);
      expect(promise).toBeInstanceOf(Promise);

      // Sync ones ran immediately
      expect(s1).toHaveBeenCalledTimes(1);
      expect(s4).toHaveBeenCalledTimes(1);
      expect(asyncOkDone).toBe(false);

      await expect(promise).rejects.toThrow('Multiple errors occurred while closing closables');

      // All should have been invoked once
      expect(s1).toHaveBeenCalledTimes(1);
      expect(s2).toHaveBeenCalledTimes(1);
      expect(s3).toHaveBeenCalledTimes(1);
      expect(s4).toHaveBeenCalledTimes(1);

      // Successful async completed
      expect(asyncOkDone).toBe(true);
    });

    test('should reject with single error when only one async fails', async () => {
      const asyncErr = new Error('only-async-fail');

      const c1: SyncClosable = { close: () => undefined };
      const c2: AsyncClosable = {
        close: async () => {
          await delay(1);
          throw asyncErr;
        },
      };

      const s1 = jest.spyOn(c1, 'close');
      const s2 = jest.spyOn(c2, 'close');

      const promise = closeAll(c1, c2);
      expect(promise).toBeInstanceOf(Promise);

      await expect(promise).rejects.toBe(asyncErr);

      expect(s1).toHaveBeenCalledTimes(1);
      expect(s2).toHaveBeenCalledTimes(1);
    });
  });

  describe('asClosable', () => {
    test('should create sync closable from sync closables', () => {
      const closable1 = { close: () => undefined };
      const closable2: SyncClosable = { close: () => undefined };
      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const combined = asClosable(closable1, closable2);
      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);

      const result: void = combined.close();
      expect(result).not.toBeInstanceOf(Promise);

      expect(result).toBeUndefined();
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should create async closable from async closables', async () => {
      const closable1 = { close: () => Promise.resolve() };
      const closable2: AsyncClosable = { close: () => Promise.resolve() };
      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const combined = asClosable(closable1, closable2);

      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);

      const result: Promise<void> = combined.close();
      expect(result).toBeInstanceOf(Promise);
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);

      await result;

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should create async closable from mixed sync and async closables', async () => {
      const closable1 = { close: () => Promise.resolve() };
      const closable2: Closable = { close: () => undefined };

      let asyncClosed = false;
      const closable3: AsyncClosable = {
        close: async () => {
          await delay(1);
          asyncClosed = true;
        },
      };
      let syncClosed = false;
      const closable4: SyncClosable = {
        close: () => {
          syncClosed = true;
        },
      };

      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');
      const spy3 = jest.spyOn(closable3, 'close');
      const spy4 = jest.spyOn(closable4, 'close');

      const closable = asClosable(closable1, closable2, closable3, closable4);

      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);
      expect(spy3).toHaveBeenCalledTimes(0);
      expect(spy4).toHaveBeenCalledTimes(0);

      const result: Promise<void> = closable.close();
      expect(result).toBeInstanceOf(Promise);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
      expect(spy4).toHaveBeenCalledTimes(1);

      expect(asyncClosed).toBe(false);
      expect(syncClosed).toBe(true);
      await result;
      expect(asyncClosed).toBe(true);
      expect(syncClosed).toBe(true);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
      expect(spy4).toHaveBeenCalledTimes(1);
    });

    test('should create closable from sync functions', () => {
      const func1: () => void = jest.fn<() => void>();
      const func2: () => void = jest.fn<() => void>();

      const closable = asClosable(func1, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);

      const result: void = closable.close();

      expect(result).toBeUndefined();
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
    });

    test('should create closable from async functions', async () => {
      const func1: () => Promise<void> = jest.fn<() => Promise<void>>(() => Promise.resolve());
      const func2: () => Promise<void> = jest.fn<() => Promise<void>>(() => Promise.resolve());

      const closable = asClosable(func1, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);

      const result: Promise<void> = closable.close();
      expect(result).toBeInstanceOf(Promise);
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);

      await result;
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
    });

    test('should create closable from a mix of sync closables and sync functions', () => {
      const func1: () => void = jest.fn<() => void>();
      const func2: () => void = jest.fn<() => void>();

      const closable1 = { close: () => undefined };
      const closable2: SyncClosable = { close: () => undefined };
      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const closable = asClosable(closable1, func1, closable2, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);
      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);

      const result: void = closable.close();

      expect(result).toBeUndefined();
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should create closable from a mix of async closables and async functions', async () => {
      const func1: () => Promise<void> = jest.fn<() => Promise<void>>();
      const func2: () => Promise<void> = jest.fn<() => Promise<void>>();

      const closable1 = { close: () => Promise.resolve() };
      const closable2: AsyncClosable = { close: () => Promise.resolve() };
      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const closable = asClosable(closable1, func1, closable2, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);
      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);

      const result: Promise<void> = closable.close();
      expect(result).toBeInstanceOf(Promise);
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);

      await result;

      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should create closable from mixed functions and closables', async () => {
      const func1: () => void = jest.fn<() => void>();
      const func2: () => Promise<void> = jest.fn<() => Promise<void>>();

      const closable1: Closable = { close: () => undefined };
      const closable2: Closable = { close: () => Promise.resolve() };
      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const closable = asClosable(closable1, func1, closable2, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);
      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);

      const result: Promise<void> = closable.close();
      expect(result).toBeInstanceOf(Promise);
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);

      await result;

      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should handle functions that return values', () => {
      const func1 = () => 'hello';
      const func2 = () => 42;
      const func3 = () => null;
      const func4 = () => true;
      const func5 = () => undefined as never;

      const closable = asClosable(func1, func2, func3, func4, func5);
      const result: void = closable.close();

      expect(result).toBeUndefined();
    });

    test('should handle functions that return values including promises', async () => {
      const func1 = () => 'hello';
      const func2 = () => 42;
      const func3 = () => null;
      const func4 = () => Promise.resolve(true);
      const func5 = () => Promise.resolve(undefined as never);

      const closable = asClosable(func1, func2, func3, func4, func5);
      const result: Promise<void> = closable.close();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });

    test('should handle empty input', () => {
      const closable = asClosable();
      const result: void = closable.close();
      expect(result).toBeUndefined();
    });

    test('should handle single sync function', () => {
      let called = false;
      const func = () => {
        called = true;
      };

      const closable = asClosable(func);
      const result: void = closable.close();
      expect(result).toBeUndefined();
      expect(called).toBe(true);
    });

    test('should handle single async function', async () => {
      let called = false;
      const func = async () => {
        called = true;
      };

      const closable = asClosable(func);
      expect(called).toBe(false);

      const result: Promise<void> = closable.close();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
      expect(called).toBe(true);
    });

    test('should handle loggers', () => {
      let closeCalled = false;
      const logger: Logger = emitter.createLogger('info', {
        sink: () => undefined,
        close: () => {
          closeCalled = true;
        },
      });

      const func1: () => void = jest.fn<() => void>();
      const closable: SyncClosable = { close: () => undefined };
      const closableSpy = jest.spyOn(closable, 'close');

      const combined = asClosable(logger, closable, func1);

      expect(closeCalled).toBe(false);
      expect(func1).toHaveBeenCalledTimes(0);
      expect(closableSpy).toHaveBeenCalledTimes(0);

      const result: Promise<void> = combined.close();
      expect(result).toBeUndefined();
      expect(closeCalled).toBe(true);
      expect(func1).toHaveBeenCalledTimes(1);
      expect(closableSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle loggers with sync close', () => {
      let closeCalled = false;
      const logger: implementation.SyncFinalizer<Logger> = emitter.createLogger('info', {
        sink: () => undefined,
        flush: () => undefined,
        close: () => {
          closeCalled = true;
        },
      });

      const func1: () => void = jest.fn<() => void>();
      const closable: SyncClosable = { close: () => undefined };
      const closableSpy = jest.spyOn(closable, 'close');

      const combined = asClosable(logger, closable, func1);

      expect(closeCalled).toBe(false);
      expect(func1).toHaveBeenCalledTimes(0);
      expect(closableSpy).toHaveBeenCalledTimes(0);

      const result: void = combined.close();
      expect(result).toBeUndefined();
      expect(closeCalled).toBe(true);
      expect(func1).toHaveBeenCalledTimes(1);
      expect(closableSpy).toHaveBeenCalledTimes(1);
    });

    test('should accumulate sync errors and throw after closing all sources', () => {
      const err1 = new Error('err1');
      const err3 = new Error('err3');

      const c1 = asClosable(() => {
        throw err1;
      });
      const fnOk: () => void = () => undefined;
      const c3 = asClosable(() => {
        throw err3;
      });

      const s1 = jest.spyOn(c1, 'close');
      const sOk = jest.fn(fnOk);
      const s3 = jest.spyOn(c3, 'close');

      const combined = asClosable(c1, sOk, c3);

      try {
        combined.close();
        expect(true).toBe(false);
      } catch (error) {
        expect(s1).toHaveBeenCalledTimes(1);
        expect(sOk).toHaveBeenCalledTimes(1);
        expect(s3).toHaveBeenCalledTimes(1);

        const thrown = error as Error & { cause?: unknown };
        expect(thrown).toBeInstanceOf(Error);
        expect(thrown.message).toBe('Multiple errors occurred while closing closables');

        const cause = thrown.cause as unknown[] | undefined;
        expect(Array.isArray(cause)).toBe(true);
        expect((cause as unknown[]).length).toBe(2);
        expect((cause as unknown[])[0]).toBeInstanceOf(Error);
        expect((cause as unknown[])[1]).toBeInstanceOf(Error);
      }
    });

    test('should throw single error if only one sync source fails', () => {
      const err = new Error('boom');
      const bad = asClosable(() => {
        throw err;
      });
      const okFn: () => void = jest.fn<() => void>();
      const sBad = jest.spyOn(bad, 'close');

      const combined = asClosable(bad, okFn);

      try {
        combined.close();
        expect(true).toBe(false);
      } catch (error) {
        expect(sBad).toHaveBeenCalledTimes(1);
        expect(okFn).toHaveBeenCalledTimes(1);

        const thrown = error as Error & { cause?: unknown };
        expect(thrown).toBe(err);
      }
    });

    test('should accumulate mixed sync/async errors and reject after all sources', async () => {
      const syncErr = new Error('sync-fail');
      const asyncErr = new Error('async-fail');

      const badSync = asClosable(() => {
        throw syncErr;
      });
      let okAsyncRan = false;
      const okAsync = async () => {
        await delay(1);
        okAsyncRan = true;
      };
      const badAsync = async () => {
        await delay(1);
        throw asyncErr;
      };

      const sBadSync = jest.spyOn(badSync, 'close');
      const sOkAsync = jest.fn(okAsync);
      const sBadAsync = jest.fn(badAsync);

      const combined = asClosable(badSync, sOkAsync, sBadAsync);

      const result = combined.close();
      expect(result).toBeInstanceOf(Promise);

      // sync executed immediately
      expect(sBadSync).toHaveBeenCalledTimes(1);
      expect(okAsyncRan).toBe(false);

      await expect(result).rejects.toThrow('Multiple errors occurred while closing closables');

      // all sources executed
      expect(sBadSync).toHaveBeenCalledTimes(1);
      expect(sOkAsync).toHaveBeenCalledTimes(1);
      expect(sBadAsync).toHaveBeenCalledTimes(1);
      expect(okAsyncRan).toBe(true);
    });

    test('should reject with single error when only one async source fails', async () => {
      const asyncErr = new Error('only-async-fail');

      const okSync: () => void = jest.fn<() => void>();
      const badAsync: () => Promise<void> = async () => {
        await delay(1);
        throw asyncErr;
      };

      const sBadAsync = jest.fn(badAsync);

      const combined = asClosable(okSync, sBadAsync);
      const result = combined.close();
      expect(result).toBeInstanceOf(Promise);

      await expect(result).rejects.toBe(asyncErr);

      expect(okSync).toHaveBeenCalledTimes(1);
      expect(sBadAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('asSafeClosable', () => {
    describe('should wrap sync closable and not throw', () => {
      const throwingClosable: SyncClosable = {
        close: () => {
          throw new Error('Sync error');
        },
      };

      test('should not throw', () => {
        const safeClosable = asSafeClosable(throwingClosable);
        const result: void = safeClosable.close();
        expect(result).toBeUndefined();
      });

      test('should handle error', () => {
        let handledError: unknown;
        const safeClosable = asSafeClosable(throwingClosable, (error) => {
          handledError = error;
        });

        const result: void = safeClosable.close();
        expect(result).toBeUndefined();
        expect(handledError).toBeInstanceOf(Error);
        expect((handledError as Error).message).toBe('Sync error');
      });

      test('should handle error with onError throwing', () => {
        const safeClosable = asSafeClosable(throwingClosable, () => {
          throw new Error('On error error');
        });

        const result: void = safeClosable.close();
        expect(result).toBeUndefined();
      });
    });

    describe('should wrap async closable and not reject', () => {
      const rejectingClosable: AsyncClosable = {
        close: async () => {
          throw new Error('Async error');
        },
      };

      test('should not reject', async () => {
        const safeClosable = asSafeClosable(rejectingClosable);
        const result: Promise<void> = safeClosable.close();
        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toBeUndefined();
      });

      test('should handle error', async () => {
        let handledError: unknown;
        const safeClosable = asSafeClosable(rejectingClosable, (error) => {
          handledError = error;
        });

        const result: Promise<void> = safeClosable.close();
        expect(result).toBeInstanceOf(Promise);

        expect(handledError).toBeUndefined();
        await expect(result).resolves.toBeUndefined();
        expect(handledError).toBeInstanceOf(Error);
        expect((handledError as Error).message).toBe('Async error');
      });

      test('should handle error with onError throwing', async () => {
        const safeClosable = asSafeClosable(rejectingClosable, () => {
          throw new Error('On error error');
        });

        const result: Promise<void> = safeClosable.close();
        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toBeUndefined();
      });
    });

    describe('should handle sync in async closables', () => {
      const throwingClosable: AsyncClosable = {
        close: (): Promise<void> => {
          throw new Error('Sync in async error');
        },
      };

      test('should not throw', () => {
        const safeClosable = asSafeClosable(throwingClosable);
        const result: Promise<void> = safeClosable.close();
        expect(result).toBeUndefined();
      });

      test('should handle error', () => {
        let handledError: unknown;
        const safeClosable = asSafeClosable(throwingClosable, (error) => {
          handledError = error;
        });

        const result: Promise<void> = safeClosable.close();
        expect(result).toBeUndefined();
        expect(handledError).toBeInstanceOf(Error);
        expect((handledError as Error).message).toBe('Sync in async error');
      });
    });
  });

  describe('createCloser', () => {
    test('should create closer with initial closables', () => {
      const closable1: SyncClosable = { close: () => undefined };
      const closable2: AsyncClosable = { close: () => Promise.resolve() };
      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const closer = createCloser(closable1, closable2);
      expect(closer).toHaveProperty('add');
      expect(closer).toHaveProperty('close');

      // Initial closables should not be called yet
      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);
    });

    test('should add closables and return them', () => {
      const closer = createCloser();
      const closable1: SyncClosable = { close: () => undefined };
      const closable2: AsyncClosable = { close: () => Promise.resolve() };

      const returned1 = closer.add(closable1);
      const returned2 = closer.add(closable2);

      expect(returned1).toBe(closable1);
      expect(returned2).toBe(closable2);
    });

    test('should close all added closables in reverse order', () => {
      const callOrder: number[] = [];
      const closable1: SyncClosable = {
        close: () => {
          callOrder.push(1);
        },
      };
      const closable2: SyncClosable = {
        close: () => {
          callOrder.push(2);
        },
      };
      const closable3: SyncClosable = {
        close: () => {
          callOrder.push(3);
        },
      };

      const closer = createCloser();
      closer.add(closable1);
      closer.add(closable2);
      closer.add(closable3);

      const result = closer.close();
      expect(result).toBeUndefined();
      expect(callOrder).toEqual([3, 2, 1]);
    });

    test('should close all initial closables in reverse order', () => {
      const callOrder: number[] = [];
      const closable1: SyncClosable = {
        close: () => {
          callOrder.push(1);
        },
      };
      const closable2: SyncClosable = {
        close: () => {
          callOrder.push(2);
        },
      };
      const closable3: SyncClosable = {
        close: () => {
          callOrder.push(3);
        },
      };

      const closer = createCloser(closable1, closable2, closable3);
      const result = closer.close();
      expect(result).toBeUndefined();
      expect(callOrder).toEqual([3, 2, 1]);
    });

    test('should close mixed initial and added closables in reverse order', () => {
      const callOrder: number[] = [];
      const closable1: SyncClosable = {
        close: () => {
          callOrder.push(1);
        },
      };
      const closable2: SyncClosable = {
        close: () => {
          callOrder.push(2);
        },
      };
      const closable3: SyncClosable = {
        close: () => {
          callOrder.push(3);
        },
      };
      const closable4: SyncClosable = {
        close: () => {
          callOrder.push(4);
        },
      };

      const closer = createCloser(closable1, closable2);
      closer.add(closable3);
      closer.add(closable4);

      const result = closer.close();
      expect(result).toBeUndefined();
      expect(callOrder).toEqual([4, 3, 2, 1]);
    });

    test('should handle empty closer', () => {
      const closer = createCloser();
      const result = closer.close();
      expect(result).toBeUndefined();
    });

    test('should handle closer with single closable', () => {
      const closable: SyncClosable = { close: () => undefined };
      const spy = jest.spyOn(closable, 'close');

      const closer = createCloser(closable);
      const result = closer.close();
      expect(result).toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('should handle async closables and return Promise', async () => {
      const closable1: AsyncClosable = { close: () => Promise.resolve() };
      const closable2: AsyncClosable = { close: () => Promise.resolve() };
      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const closer = createCloser(closable1, closable2);
      const result = closer.close();
      expect(result).toBeInstanceOf(Promise);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);

      await result;
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should handle mixed sync and async closables', async () => {
      let asyncClosed = false;
      const closable1: SyncClosable = { close: () => undefined };
      const closable2: AsyncClosable = {
        close: async () => {
          await delay(1);
          asyncClosed = true;
        },
      };
      const closable3: SyncClosable = { close: () => undefined };

      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');
      const spy3 = jest.spyOn(closable3, 'close');

      const closer = createCloser(closable1, closable2, closable3);
      const result = closer.close();
      expect(result).toBeInstanceOf(Promise);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);

      expect(asyncClosed).toBe(false);
      await result;
      expect(asyncClosed).toBe(true);
    });

    test('should clear closables after close', () => {
      const closable1: SyncClosable = { close: () => undefined };
      const closable2: SyncClosable = { close: () => undefined };
      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const closer = createCloser(closable1);
      closer.add(closable2);

      // First close
      const result1 = closer.close();
      expect(result1).toBeUndefined();
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);

      // Second close should not call the same closables
      const result2 = closer.close();
      expect(result2).toBeUndefined();
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should allow adding closables after close', () => {
      const closable1: SyncClosable = { close: () => undefined };
      const closable2: SyncClosable = { close: () => undefined };
      const closable3: SyncClosable = { close: () => undefined };
      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');
      const spy3 = jest.spyOn(closable3, 'close');

      const closer = createCloser(closable1);
      const result1 = closer.close();
      expect(result1).toBeUndefined();

      // Add new closable after close
      closer.add(closable2);
      closer.add(closable3);

      // Close again should only call the new closables
      const result2 = closer.close();
      expect(result2).toBeUndefined();
      expect(spy1).toHaveBeenCalledTimes(1); // Only called once
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
    });

    test('should accumulate errors and throw after closing all', () => {
      const err1 = new Error('err1');
      const err2 = new Error('err2');

      const closable1: SyncClosable = {
        close: () => {
          throw err1;
        },
      };
      const closable2: SyncClosable = { close: () => undefined };
      const closable3: SyncClosable = {
        close: () => {
          throw err2;
        },
      };

      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');
      const spy3 = jest.spyOn(closable3, 'close');

      const closer = createCloser(closable1, closable2, closable3);

      try {
        const result = closer.close();
        expect(result).toBeUndefined();
        expect(true).toBe(false);
      } catch (error) {
        expect(spy1).toHaveBeenCalledTimes(1);
        expect(spy2).toHaveBeenCalledTimes(1);
        expect(spy3).toHaveBeenCalledTimes(1);

        const thrown = error as Error & { cause?: unknown };
        expect(thrown).toBeInstanceOf(Error);
        expect(thrown.message).toBe('Multiple errors occurred while closing closables');

        const cause = thrown.cause as unknown[] | undefined;
        expect(Array.isArray(cause)).toBe(true);
        expect((cause as unknown[]).length).toBe(2);
        expect((cause as unknown[])[0]).toBeInstanceOf(Error);
        expect((cause as unknown[])[1]).toBeInstanceOf(Error);
      }
    });

    test('should throw single error if only one closable fails', () => {
      const err = new Error('boom');
      const closable1: SyncClosable = {
        close: () => {
          throw err;
        },
      };
      const closable2: SyncClosable = { close: () => undefined };

      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const closer = createCloser(closable1, closable2);

      try {
        const result = closer.close();
        expect(result).toBeUndefined();
        expect(true).toBe(false);
      } catch (error) {
        expect(spy1).toHaveBeenCalledTimes(1);
        expect(spy2).toHaveBeenCalledTimes(1);

        const thrown = error as Error & { cause?: unknown };
        expect(thrown).toBe(err);
      }
    });

    test('should accumulate mixed sync/async errors and reject after all closables', async () => {
      const syncErr = new Error('sync-fail');
      const asyncErr = new Error('async-fail');

      let asyncOkDone = false;
      const closable1: SyncClosable = {
        close: () => {
          throw syncErr;
        },
      };
      const closable2: AsyncClosable = {
        close: async () => {
          await delay(1);
        },
      };
      const closable3: AsyncClosable = {
        close: async () => {
          await delay(1);
          throw asyncErr;
        },
      };
      const closable4: SyncClosable = { close: () => undefined };

      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');
      const spy3 = jest.spyOn(closable3, 'close');
      const spy4 = jest.spyOn(closable4, 'close');

      // Track that the successful async completed
      const closable2Wrapped: AsyncClosable = {
        close: async () => {
          await closable2.close();
          asyncOkDone = true;
        },
      };

      const closer = createCloser(closable1, closable2Wrapped, closable3, closable4);
      const promise = closer.close();
      expect(promise).toBeInstanceOf(Promise);

      // Sync ones ran immediately
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy4).toHaveBeenCalledTimes(1);
      expect(asyncOkDone).toBe(false);

      await expect(promise).rejects.toThrow('Multiple errors occurred while closing closables');

      // All should have been invoked once
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
      expect(spy4).toHaveBeenCalledTimes(1);

      // Successful async completed
      expect(asyncOkDone).toBe(true);
    });

    test('should reject with single error when only one async fails', async () => {
      const asyncErr = new Error('only-async-fail');

      const closable1: SyncClosable = { close: () => undefined };
      const closable2: AsyncClosable = {
        close: async () => {
          await delay(1);
          throw asyncErr;
        },
      };

      const spy1 = jest.spyOn(closable1, 'close');
      const spy2 = jest.spyOn(closable2, 'close');

      const closer = createCloser(closable1, closable2);
      const promise = closer.close();
      expect(promise).toBeInstanceOf(Promise);

      await expect(promise).rejects.toBe(asyncErr);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should preserve closable types when adding', () => {
      const closer = createCloser();
      const syncClosable: SyncClosable = { close: () => undefined };
      const asyncClosable: AsyncClosable = { close: () => Promise.resolve() };

      const returnedSync = closer.add(syncClosable);
      const returnedAsync = closer.add(asyncClosable);

      // Type should be preserved
      expect(returnedSync).toBe(syncClosable);
      expect(returnedAsync).toBe(asyncClosable);

      // Should be able to call close on the returned closables
      const syncResult: void = returnedSync.close();
      const asyncResult: Promise<void> = returnedAsync.close();

      expect(syncResult).toBeUndefined();
      expect(asyncResult).toBeInstanceOf(Promise);
    });

    test('should work with functions as closables', async () => {
      const func1: () => void = jest.fn<() => void>();
      const func2: () => Promise<void> = jest.fn<() => Promise<void>>(() => Promise.resolve());

      const closer = createCloser();
      closer.add(asClosable(func1));
      closer.add(asClosable(func2));

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);

      const result = closer.close();
      expect(result).toBeInstanceOf(Promise);

      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);

      await result;
    });

    test('should work with loggers', () => {
      let closeCalled = false;
      const logger: Logger = emitter.createLogger('info', {
        sink: () => undefined,
        close: () => {
          closeCalled = true;
        },
      });

      const closable: SyncClosable = { close: () => undefined };
      const closableSpy = jest.spyOn(closable, 'close');

      const closer = createCloser();
      closer.add(asClosable(logger));
      closer.add(closable);

      expect(closeCalled).toBe(false);
      expect(closableSpy).toHaveBeenCalledTimes(0);

      const result = closer.close();
      expect(result).toBeUndefined();
      expect(closeCalled).toBe(true);
      expect(closableSpy).toHaveBeenCalledTimes(1);
    });
  });
});
