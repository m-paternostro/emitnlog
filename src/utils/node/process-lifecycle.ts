import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Logger } from '../../logger/definition.ts';
import { withLogger } from '../../logger/off-logger.ts';
import { withPrefix } from '../../logger/prefixed-logger.ts';
import type { Closer, SyncClosable } from '../common/closable.ts';
import { asClosable, createCloser, safeClose } from '../common/closable.ts';
import { stringifyDuration } from '../common/duration.ts';
import { exhaustiveCheck } from '../common/exhaustive-check.ts';

/**
 * Indicates whether the current module is the main entry point of the running process.
 *
 * The first argument `moduleReference` is used to detect if the module invoking this method is the entry point of the
 * process. The possible values are:
 *
 * - `import.meta.url` in ESM
 * - `__filename` or `module.filename` in CommonJS
 * - `undefined` if the application bundles the dependencies (or, at least, emitnlog)
 *
 * If it is not possible to know during development time how the code is distributed, use the following approach to
 * determine the value of the argument:
 *
 * ```ts
 * const moduleReference =
 *   typeof __filename === 'string'
 *     ? __filename
 *     : typeof import.meta === 'object' && import.meta.url
 *       ? import.meta.url
 *       : undefined;
 * ```
 *
 * @example
 *
 * ```ts
 * if (isProcessMain(import.meta.url)) {
 *   void main();
 * }
 * ```
 *
 * @param moduleReference `import.meta.url`, `__filename`, `module.filename`, or `undefined` as described above.
 * @returns `true` when the current file started the process, otherwise `false`.
 */
export const isProcessMain = (moduleReference: string | URL | undefined) => {
  if (testScope.processMain === true) {
    return true;
  }

  const scriptPath = toPath(process.argv[1]);
  if (!scriptPath) {
    return false;
  }

  if (toPath(moduleReference) === scriptPath) {
    return true;
  }

  if (typeof __filename === 'string' && toPath(__filename) === scriptPath) {
    return true;
  }

  if (typeof import.meta === 'object' && toPath(import.meta.url) === scriptPath) {
    return true;
  }

  return false;
};

const toPath = (value: string | URL | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value !== 'string') {
    value = value.toString();
  }

  if (value.includes('://')) {
    value = fileURLToPath(value);
  }

  return resolve(value);
};

/**
 * The input object passed to the `main` function of {@link runProcessMain}.
 *
 * @typeParam TSetup The setup data type. Defaults to `undefined` when no setup is provided.
 */
export type ProcessMainInput<TSetup = undefined> = {
  /**
   * The start of the process.
   */
  readonly start: Date;

  /**
   * A `Closer` instance that can be used to register cleanup operations.
   */
  readonly closer: Closer;

  /**
   * A logger instance, either the one passed via the `options` parameter or the `OFF_LOGGER`.
   *
   * This logger is closed when the process ends.
   */
  readonly logger: Logger;

  /**
   * Setup data provided by the caller.
   *
   * @default `undefined`
   */
  readonly setup: TSetup;
};

/**
 * Wraps the main entry point of a NodeJS process with automatic lifecycle management.
 *
 * This helper checks if the current module is the process entry point (via {@link isProcessMain}), and if so, executes
 * the provided async function. Moreover,
 *
 * - If the function "fails" (throws or rejects), the process exits with code `1`.
 * - If a logger is provided via the `options` parameter, it will be used to log the start and end of the process
 *   lifecycle, with the duration of the operation. This logger is closed when the applications exists.
 *
 * If the current module is not the main entry point, this function does nothing. This allows the same module to be
 * safely imported elsewhere without side effects.
 *
 * The specified main method is invoked with an input object with the following properties:
 *
 * - `start`: The start `Date` of the process.
 * - `closer`: A `Closer` instance that can be used to register cleanup operations, immediately before the process exits.
 * - `logger`: A logger instance, either the one passed via the `options` parameter or the `OFF_LOGGER`.
 * - `setup`: Setup data produced by `options.setup` when provided, otherwise `undefined`.
 *
 * The first argument `moduleReference` is used to detect if the module invoking this method is the entry point of the
 * process. The possible values are:
 *
 * - `import.meta.url` in ESM
 * - `__filename` or `module.filename` in CommonJS
 * - `undefined` if the application bundles the dependencies (or, at least, emitnlog)
 *
 * If it is not possible to know during development time how the code is distributed, use the following approach to
 * determine the value of the argument:
 *
 * ```ts
 * const moduleReference =
 *   typeof __filename === 'string'
 *     ? __filename
 *     : typeof import.meta === 'object' && import.meta.url
 *       ? import.meta.url
 *       : undefined;
 * ```
 *
 * @example Simple usage (ESM):
 *
 * ```ts
 * import { runProcessMain } from 'emitnlog/utils';
 *
 * runProcessMain(import.meta.url, async ({ start }) => {
 *   const args = process.argv.slice(2);
 *   console.log(`CLI started at ${start}`);
 *   // ... your application logic
 * });
 * ```
 *
 * @example Simple usage (CommonJS):
 *
 * ```ts
 * import { runProcessMain } from 'emitnlog/utils';
 *
 * runProcessMain(__filename, async ({ start }) => {
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
 *   undefined,
 *   async ({ start, closer, logger }) => {
 *     logger.i`starting HTTP bridge...`;
 *     // ... your application logic
 *   },
 *   { logger: (start) => withPrefix(createConsoleErrorLogger(), `backend-${start.valueOf()}`) },
 * );
 * ```
 *
 * @example With setup data and a logger factory that uses it:
 *
 * ```ts
 * import { createConsoleErrorLogger, withPrefix } from 'emitnlog/logger';
 * import { runProcessMain } from 'emitnlog/utils';
 *
 * runProcessMain(
 *   undefined,
 *   async ({ setup, logger }) => {
 *     logger.i`starting ${setup.name}...`;
 *     // ... your application logic
 *   },
 *   {
 *     setup: () => ({ name: 'backend' }),
 *     logger: (start, setup) => withPrefix(createConsoleErrorLogger(), `${setup.name}-${start.valueOf()}`),
 *   },
 * );
 * ```
 *
 * @param moduleReference `import.meta.url`, `__filename`, `module.filename`, or `undefined` as described above.
 * @param main The async function to execute as the process entry point. Receives an input object as argument as
 *   described above.
 * @param options Optional configuration.
 */

export function runProcessMain(
  moduleReference: string | URL | undefined,
  main: (input: ProcessMainInput) => Promise<void>,
  options?: {
    readonly setup?: undefined;

    /**
     * A logger or a factory function that creates one. If a factory is provided, it receives the same start `Date`
     * passed to the `main` method, to enable timestamp-based logger configuration.
     */
    readonly logger?: Logger | ((start: Date, setup: undefined) => Logger);
  },
): void;
export function runProcessMain<TSetup>(
  moduleReference: string | URL | undefined,
  main: (input: ProcessMainInput<TSetup>) => Promise<void>,
  options?: {
    /**
     * A setup data that is then passed to `options.logger` and `main`.
     *
     * @param start The start `Date` of the process.
     * @returns The setup data
     */
    readonly setup: (start: Date) => TSetup;

    /**
     * A logger or a factory function that creates one. If a factory is provided, it receives the same start `Date`
     * passed to the `main` method, to enable timestamp-based logger configuration.
     */
    readonly logger?: Logger | ((start: Date, setup: TSetup) => Logger);
  },
): void;
export function runProcessMain<TSetup>(
  moduleReference: string | URL | undefined,
  main: (input: ProcessMainInput<TSetup>) => Promise<void>,
  options?: {
    /**
     * A setup data that is then passed to `options.logger` and `main`.
     *
     * @param start The start `Date` of the process.
     * @returns The setup data
     */
    readonly setup?: (start: Date) => TSetup;

    /**
     * A logger or a factory function that creates one. If a factory is provided, it receives the same start `Date`
     * passed to the `main` method, to enable timestamp-based logger configuration.
     */
    readonly logger?: Logger | ((start: Date, setup: TSetup) => Logger);
  },
): void {
  if (isProcessMain(moduleReference)) {
    const start = new Date();
    const setup = (options?.setup ? options.setup(start) : undefined) as TSetup;
    const logger = withLogger(typeof options?.logger === 'function' ? options.logger(start, setup) : options?.logger);
    const closer = createCloser(logger);

    logger.i`starting the process main operation at ${start}`;
    void Promise.resolve()
      .then(() => main({ start, closer, logger, setup }))
      .then(async () => {
        const end = new Date();
        logger.i`the process has closed at ${end} after ${stringifyDuration(end.valueOf() - start.valueOf())}`;
        await safeClose(closer);
      })
      .catch(async (error: unknown) => {
        const end = new Date();
        logger.args(error)
          .e`an error occurred and the process has closed at ${end} after ${stringifyDuration(end.valueOf() - start.valueOf())}`;
        await safeClose(closer);
        process.exit(1);
      });
  }
}

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
