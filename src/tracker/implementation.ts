import type { Writable } from 'type-fest';

import type { Logger } from '../logger/definition.ts';
import { OFF_LOGGER } from '../logger/off-logger.ts';
import { appendPrefix, withPrefix } from '../logger/prefixed-logger.ts';
import { createEventNotifier } from '../notifier/implementation.ts';
import { generateRandomString } from '../utils/common/generate-random-string.ts';
import { isNotNullable } from '../utils/common/is-not-nullable.ts';
import type { Invocation, InvocationKey, InvocationTracker, PhasedInvocation, Tag } from './definition.ts';
import type { InvocationStack } from './stack/definition.ts';
import { createBasicInvocationStack, createThreadSafeInvocationStack } from './stack/implementation.ts';

/**
 * Creates an invocation tracker that monitors and notifies about operation invocations.
 *
 * Each tracker assigns a unique tracker ID and supports multiple listeners for lifecycle events:
 *
 * - `onInvoked`: all events, all phases
 * - `onStarted`: before invocation
 * - `onCompleted`: after successful invocation (sync or async)
 * - `onErrored`: after an error is thrown or a promise is rejected
 *
 * @example
 *
 * ```ts
 * const tracker = createInvocationTracker({ tags: [{ service: 'auth' }] });
 *
 * tracker.onCompleted((invocation) => {
 *   console.log(`${invocation.key.operation} completed in ${invocation.duration}ms`);
 * });
 *
 * const wrapped = tracker.track('saveUser', saveUserFn, { tags: [{ feature: 'signup' }] });
 *
 * await wrapped({ name: 'Jane' });
 * ```
 *
 * @example
 *
 * ```ts
 * // Creates a tracker for the operations 'fetchUser' and 'fetchAccount'.
 * const tracker = createInvocationTracker<'fetchUser', 'fetchAccount'>();
 * const fetchUser = tracker.track('fetchUser', fetchUserFn);
 * const fetchAccount = tracker.track('fetchAccount', fetchUserFn);
 * ```
 *
 * @param options Optional configuration for the tracker. @returns A new `InvocationTracker` instance.
 */
export const createInvocationTracker = <TOperation extends string = string>(options?: {
  /**
   * A stack implementation to manage parent-child relationships. If not specified, the default is thread-safe in node
   * environments and "simple" in others.
   *
   * The stack is closed when the tracker is closed.
   *
   * If multiple trackers share the same stack instance, invocations may form cross-tracker parent-child relationships.
   * This enables advanced use cases (e.g., linking invocations across components), but should only be done with a
   * thread-safe stack to avoid incorrect nesting.
   */
  readonly stack?: InvocationStack;

  /**
   * Optional tags that will be added to every invocation tracked by this tracker.
   */
  readonly tags?: readonly Tag[];

  /**
   * An optional logger used to emit tracker-level log messages.
   */
  readonly logger?: Logger;
}): InvocationTracker<TOperation> => {
  const trackerId = generateRandomString();
  const logger = options?.logger ?? OFF_LOGGER;

  const invokedNotifier = createEventNotifier<Invocation<TOperation>>();
  const startedNotifier = createEventNotifier<PhasedInvocation<'started', TOperation>>();
  const completedNotifier = createEventNotifier<PhasedInvocation<'completed', TOperation>>();
  const erroredNotifier = createEventNotifier<PhasedInvocation<'errored', TOperation>>();

  const trackerLogger = withPrefix(logger, `tracker.${trackerId}`, { fallbackPrefix: 'emitnlog' });
  const stack = options?.stack ?? stackFactory({ logger: trackerLogger });

  let closed = false;
  let counter = -1;

  const tracker: InvocationTracker<TOperation> = {
    id: trackerId,

    close: () => {
      if (!closed) {
        trackerLogger.i`closing`;
        closed = true;

        invokedNotifier.close();
        stack.close();
      }
    },

    onInvoked: invokedNotifier.onEvent,
    onStarted: startedNotifier.onEvent,
    onCompleted: completedNotifier.onEvent,
    onErrored: erroredNotifier.onEvent,

    isTracked: (value) => {
      const id = toTrackedTrackerId(value);
      return id === trackerId ? 'this' : id ? 'other' : false;
    },

    track: (operation, fn, opt) => {
      const trackedLogger = appendPrefix(trackerLogger, operation);

      if (closed) {
        trackedLogger.d`the tracker is closed`;
        return fn;
      }

      // tags do not affect this by design.
      if (toTrackedTrackerId(fn) === trackerId) {
        return fn;
      }

      const tags = mergeTags(options?.tags, opt?.tags);

      const trackedFn = (...args: Parameters<typeof fn>) => {
        const argsLength = (args as unknown[]).length;
        const index = ++counter;
        const invocationLogger = appendPrefix(trackedLogger, String(index));

        const parentKey = stack.peek();

        const key: InvocationKey<TOperation> = {
          id: `${trackerId}.${operation}.${index}`,
          trackerId,
          operation,
          index,
        };

        stack.push(key);

        const notifyStarted = () => {
          const invocation: Writable<PhasedInvocation<'started', TOperation>> = { key, phase: 'started' };

          if (parentKey) {
            invocation.parentKey = parentKey;
          }

          if (argsLength) {
            invocation.args = args;
          }

          if (tags?.length) {
            invocation.tags = tags;
          }

          invokedNotifier.notify(invocation);
          startedNotifier.notify(invocation);
        };

        const notifyCompleted = (duration: number, promiseLike: boolean, result: unknown) => {
          const invocation: Writable<PhasedInvocation<'completed', TOperation>> = {
            key,
            phase: 'completed',
            duration,
            args,
            result,
          };

          if (parentKey) {
            invocation.parentKey = parentKey;
          }

          if (argsLength) {
            invocation.args = args;
          }

          if (tags?.length) {
            invocation.tags = tags;
          }

          if (promiseLike) {
            invocation.promiseLike = true;
          }

          invokedNotifier.notify(invocation);
          completedNotifier.notify(invocation);
        };

        const notifyErrored = (duration: number, promiseLike: boolean, error: unknown) => {
          const invocation: Writable<PhasedInvocation<'errored', TOperation>> = {
            key,
            phase: 'errored',
            duration,
            args,
            error,
          };

          if (parentKey) {
            invocation.parentKey = parentKey;
          }

          if (argsLength) {
            invocation.args = args;
          }

          if (tags?.length) {
            invocation.tags = tags;
          }

          if (promiseLike) {
            invocation.promiseLike = true;
          }

          invokedNotifier.notify(invocation);
          erroredNotifier.notify(invocation);
        };

        invocationLogger.args(args).i`starting with ${argsLength} args`;
        notifyStarted();

        let result: unknown;
        const start = performance.now();
        try {
          result = fn(...args);
        } catch (error) {
          const duration = performance.now() - start;
          stack.pop();
          invocationLogger.args(error).e`an error was thrown '${error}'`;
          notifyErrored(duration, false, error);

          throw error;
        }

        if (!isPromiseLike(result)) {
          const duration = performance.now() - start;
          stack.pop();
          invocationLogger.i`completed`;
          notifyCompleted(duration, false, result);

          return result;
        }

        return result.then(
          (r) => {
            const duration = performance.now() - start;
            stack.pop();
            invocationLogger.i`resolved`;
            notifyCompleted(duration, true, r);

            return r;
          },
          (error: unknown) => {
            const duration = performance.now() - start;
            stack.pop();
            invocationLogger.args(error).e`rejected`;
            notifyErrored(duration, true, error);

            throw error;
          },
        );
      };

      trackedFn[trackedSymbol] = trackerId;
      return trackedFn as unknown as typeof fn;
    },
  };

  return tracker;
};

const trackedSymbol = Symbol('tracked');

const toTrackedTrackerId = (value: unknown): string | undefined =>
  isNotNullable(value) &&
  typeof value === 'function' &&
  trackedSymbol in value &&
  typeof value[trackedSymbol] === 'string'
    ? value[trackedSymbol]
    : undefined;

const isPromiseLike = <T>(value: unknown): value is PromiseLike<T> =>
  isNotNullable(value) && typeof value === 'object' && 'then' in value && typeof value.then === 'function';

const mergeTags = (
  tags1: readonly Tag[] | undefined,
  tags2: readonly Tag[] | undefined,
): readonly Tag[] | undefined => {
  if (tags1?.length) {
    return tags2?.length ? [...tags1, ...tags2] : tags1;
  }

  if (tags2?.length) {
    return tags2;
  }

  return undefined;
};

let stackFactory: (options: { readonly logger: Logger }) => InvocationStack = createBasicInvocationStack;

void (async () => {
  try {
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && typeof process.versions.node === 'string') {
      const { AsyncLocalStorage } = await import('node:async_hooks');
      const storage = new AsyncLocalStorage<InvocationKey[]>();
      stackFactory = (options) => {
        options.logger.d`creating a thread-safe stack using node:async_hooks`;
        const stack = createThreadSafeInvocationStack(storage, options);
        return stack;
      };
    }
  } catch {
    // Ignore
  }
})();
