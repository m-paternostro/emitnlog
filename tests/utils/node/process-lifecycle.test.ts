import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { EventEmitter } from 'node:events';

import { OFF_LOGGER } from '../../../src/logger/off-logger.ts';
import {
  isProcessMain,
  onProcessExit,
  type ProcessExitEvent,
  type ProcessNotifier,
  runProcessMain,
} from '../../../src/utils/index-node.ts';
import inner from '../../../src/utils/node/process-lifecycle.ts';
import { createTestLogger } from '../../test-kit.ts';

describe('emitnlog.utils.node.process-lifecycle', () => {
  describe('isProcessMain', () => {
    afterEach(() => {
      inner[Symbol.for('@emitnlog:test')].processMain = undefined;
    });

    test('returns false when process.argv[1] does not match current file', () => {
      expect(isProcessMain()).toBe(false);
    });

    test('returns true when test hook forces it', () => {
      inner[Symbol.for('@emitnlog:test')].processMain = true;
      expect(isProcessMain()).toBe(true);
    });

    test('returns false when test hook forces it', () => {
      inner[Symbol.for('@emitnlog:test')].processMain = false;
      expect(isProcessMain()).toBe(false);
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

      runProcessMain(mainSpy);

      // Wait for the async operation to complete
      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      const callArg = mainSpy.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Date);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      expect(callArg.getTime()).toBeGreaterThanOrEqual(startTime);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      expect(callArg.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('does not execute main function when current file is not the entry point', async () => {
      inner[Symbol.for('@emitnlog:test')].processMain = false;

      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(mainSpy);

      // Give it time to potentially execute (it shouldn't)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mainSpy).not.toHaveBeenCalled();
    });

    test('calls process.exit(1) when main function throws synchronously', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const error = new Error('Synchronous failure');
      const mainSpy = vi.fn().mockImplementation(() => {
        throw error;
      });

      runProcessMain(mainSpy, { logger: OFF_LOGGER });

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      expect(mainSpy).toHaveBeenCalledOnce();
    });

    test('calls process.exit(1) when main function rejects', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const error = new Error('Async failure');
      const mainSpy = vi.fn().mockRejectedValue(error);

      runProcessMain(mainSpy, { logger: OFF_LOGGER });

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      expect(mainSpy).toHaveBeenCalledOnce();
    });

    test('passes logger to lifecycle if provided as Logger instance', async () => {
      const logger = createTestLogger();
      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(mainSpy, { logger });

      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      expect(logger).toHaveLoggedWith('info', 'starting the process main operation');
    });

    test('calls logger factory with start date when provided as function', async () => {
      const loggerFactorySpy = vi.fn().mockReturnValue(OFF_LOGGER);
      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(mainSpy, { logger: loggerFactorySpy });

      await vi.waitFor(() => {
        expect(mainSpy).toHaveBeenCalledOnce();
      });

      expect(loggerFactorySpy).toHaveBeenCalledOnce();
      const factoryArg = loggerFactorySpy.mock.calls[0][0];
      expect(factoryArg).toBeInstanceOf(Date);
    });

    test('closes logger after successful execution', async () => {
      const logger = createTestLogger();
      const closeSpy = vi.spyOn(logger, 'close').mockResolvedValue(undefined);

      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(mainSpy, { logger });

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

      runProcessMain(mainSpy, { logger });

      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      expect(closeSpy).toHaveBeenCalled();
    });

    test('handles logger.close throwing without propagating error on success', async () => {
      const logger = createTestLogger();
      const closeSpy = vi.spyOn(logger, 'close').mockImplementation(() => {
        throw new Error('Close failed');
      });

      const mainSpy = vi.fn().mockResolvedValue(undefined);

      runProcessMain(mainSpy, { logger });

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

      runProcessMain(mainSpy, { logger });

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
