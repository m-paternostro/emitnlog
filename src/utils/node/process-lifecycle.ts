import type { Logger } from '../../logger/definition.ts';
import { withLogger } from '../../logger/off-logger.ts';
import { withPrefix } from '../../logger/prefixed-logger.ts';
import type { Closer, SyncClosable } from '../common/closable.ts';
import { asClosable, createCloser, safeClose } from '../common/closable.ts';
import { exhaustiveCheck } from '../common/exhaustive-check.ts';

/**
 * Indicates whether the current module is the main entry point of the running process.
 *
 * This is a thin wrapper around the familiar `require.main === module` pattern adapted for ESM shims.
 *
 * @example
 *
 * ```ts
 * if (isProcessMain()) {
 *   void main();
 * }
 * ```
 *
 * @returns `true` when the current file started the process, otherwise `false`.
 */
export const isProcessMain = () => {
  if (testScope.processMain === true) {
    return true;
  }

  if (typeof __filename === 'string') {
    return process.argv[1] === __filename;
  }

  if (typeof import.meta === 'object' && import.meta.url) {
    return import.meta.url === process.argv[1];
  }

  return false;
};

/**
 * Wraps the main entry point of a NodeJS process with automatic lifecycle management.
 *
 * This helper checks if the current module is the process entry point (via {@link isProcessMain}), and if so, executes
 * the provided async function. Moreover,
 *
 * - If the function "fails" (throws or rejects), the process exits with code `1`.
 * - If a logger is provided, it will be used to log the start and end of the process lifecycle, with the duration of the
 *   operation.
 *
 * If the current module is not the main entry point, this function does nothing. This allows the same module to be
 * safely imported elsewhere without side effects.
 *
 * The specified main method is invoked with an input object with the following properties:
 *
 * - `start`: The start `Date` of the process.
 * - `closer`: A `Closer` instance that can be used to register cleanup operations, immediately before the process exits.
 *
 * @example Simple usage:
 *
 * ```ts
 * import { runProcessMain } from 'emitnlog/utils';
 *
 * runProcessMain(async ({ start }) => {
 *   const args = process.argv.slice(2);
 *   console.log(`CLI started at ${start}`);
 *   // ... your application logic
 * });
 * ```
 *
 * @example With a logger factory for startup logging:
 *
 * ```ts
 * import { createConsoleErrorLogger, withPrefix } from 'emitnlog/logger';
 * import { runProcessMain } from 'emitnlog/utils';
 *
 * runProcessMain(
 *   async ({ start, closer }) => {
 *     const logger = createPluginLogger('backend', `backend-${start.valueOf()}`);
 *     closer.add(logger);
 *
 *     logger.i`starting HTTP bridge...`;
 *     // ... your application logic
 *   },
 *   { logger: (start) => withPrefix(createConsoleErrorLogger(), `backend-${start.valueOf()}`) },
 * );
 * ```
 *
 * @param main The async function to execute as the process entry point. Receives an input object as argument as
 *   described above.
 * @param options Optional configuration.
 */
export const runProcessMain = (
  main: (input: { readonly start: Date; readonly closer: Closer }) => Promise<void>,
  options?: {
    /**
     * A logger for lifecycle messages or a factory function that creates one. If a factory is provided, it receives the
     * same start `Date` passed to the `main` method, to enable timestamp-based logger configuration.
     */
    readonly logger?: Logger | ((start: Date) => Logger);
  },
) => {
  if (isProcessMain()) {
    const start = new Date();
    const logger = withPrefix(
      withLogger(typeof options?.logger === 'function' ? options.logger(start) : options?.logger),
      '',
      { fallbackPrefix: 'main' },
    );

    const closer = createCloser(logger);

    logger.i`starting the process main operation`;
    void Promise.resolve()
      .then(() => main({ start, closer }))
      .then(async () => {
        const duration = Date.now() - start.valueOf();
        logger.i`the process has closed after ${duration}ms`;
        await safeClose(closer);
      })
      .catch(async (error: unknown) => {
        const duration = Date.now() - start.valueOf();
        logger.args(error).e`an error occurred and the process has closed after ${duration}ms`;
        await safeClose(closer);
        process.exit(1);
      });
  }
};

// Do not add 'exit':
// - Fires on every normal shutdown
// - Runs after the event loop is drained and Node forbids asynchronous work at that point.
export type ProcessExitSignal = 'SIGINT' | 'SIGTERM' | 'disconnect' | 'uncaughtException' | 'unhandledRejection';

export type ProcessExitEvent<S extends ProcessExitSignal = ProcessExitSignal> = S extends
  | 'SIGINT'
  | 'SIGTERM'
  | 'disconnect'
  ? { readonly signal: S; readonly error?: undefined }
  : { readonly signal: S; readonly error: unknown };

export type ProcessExitListener<S extends ProcessExitSignal = ProcessExitSignal> = (event: ProcessExitEvent<S>) => void;

/**
 * Registers a listener that fires once when the process receives one of the `ProcessExitSignal` signals.
 *
 * All process signal handlers are cleared upon exit. Clients may close the returned closable to proactively unregister
 * then.
 *
 * @example
 *
 * ```ts
 * const subscribe = onProcessExit((event) => application.close(event.error), { logger });
 *
 * // if there is no need to monitor the process signals anymore...
 * subscribe.close();
 * ```
 *
 * @param listener Callback invoked with the exit event when the first configured signal fires.
 * @param options
 * @returns A synchronous closable to proactively unregister the listeners.
 */
export const onProcessExit = (
  listener: ProcessExitListener,
  options?: {
    /**
     * Alternative notifier implementing {@link ProcessNotifier} to replace the `process` instance.
     *
     * @default `process`
     */
    readonly notifier?: ProcessNotifier;

    readonly logger?: Logger;
  },
): SyncClosable => {
  const logger = withPrefix(withLogger(options?.logger), '', { fallbackPrefix: 'process-exit' });
  const notificationProcess = options?.notifier ?? process;

  let closable: SyncClosable | undefined = undefined;
  const closeAndListen: ProcessExitListener = (event) => {
    closable?.close();
    listener(event);
  };

  closable = asClosable(
    onProcessExitSignal('SIGINT', closeAndListen, notificationProcess, logger),
    onProcessExitSignal('SIGTERM', closeAndListen, notificationProcess, logger),
    onProcessExitSignal('disconnect', closeAndListen, notificationProcess, logger),
    onProcessExitSignal('uncaughtException', closeAndListen, notificationProcess, logger),
    onProcessExitSignal('unhandledRejection', closeAndListen, notificationProcess, logger),
  );

  return closable;
};

/**
 * The subset of the NodeJS `process` interface required by {@link onProcessExit}.
 *
 * Provide a custom implementation (for example, a fake emitter in unit tests) via `options.notifier`.
 */
export type ProcessNotifier = {
  once(eventName: ProcessExitSignal, listener: (...args: unknown[]) => void): void;
  off(eventName: ProcessExitSignal, listener: (...args: unknown[]) => void): void;
};

const onProcessExitSignal = (
  signal: ProcessExitSignal,
  listener: ProcessExitListener,
  notifier: ProcessNotifier,
  logger: Logger,
): SyncClosable => {
  const handler = (error: unknown) => {
    switch (signal) {
      case 'SIGINT':
      case 'SIGTERM':
      case 'disconnect':
        logger.d`process exited with signal '${signal}'`;
        listener({ signal });
        break;

      case 'uncaughtException':
      case 'unhandledRejection':
        logger.args(error).e`process exited with signal '${signal}' and error '${error}'`;
        listener({ signal, error });
        break;

      default:
        exhaustiveCheck(signal);
    }
  };

  notifier.once(signal, handler);
  return asClosable(() => {
    logger.t`removing process signal handler for '${signal}'`;
    notifier.off(signal, handler);
  });
};

const testScope: {
  /**
   * Forces the value to be returned by {@link isProcessMain}, which is used by {@link runProcessMain}.
   */
  processMain?: boolean | undefined;
} = {};

/**
 * Internal export to be used on tests only.
 *
 * @example
 *
 * ```ts
 * import inner from '../src/utils/node/process-lifecycle.ts';
 *
 * beforeEach(() => {
 *   inner[Symbol.for('@emitnlog:test')].processMain = true;
 * });
 *
 * afterEach(() => {
 *   inner[Symbol.for('@emitnlog:test')].processMain = undefined;
 * });
 * ```
 *
 * @internal
 */
export default { [Symbol.for('@emitnlog:test')]: testScope } as const;
