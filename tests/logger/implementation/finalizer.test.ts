import { describe, expect, test, vi } from 'vitest';

import { implementation } from '../../../src/logger/index.ts';

describe('emitnlog.logger.implementation.finalizer', () => {
  describe('asSingleFinalizer', () => {
    test('should create empty finalizer when no finalizers provided', () => {
      const finalizer = implementation.asSingleFinalizer();

      expect(finalizer.flush).toBeUndefined();
      expect(finalizer.close).toBeUndefined();
    });

    test('should create finalizer with only flush when only flush methods exist', () => {
      const flush1 = vi.fn<() => void>();
      const flush2 = vi.fn<() => void>();

      const finalizer1 = { flush: flush1 };
      const finalizer2 = { flush: flush2 };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      expect(combined.flush).toBeDefined();
      expect(combined.close).toBeUndefined();

      combined.flush();

      expect(flush1).toHaveBeenCalledTimes(1);
      expect(flush2).toHaveBeenCalledTimes(1);
    });

    test('should create finalizer with only close when only close methods exist', () => {
      const close1 = vi.fn<() => void>();
      const close2 = vi.fn<() => void>();

      const finalizer1 = { close: close1 };
      const finalizer2 = { close: close2 };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      expect(combined.flush).toBeUndefined();
      expect(combined.close).toBeDefined();

      combined.close();

      expect(close1).toHaveBeenCalledTimes(1);
      expect(close2).toHaveBeenCalledTimes(1);
    });

    test('should create finalizer with both flush and close', () => {
      const flush1 = vi.fn<() => void>();
      const close1 = vi.fn<() => void>();
      const flush2 = vi.fn<() => void>();
      const close2 = vi.fn<() => void>();

      const finalizer1 = { flush: flush1, close: close1 };
      const finalizer2 = { flush: flush2, close: close2 };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      expect(combined.flush).toBeDefined();
      expect(combined.close).toBeDefined();

      combined.flush();
      expect(flush1).toHaveBeenCalledTimes(1);
      expect(flush2).toHaveBeenCalledTimes(1);

      combined.close();
      expect(close1).toHaveBeenCalledTimes(1);
      expect(close2).toHaveBeenCalledTimes(1);
    });

    test('should handle mix of sync and async flush methods', async () => {
      const syncFlush = vi.fn<() => void>();
      const asyncFlush = vi.fn<() => Promise<void>>(() => Promise.resolve());

      const finalizer1 = { flush: syncFlush };
      const finalizer2 = { flush: asyncFlush };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      const result = combined.flush();

      // Should return a promise when any finalizer is async
      expect(result).toBeInstanceOf(Promise);
      await result;

      expect(syncFlush).toHaveBeenCalledTimes(1);
      expect(asyncFlush).toHaveBeenCalledTimes(1);
    });

    test('should handle mix of sync and async close methods', async () => {
      const syncClose = vi.fn<() => void>();
      const asyncClose = vi.fn<() => Promise<void>>(() => Promise.resolve());

      const finalizer1 = { close: syncClose };
      const finalizer2 = { close: asyncClose };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      const result = combined.close();

      // Should return a promise when any finalizer is async
      expect(result).toBeInstanceOf(Promise);
      await result;

      expect(syncClose).toHaveBeenCalledTimes(1);
      expect(asyncClose).toHaveBeenCalledTimes(1);
    });

    test('should return void when all flush methods are sync', () => {
      const flush1 = vi.fn<() => void>();
      const flush2 = vi.fn<() => void>();

      const finalizer1 = { flush: flush1 };
      const finalizer2 = { flush: flush2 };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      combined.flush();

      expect(flush1).toHaveBeenCalledTimes(1);
      expect(flush2).toHaveBeenCalledTimes(1);
    });

    test('should return void when all close methods are sync', () => {
      const close1 = vi.fn<() => void>();
      const close2 = vi.fn<() => void>();

      const finalizer1 = { close: close1 };
      const finalizer2 = { close: close2 };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      combined.close();

      expect(close1).toHaveBeenCalledTimes(1);
      expect(close2).toHaveBeenCalledTimes(1);
    });

    test('should handle errors in async flush methods', async () => {
      const error = new Error('Flush failed');
      const failingFlush = vi.fn<() => Promise<void>>(() => Promise.reject(error));
      const successFlush = vi.fn<() => Promise<void>>(() => Promise.resolve());

      const finalizer1 = { flush: failingFlush };
      const finalizer2 = { flush: successFlush };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      await expect(combined.flush()).rejects.toThrow('Flush failed');

      expect(failingFlush).toHaveBeenCalledTimes(1);
      expect(successFlush).toHaveBeenCalledTimes(1);
    });

    test('should handle errors in async close methods', async () => {
      const error = new Error('Close failed');
      const failingClose = vi.fn<() => Promise<void>>(() => Promise.reject(error));
      const successClose = vi.fn<() => Promise<void>>(() => Promise.resolve());

      const finalizer1 = { close: failingClose };
      const finalizer2 = { close: successClose };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      await expect(combined.close()).rejects.toThrow('Close failed');

      expect(failingClose).toHaveBeenCalledTimes(1);
      expect(successClose).toHaveBeenCalledTimes(1);
    });

    test('should skip finalizers without requested method', () => {
      const flush = vi.fn<() => void>();
      const close = vi.fn<() => void>();

      const finalizer1 = { flush }; // No close
      const finalizer2 = { close }; // No flush
      const finalizer3 = {}; // Neither

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2, finalizer3);

      combined.flush();
      expect(flush).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();

      combined.close();
      expect(close).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple async finalizers', async () => {
      const flushes = [
        vi.fn<() => Promise<void>>(() => Promise.resolve()),
        vi.fn<() => Promise<void>>(() => Promise.resolve()),
        vi.fn<() => Promise<void>>(() => Promise.resolve()),
      ];

      const finalizers = flushes.map((flush) => ({ flush }));
      const combined = implementation.asSingleFinalizer(...finalizers);

      const result = combined.flush();
      expect(result).toBeInstanceOf(Promise);
      await result;

      flushes.forEach((flush) => {
        expect(flush).toHaveBeenCalledTimes(1);
      });
    });

    test('should handle single finalizer', () => {
      const flush = vi.fn<() => void>();
      const close = vi.fn<() => void>();

      const finalizer = { flush, close };
      const combined = implementation.asSingleFinalizer(finalizer);

      combined.flush();
      combined.close();

      expect(flush).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
    });

    test('should preserve order of execution', () => {
      const order: number[] = [];

      const finalizer1 = {
        flush: () => {
          order.push(1);
        },
        close: () => {
          order.push(1);
        },
      };

      const finalizer2 = {
        flush: () => {
          order.push(2);
        },
        close: () => {
          order.push(2);
        },
      };

      const finalizer3 = {
        flush: () => {
          order.push(3);
        },
        close: () => {
          order.push(3);
        },
      };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2, finalizer3);

      combined.flush();
      expect(order).toEqual([1, 2, 3]);

      order.length = 0;
      combined.close();
      expect(order).toEqual([1, 2, 3]);
    });

    test('should handle undefined return values', () => {
      const flush1 = vi.fn<() => void>(() => undefined);
      const flush2 = vi.fn<() => void>(() => undefined);

      const finalizer1 = { flush: flush1 };
      const finalizer2 = { flush: flush2 };

      const combined = implementation.asSingleFinalizer(finalizer1, finalizer2);

      combined.flush();

      expect(flush1).toHaveBeenCalledTimes(1);
      expect(flush2).toHaveBeenCalledTimes(1);
    });

    test('should handle async methods returning undefined', async () => {
      const asyncFlush = vi.fn<() => Promise<void>>(async () => undefined);

      const finalizer = { flush: asyncFlush };
      const combined = implementation.asSingleFinalizer(finalizer);

      const result = combined.flush();

      expect(result).toBeInstanceOf(Promise);
      await result;
      expect(asyncFlush).toHaveBeenCalledTimes(1);
    });
  });
});
