/* eslint-disable @typescript-eslint/no-invalid-void-type */
/* eslint-disable @typescript-eslint/no-confusing-void-expression */

import { describe, expect, jest, test } from '@jest/globals';

import type { implementation, Logger } from '../../../src/logger/index.ts';
import { emitter } from '../../../src/logger/index.ts';
import type { AsyncCloseable, Closeable, SyncCloseable } from '../../../src/utils/index.ts';
import { asCloseable, asSafeCloseable, closeAll, delay } from '../../../src/utils/index.ts';

describe('emitnlog.utils.closeable', () => {
  describe('closeAll', () => {
    test('should close all sync closeables synchronously', () => {
      const closeable1 = { close: (): void => undefined };
      const closeable2: Closeable = { close: () => undefined };
      const closeable3: Closeable = { close: () => undefined };

      const spy1 = jest.spyOn(closeable1, 'close');
      const spy2 = jest.spyOn(closeable2, 'close');
      const spy3 = jest.spyOn(closeable3, 'close');

      const result: void = closeAll(closeable1, closeable2, closeable3);
      expect(result).not.toBeInstanceOf(Promise);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
    });

    test('should close all async closeables and return Promise', async () => {
      const closeable1 = { close: () => Promise.resolve() };
      const closeable2: AsyncCloseable = { close: async () => undefined };
      const closeable3: AsyncCloseable = { close: async () => undefined };

      const spy1 = jest.spyOn(closeable1, 'close');
      const spy2 = jest.spyOn(closeable2, 'close');
      const spy3 = jest.spyOn(closeable3, 'close');

      const result: Promise<void> = closeAll(closeable1, closeable2, closeable3);
      expect(result).toBeInstanceOf(Promise);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);

      await result;

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);
    });

    test('should handle mixed sync and async closeables and return Promise', async () => {
      const closeable1 = { close: () => Promise.resolve() };
      const closeable2: Closeable = { close: () => undefined };

      let asyncClosed = false;
      const closeable3: AsyncCloseable = {
        close: async () => {
          await delay(1);
          asyncClosed = true;
        },
      };
      let syncClosed = false;
      const closeable4: SyncCloseable = {
        close: () => {
          syncClosed = true;
        },
      };

      const spy1 = jest.spyOn(closeable1, 'close');
      const spy2 = jest.spyOn(closeable2, 'close');
      const spy3 = jest.spyOn(closeable3, 'close');
      const spy4 = jest.spyOn(closeable4, 'close');

      const result: Promise<void> = closeAll(closeable1, closeable2, closeable3, closeable4);
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

    test('should handle single sync closeable', () => {
      const closeable = { close: () => undefined };
      const spy = jest.spyOn(closeable, 'close');

      const result: void = closeAll(closeable);
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    test('should handle single async closeable', async () => {
      const closeable: AsyncCloseable = { close: () => Promise.resolve() };
      const spy = jest.spyOn(closeable, 'close');

      const result: Promise<void> = closeAll(closeable);
      expect(result).toBeInstanceOf(Promise);

      expect(spy).toHaveBeenCalledTimes(1);
      await result;
    });

    test('should handle single unknown closeable', async () => {
      let closed = false;
      const closeable: AsyncCloseable = {
        close: async () => {
          await delay(1);
          closed = true;
        },
      };

      const spy = jest.spyOn(closeable, 'close');

      const result: Promise<void> = closeAll(closeable);
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

      const c1: SyncCloseable = {
        close: () => {
          throw err1;
        },
      };
      const c2: SyncCloseable = { close: () => undefined };
      const c3: SyncCloseable = {
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
        expect(thrown.message).toBe('Multiple errors occurred while closing closeables');

        const cause = thrown.cause as unknown[] | undefined;
        expect(Array.isArray(cause)).toBe(true);
        expect((cause as unknown[]).length).toBe(2);
        expect((cause as unknown[])[0]).toBeInstanceOf(Error);
        expect((cause as unknown[])[1]).toBeInstanceOf(Error);
      }
    });

    test('should throw single error if only one sync closeable fails', () => {
      const err = new Error('boom');
      const c1: SyncCloseable = {
        close: () => {
          throw err;
        },
      };
      const c2: SyncCloseable = { close: () => undefined };

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

    test('should accumulate mixed sync/async errors and reject after all closeables', async () => {
      const syncErr = new Error('sync-fail');
      const asyncErr = new Error('async-fail');

      let asyncOkDone = false;
      const c1: SyncCloseable = {
        close: () => {
          throw syncErr;
        },
      };
      const c2: AsyncCloseable = {
        close: async () => {
          await delay(1);
        },
      };
      const c3: AsyncCloseable = {
        close: async () => {
          await delay(1);
          throw asyncErr;
        },
      };
      const c4: SyncCloseable = { close: () => undefined };

      const s1 = jest.spyOn(c1, 'close');
      const s2 = jest.spyOn(c2, 'close');
      const s3 = jest.spyOn(c3, 'close');
      const s4 = jest.spyOn(c4, 'close');

      // Track that the successful async completed
      const c2Wrapped: AsyncCloseable = {
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

      await expect(promise).rejects.toThrow('Multiple errors occurred while closing closeables');

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

      const c1: SyncCloseable = { close: () => undefined };
      const c2: AsyncCloseable = {
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

  describe('asCloseable', () => {
    test('should create sync closeable from sync closeables', () => {
      const closeable1 = { close: () => undefined };
      const closeable2: SyncCloseable = { close: () => undefined };
      const spy1 = jest.spyOn(closeable1, 'close');
      const spy2 = jest.spyOn(closeable2, 'close');

      const combined = asCloseable(closeable1, closeable2);
      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);

      const result: void = combined.close();
      expect(result).not.toBeInstanceOf(Promise);

      expect(result).toBeUndefined();
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should create async closeable from async closeables', async () => {
      const closeable1 = { close: () => Promise.resolve() };
      const closeable2: AsyncCloseable = { close: () => Promise.resolve() };
      const spy1 = jest.spyOn(closeable1, 'close');
      const spy2 = jest.spyOn(closeable2, 'close');

      const combined = asCloseable(closeable1, closeable2);

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

    test('should create async closeable from mixed sync and async closeables', async () => {
      const closeable1 = { close: () => Promise.resolve() };
      const closeable2: Closeable = { close: () => undefined };

      let asyncClosed = false;
      const closeable3: AsyncCloseable = {
        close: async () => {
          await delay(1);
          asyncClosed = true;
        },
      };
      let syncClosed = false;
      const closeable4: SyncCloseable = {
        close: () => {
          syncClosed = true;
        },
      };

      const spy1 = jest.spyOn(closeable1, 'close');
      const spy2 = jest.spyOn(closeable2, 'close');
      const spy3 = jest.spyOn(closeable3, 'close');
      const spy4 = jest.spyOn(closeable4, 'close');

      const closeable = asCloseable(closeable1, closeable2, closeable3, closeable4);

      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);
      expect(spy3).toHaveBeenCalledTimes(0);
      expect(spy4).toHaveBeenCalledTimes(0);

      const result: Promise<void> = closeable.close();
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

    test('should create closeable from sync functions', () => {
      const func1: () => void = jest.fn<() => void>();
      const func2: () => void = jest.fn<() => void>();

      const closeable = asCloseable(func1, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);

      const result: void = closeable.close();

      expect(result).toBeUndefined();
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
    });

    test('should create closeable from async functions', async () => {
      const func1: () => Promise<void> = jest.fn<() => Promise<void>>(() => Promise.resolve());
      const func2: () => Promise<void> = jest.fn<() => Promise<void>>(() => Promise.resolve());

      const closeable = asCloseable(func1, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);

      const result: Promise<void> = closeable.close();
      expect(result).toBeInstanceOf(Promise);
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);

      await result;
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
    });

    test('should create closeable from a mix of sync closeables and sync functions', () => {
      const func1: () => void = jest.fn<() => void>();
      const func2: () => void = jest.fn<() => void>();

      const closeable1 = { close: () => undefined };
      const closeable2: SyncCloseable = { close: () => undefined };
      const spy1 = jest.spyOn(closeable1, 'close');
      const spy2 = jest.spyOn(closeable2, 'close');

      const closeable = asCloseable(closeable1, func1, closeable2, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);
      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);

      const result: void = closeable.close();

      expect(result).toBeUndefined();
      expect(func1).toHaveBeenCalledTimes(1);
      expect(func2).toHaveBeenCalledTimes(1);
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    test('should create closeable from a mix of async closeables and async functions', async () => {
      const func1: () => Promise<void> = jest.fn<() => Promise<void>>();
      const func2: () => Promise<void> = jest.fn<() => Promise<void>>();

      const closeable1 = { close: () => Promise.resolve() };
      const closeable2: AsyncCloseable = { close: () => Promise.resolve() };
      const spy1 = jest.spyOn(closeable1, 'close');
      const spy2 = jest.spyOn(closeable2, 'close');

      const closeable = asCloseable(closeable1, func1, closeable2, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);
      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);

      const result: Promise<void> = closeable.close();
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

    test('should create closeable from mixed functions and closeables', async () => {
      const func1: () => void = jest.fn<() => void>();
      const func2: () => Promise<void> = jest.fn<() => Promise<void>>();

      const closeable1: Closeable = { close: () => undefined };
      const closeable2: Closeable = { close: () => Promise.resolve() };
      const spy1 = jest.spyOn(closeable1, 'close');
      const spy2 = jest.spyOn(closeable2, 'close');

      const closeable = asCloseable(closeable1, func1, closeable2, func2);

      expect(func1).toHaveBeenCalledTimes(0);
      expect(func2).toHaveBeenCalledTimes(0);
      expect(spy1).toHaveBeenCalledTimes(0);
      expect(spy2).toHaveBeenCalledTimes(0);

      const result: Promise<void> = closeable.close();
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

      const closeable = asCloseable(func1, func2, func3, func4);
      const result: void = closeable.close();

      expect(result).toBeUndefined();
    });

    test('should handle functions that return values including', async () => {
      const func1 = () => 'hello';
      const func2 = () => 42;
      const func3 = () => null;
      const func4 = () => Promise.resolve(true);

      const closeable = asCloseable(func1, func2, func3, func4);
      const result: Promise<void> = closeable.close();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });

    test('should handle empty input', () => {
      const closeable = asCloseable();
      const result: void = closeable.close();
      expect(result).toBeUndefined();
    });

    test('should handle single sync function', () => {
      let called = false;
      const func = () => {
        called = true;
      };

      const closeable = asCloseable(func);
      const result: void = closeable.close();
      expect(result).toBeUndefined();
      expect(called).toBe(true);
    });

    test('should handle single async function', async () => {
      let called = false;
      const func = async () => {
        called = true;
      };

      const closeable = asCloseable(func);
      expect(called).toBe(false);

      const result: Promise<void> = closeable.close();
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
      const closeable: SyncCloseable = { close: () => undefined };
      const closeableSpy = jest.spyOn(closeable, 'close');

      const combined = asCloseable(logger, closeable, func1);

      expect(closeCalled).toBe(false);
      expect(func1).toHaveBeenCalledTimes(0);
      expect(closeableSpy).toHaveBeenCalledTimes(0);

      const result: Promise<void> = combined.close();
      expect(result).toBeUndefined();
      expect(closeCalled).toBe(true);
      expect(func1).toHaveBeenCalledTimes(1);
      expect(closeableSpy).toHaveBeenCalledTimes(1);
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
      const closeable: SyncCloseable = { close: () => undefined };
      const closeableSpy = jest.spyOn(closeable, 'close');

      const combined = asCloseable(logger, closeable, func1);

      expect(closeCalled).toBe(false);
      expect(func1).toHaveBeenCalledTimes(0);
      expect(closeableSpy).toHaveBeenCalledTimes(0);

      const result: void = combined.close();
      expect(result).toBeUndefined();
      expect(closeCalled).toBe(true);
      expect(func1).toHaveBeenCalledTimes(1);
      expect(closeableSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('asSafeCloseable', () => {
    describe('should wrap sync closeable and not throw', () => {
      const throwingCloseable: SyncCloseable = {
        close: () => {
          throw new Error('Sync error');
        },
      };

      test('should not throw', () => {
        const safeCloseable = asSafeCloseable(throwingCloseable);
        const result: void = safeCloseable.close();
        expect(result).toBeUndefined();
      });

      test('should handle error', () => {
        let handledError: unknown;
        const safeCloseable = asSafeCloseable(throwingCloseable, (error) => {
          handledError = error;
        });

        const result: void = safeCloseable.close();
        expect(result).toBeUndefined();
        expect(handledError).toBeInstanceOf(Error);
        expect((handledError as Error).message).toBe('Sync error');
      });

      test('should handle error with onError throwing', () => {
        const safeCloseable = asSafeCloseable(throwingCloseable, () => {
          throw new Error('On error error');
        });

        const result: void = safeCloseable.close();
        expect(result).toBeUndefined();
      });
    });

    describe('should wrap async closeable and not reject', () => {
      const rejectingCloseable: AsyncCloseable = {
        close: async () => {
          throw new Error('Async error');
        },
      };

      test('should not reject', async () => {
        const safeCloseable = asSafeCloseable(rejectingCloseable);
        const result: Promise<void> = safeCloseable.close();
        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toBeUndefined();
      });

      test('should handle error', async () => {
        let handledError: unknown;
        const safeCloseable = asSafeCloseable(rejectingCloseable, (error) => {
          handledError = error;
        });

        const result: Promise<void> = safeCloseable.close();
        expect(result).toBeInstanceOf(Promise);

        expect(handledError).toBeUndefined();
        await expect(result).resolves.toBeUndefined();
        expect(handledError).toBeInstanceOf(Error);
        expect((handledError as Error).message).toBe('Async error');
      });

      test('should handle error with onError throwing', async () => {
        const safeCloseable = asSafeCloseable(rejectingCloseable, () => {
          throw new Error('On error error');
        });

        const result: Promise<void> = safeCloseable.close();
        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toBeUndefined();
      });
    });

    describe('should handle sync in async closeables', () => {
      const throwingCloseable: AsyncCloseable = {
        close: (): Promise<void> => {
          throw new Error('Sync in async error');
        },
      };

      test('should not throw', () => {
        const safeCloseable = asSafeCloseable(throwingCloseable);
        const result: Promise<void> = safeCloseable.close();
        expect(result).toBeUndefined();
      });

      test('should handle error', () => {
        let handledError: unknown;
        const safeCloseable = asSafeCloseable(throwingCloseable, (error) => {
          handledError = error;
        });

        const result: Promise<void> = safeCloseable.close();
        expect(result).toBeUndefined();
        expect(handledError).toBeInstanceOf(Error);
        expect((handledError as Error).message).toBe('Sync in async error');
      });
    });
  });
});
