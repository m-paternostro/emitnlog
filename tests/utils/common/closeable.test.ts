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
        const safeCloseable: SyncCloseable = asSafeCloseable(throwingCloseable);
        const result = safeCloseable.close();
        expect(result).toBeUndefined();
      });

      test('should handle error', () => {
        let handledError: unknown;
        const safeCloseable: SyncCloseable = asSafeCloseable(throwingCloseable, (error) => {
          handledError = error;
        });

        const result = safeCloseable.close();
        expect(result).toBeUndefined();
        expect(handledError).toBeInstanceOf(Error);
        expect((handledError as Error).message).toBe('Sync error');
      });

      test('should handle error with onError throwing', () => {
        const safeCloseable: SyncCloseable = asSafeCloseable(throwingCloseable, () => {
          throw new Error('On error error');
        });

        const result = safeCloseable.close();
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
        const safeCloseable: AsyncCloseable = asSafeCloseable(rejectingCloseable);
        const result = safeCloseable.close();
        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toBeUndefined();
      });

      test('should handle error', async () => {
        let handledError: unknown;
        const safeCloseable: AsyncCloseable = asSafeCloseable(rejectingCloseable, (error) => {
          handledError = error;
        });

        const result = safeCloseable.close();
        expect(result).toBeInstanceOf(Promise);

        expect(handledError).toBeUndefined();
        await expect(result).resolves.toBeUndefined();
        expect(handledError).toBeInstanceOf(Error);
        expect((handledError as Error).message).toBe('Async error');
      });

      test('should handle error with onError throwing', async () => {
        const safeCloseable: AsyncCloseable = asSafeCloseable(rejectingCloseable, () => {
          throw new Error('On error error');
        });

        const result = safeCloseable.close();
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
        const safeCloseable: AsyncCloseable = asSafeCloseable(throwingCloseable);
        const result: Promise<void> = safeCloseable.close();
        expect(result).toBeUndefined();
      });

      test('should handle error', () => {
        let handledError: unknown;
        const safeCloseable: AsyncCloseable = asSafeCloseable(throwingCloseable, (error) => {
          handledError = error;
        });

        const result = safeCloseable.close();
        expect(result).toBeUndefined();
        expect(handledError).toBeInstanceOf(Error);
        expect((handledError as Error).message).toBe('Sync in async error');
      });
    });
  });
});
