import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { EventEmitter } from 'node:events';

import type { LogEntry, MemoryLogger } from '../../../src/logger/index.ts';
import { createMemoryLogger, OFF_LOGGER } from '../../../src/logger/index.ts';
import type { Closer, ProcessExitEvent, ProcessExitSignal, ProcessNotifier } from '../../../src/utils/index-node.ts';
import {
  asClosable,
  createDeferredValue,
  isProcessMain,
  onProcessExit,
  runProcessMain,
} from '../../../src/utils/index-node.ts';
import inner from '../../../src/utils/node/process-lifecycle.ts';
import { createTestLogger } from '../../test-kit.ts';

const moduleReference = import.meta.url;

describe('emitnlog.utils.node.process-lifecycle', () => {
  describe('isProcessMain', () => {
    afterEach(() => {
      inner[Symbol.for('@emitnlog:test')].processMain = undefined;
    });

    test('returns false when process.argv[1] does not match current file', () => {
      expect(isProcessMain(moduleReference)).toBe(false);
    });

    test('returns false when module reference is undefined', () => {
      expect(isProcessMain(undefined)).toBe(false);
    });

    test('returns false when module reference is dynamically determined', () => {
      const dynamicModuleReference =
        typeof __filename === 'string'
          ? __filename
          : typeof import.meta === 'object' && import.meta.url
            ? import.meta.url
            : undefined;

      expect(isProcessMain(dynamicModuleReference)).toBe(false);
    });

    test('returns true when test hook forces it', () => {
      inner[Symbol.for('@emitnlog:test')].processMain = true;
      expect(isProcessMain(moduleReference)).toBe(true);
    });

    test('returns false when test hook forces it', () => {
      inner[Symbol.for('@emitnlog:test')].processMain = false;
      expect(isProcessMain(moduleReference)).toBe(false);
    });
  });

  describe('runProcessMain', () => {
    beforeEach(() => {
      inner[Symbol.for('@emitnlog:test')].processMain = true;
    });

    afterEach(() => {
      inner[Symbol.for('@emitnlog:test')].processMain = undefined;
      vi.restoreAllMocks();
    });

    test('executes main function when current file is the process entry point', async () => {
      const mainSpy = vi.fn().mockResolvedValue(undefined);
      const startTime = Date.now();

      runProcessMain(moduleReference, mainSpy);

      // Wait for the async operation to complete
      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      const callArg = mainSpy.mock.calls[0][0];
      const { start, closer } = callArg;
      expect(start).toBeInstanceOf(Date);
      expect((start as Date).getTime()).toBeGreaterThanOrEqual(startTime);
      expect((start as Date).getTime()).toBeLessThanOrEqual(Date.now());

      expect(closer).toBeDefined();
      expect((closer as Closer).add).toBeTypeOf('function');
      expect((closer as Closer).size).toBe(0);
    });

    test('does not execute main function when current file is not the entry point', async () => {
      inner[Symbol.for('@emitnlog:test')].processMain = false;

      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(moduleReference, mainSpy);

      // Give it time to potentially execute (it shouldn't)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mainSpy).not.toHaveBeenCalled();
    });

    test('executes main function when module reference is undefined and current file is the entry point', async () => {
      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(undefined, mainSpy);

      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });
    });

    test('calls process.exit(1) when main function throws synchronously', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const error = new Error('Synchronous failure');
      const mainSpy = vi.fn().mockImplementation(() => {
        throw error;
      });

      runProcessMain(moduleReference, mainSpy, { logger: OFF_LOGGER });

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      expect(mainSpy).toHaveBeenCalledOnce();
    });

    test('calls process.exit(1) when main function rejects', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const error = new Error('Async failure');
      const mainSpy = vi.fn().mockRejectedValue(error);

      runProcessMain(moduleReference, mainSpy, { logger: OFF_LOGGER });

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      expect(mainSpy).toHaveBeenCalledOnce();
    });

    test('passes logger to lifecycle if provided as Logger instance', async () => {
      const logger = createTestLogger();
      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(moduleReference, mainSpy, { logger });

      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      expect(logger).toHaveLoggedWith('info', /starting main operation at .+ on process \d+/);
    });

    test('calls logger factory with start date when provided as function', async () => {
      const loggerFactorySpy = vi.fn().mockReturnValue(OFF_LOGGER);
      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(moduleReference, mainSpy, { logger: loggerFactorySpy });

      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      expect(loggerFactorySpy).toHaveBeenCalledOnce();
      const factoryArg = loggerFactorySpy.mock.calls[0][0];
      expect(factoryArg).toBeInstanceOf(Date);
    });

    test('passes OFF_LOGGER to main when logger option is not provided', async () => {
      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(moduleReference, mainSpy);

      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      const { logger } = mainSpy.mock.calls[0][0];
      expect(logger).toBe(OFF_LOGGER);
    });

    test('closes registered resources when a process exit signal is emitted', async () => {
      let closed = false;
      const deferred = createDeferredValue();

      runProcessMain(
        moduleReference,
        async ({ closer }) => {
          closer.add({
            close: () => {
              closed = true;
              deferred.resolve();
            },
          });

          await deferred.promise;
        },
        { logger: OFF_LOGGER },
      );

      process.emit('SIGINT');

      await vi.waitFor(() => {
        expect(closed).toBe(true);
      });
    });

    test('skips process exit listeners when skipOnProcessExit is true', async () => {
      const deferred = createDeferredValue();
      const signals: readonly ProcessExitSignal[] = [
        'SIGINT',
        'SIGTERM',
        'disconnect',
        'uncaughtException',
        'unhandledRejection',
      ];
      const countListeners = () => signals.reduce((total, signal) => total + process.listenerCount(signal), 0);
      const initialListeners = countListeners();

      runProcessMain(
        moduleReference,
        async () => {
          await deferred.promise;
        },
        { logger: OFF_LOGGER, skipOnProcessExit: true },
      );

      expect(countListeners()).toBe(initialListeners);

      deferred.resolve();

      await vi.waitFor(() => {
        expect(countListeners()).toBe(initialListeners);
      });
    });

    test('exposes lifecycle logger to main input', async () => {
      const deferredClose = createDeferredValue();

      let entries: readonly LogEntry[] | undefined;
      runProcessMain(
        moduleReference,
        async ({ logger, closer }) => {
          logger.i`custom lifecycle log`;

          closer.addAll(
            asClosable(() => {
              deferredClose.resolve();
            }),

            asClosable(() => {
              entries = [...(logger as MemoryLogger).entries];
            }),
          );
        },
        { logger: () => createMemoryLogger() },
      );

      await deferredClose.promise;

      expect(entries).toBeDefined();
      expect(entries).toEqual([
        {
          level: 'info',
          message: expect.stringMatching(/starting main operation at .+ on process \d+/),
          timestamp: expect.any(Number),
          iso: expect.stringContaining('T'),
        },
        {
          level: 'info',
          message: 'custom lifecycle log',
          timestamp: expect.any(Number),
          iso: expect.stringContaining('T'),
        },
        {
          level: 'info',
          message: expect.stringMatching(/the main operation on process \d+ finished at .+ after .+/),
          timestamp: expect.any(Number),
          iso: expect.stringContaining('T'),
        },
      ]);
    });

    test('closes logger after successful execution', async () => {
      const logger = createTestLogger();
      const closeSpy = vi.spyOn(logger, 'close').mockResolvedValue(undefined);

      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(moduleReference, mainSpy, { logger });

      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      await vi.waitFor(() => {
        expect(closeSpy).toHaveBeenCalled();
      });
    });

    test('closes logger after failed execution', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const logger = createTestLogger();
      const closeSpy = vi.spyOn(logger, 'close').mockResolvedValue(undefined);

      const error = new Error('Test error');
      const mainSpy = vi.fn().mockRejectedValue(error);

      runProcessMain(moduleReference, mainSpy, { logger });

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      expect(closeSpy).toHaveBeenCalled();
    });

    test('closes resources registered on closer after successful execution', async () => {
      const resource = { close: vi.fn().mockResolvedValue(undefined) };
      const mainSpy = vi.fn().mockImplementation(async ({ closer }: { closer: Closer }) => {
        closer.add(resource);
      });

      runProcessMain(moduleReference, mainSpy, { logger: OFF_LOGGER });

      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      await vi.waitFor(() => {
        expect(resource.close).toHaveBeenCalledTimes(1);
      });
    });

    test('closes resources registered on closer when execution fails', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const resource = { close: vi.fn().mockResolvedValue(undefined) };
      const error = new Error('boom');

      const mainSpy = vi.fn().mockImplementation(async ({ closer }: { closer: Closer }) => {
        closer.add(resource);
        throw error;
      });

      runProcessMain(moduleReference, mainSpy, { logger: OFF_LOGGER });

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      await vi.waitFor(() => {
        expect(resource.close).toHaveBeenCalledTimes(1);
      });
    });

    test('handles logger.close throwing without propagating error on success', async () => {
      const logger = createTestLogger();
      const closeSpy = vi.spyOn(logger, 'close').mockImplementation(() => {
        throw new Error('Close failed');
      });

      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(moduleReference, mainSpy, { logger });

      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      await vi.waitFor(() => {
        expect(closeSpy).toHaveBeenCalled();
      });

      // Should not throw - the close error is swallowed
    });

    test('handles logger.close throwing without propagating error on failure', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const logger = createTestLogger();
      const closeSpy = vi.spyOn(logger, 'close').mockImplementation(() => {
        throw new Error('Close failed');
      });

      const error = new Error('Main error');
      const mainSpy = vi.fn().mockRejectedValue(error);

      runProcessMain(moduleReference, mainSpy, { logger });

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('onProcessExit', () => {
    const createFakeNotifier = (): ProcessNotifier & { emit: (event: string, ...args: unknown[]) => void } => {
      const emitter = new EventEmitter();
      return {
        once: (event, listener) => emitter.once(event, listener),
        off: (event, listener) => emitter.off(event, listener),
        emit: (event, ...args) => {
          emitter.emit(event, ...args);
        },
      };
    };

    test('invokes listener on SIGINT', async () => {
      const notifier = createFakeNotifier();
      let events: readonly ProcessExitEvent[] = [];
      const listener = (event: ProcessExitEvent) => {
        events = [...events, event];
      };

      onProcessExit(listener, { notifier, logger: OFF_LOGGER });

      notifier.emit('SIGINT');

      await vi.waitFor(() => {
        expect(events).toHaveLength(1);
      });

      expect(events[0]).toEqual({ signal: 'SIGINT' });
    });

    test('invokes listener on SIGTERM', async () => {
      const notifier = createFakeNotifier();
      let events: readonly ProcessExitEvent[] = [];
      const listener = (event: ProcessExitEvent) => {
        events = [...events, event];
      };

      onProcessExit(listener, { notifier, logger: OFF_LOGGER });

      notifier.emit('SIGTERM');

      await vi.waitFor(() => {
        expect(events).toHaveLength(1);
      });

      expect(events[0]).toEqual({ signal: 'SIGTERM' });
    });

    test('invokes listener on disconnect', async () => {
      const notifier = createFakeNotifier();
      let events: readonly ProcessExitEvent[] = [];
      const listener = (event: ProcessExitEvent) => {
        events = [...events, event];
      };

      onProcessExit(listener, { notifier, logger: OFF_LOGGER });

      notifier.emit('disconnect');

      await vi.waitFor(() => {
        expect(events).toHaveLength(1);
      });

      expect(events[0]).toEqual({ signal: 'disconnect' });
    });

    test('invokes listener on uncaughtException with error', async () => {
      const notifier = createFakeNotifier();
      let events: readonly ProcessExitEvent[] = [];
      const listener = (event: ProcessExitEvent) => {
        events = [...events, event];
      };

      const error = new Error('Uncaught exception');

      onProcessExit(listener, { notifier, logger: OFF_LOGGER });

      notifier.emit('uncaughtException', error);

      await vi.waitFor(() => {
        expect(events).toHaveLength(1);
      });

      expect(events[0]).toEqual({ signal: 'uncaughtException', error });
    });

    test('invokes listener on unhandledRejection with error', async () => {
      const notifier = createFakeNotifier();
      let events: readonly ProcessExitEvent[] = [];
      const listener = (event: ProcessExitEvent) => {
        events = [...events, event];
      };

      const error = new Error('Unhandled rejection');

      onProcessExit(listener, { notifier, logger: OFF_LOGGER });

      notifier.emit('unhandledRejection', error);

      await vi.waitFor(() => {
        expect(events).toHaveLength(1);
      });

      expect(events[0]).toEqual({ signal: 'unhandledRejection', error });
    });

    test('only invokes listener once when multiple signals fire', async () => {
      const notifier = createFakeNotifier();
      let events: readonly ProcessExitEvent[] = [];
      const listener = (event: ProcessExitEvent) => {
        events = [...events, event];
      };

      onProcessExit(listener, { notifier, logger: OFF_LOGGER });

      notifier.emit('SIGINT');
      notifier.emit('SIGTERM');
      notifier.emit('disconnect');

      await vi.waitFor(() => {
        expect(events).toHaveLength(1);
      });

      expect(events[0]).toEqual({ signal: 'SIGINT' });
    });

    test('unregisters all handlers when closable is closed', async () => {
      const notifier = createFakeNotifier();
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      const closable = onProcessExit(listener, { notifier, logger: OFF_LOGGER });

      closable.close();

      notifier.emit('SIGINT');
      notifier.emit('SIGTERM');
      notifier.emit('disconnect');

      // Wait a bit to ensure no events fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callCount).toBe(0);
    });

    test('can be closed after a signal fires', async () => {
      const notifier = createFakeNotifier();
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      const closable = onProcessExit(listener, { notifier, logger: OFF_LOGGER });

      notifier.emit('SIGINT');

      await vi.waitFor(() => {
        expect(callCount).toBe(1);
      });

      closable.close();

      notifier.emit('SIGTERM');

      // Wait a bit to ensure second signal doesn't fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callCount).toBe(1);
    });

    test('uses process as default notifier when not provided', () => {
      const listener = () => {
        // no-op
      };

      // Should not throw - uses real process
      const closable = onProcessExit(listener, { logger: OFF_LOGGER });

      expect(closable).toBeDefined();
      expect(typeof closable.close).toBe('function');

      // Clean up
      closable.close();
    });

    test('closing is idempotent', async () => {
      const notifier = createFakeNotifier();
      let callCount = 0;
      const listener = () => {
        callCount++;
      };

      const closable = onProcessExit(listener, { notifier, logger: OFF_LOGGER });

      closable.close();
      closable.close();
      closable.close();

      notifier.emit('SIGINT');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callCount).toBe(0);
    });
  });
});
