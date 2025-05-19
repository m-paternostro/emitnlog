import type { Writable } from 'type-fest';

import type { Logger } from '../logger/logger.ts';
import { OFF_LOGGER } from '../logger/off-logger.ts';
import { withPrefix } from '../logger/prefixed-logger.ts';
import type { OnEvent } from '../notifier/definition.ts';
import { createEventNotifier } from '../notifier/implementation.ts';
import { generateRandomString } from '../utils/common/generate-random-string.ts';
import { isNotNullable } from '../utils/common/is-not-nullable.ts';
import type { InvocationStack } from './stack.ts';
import { createInvocationStack } from './stack.ts';

/**
 * Describes the unique identity of a tracked invocation.
 *
 * `InvocationKey` values are used for correlation, hierarchy tracking (via `parentKey`), and as the values stored in
 * the `InvocationStack`. The `id` property is a stable string identifier combining tracker ID, operation name, and
 * index - suitable for use in logs or cache keys.
 */
export type InvocationKey<TOperation extends string = string> = {
  /**
   * A unique string identifier for this invocation.
   */
  readonly id: string;

  /**
   * The ID of the tracker that created this invocation.
   */
  readonly trackerId: string;

  /**
   * The logical name of the operation being tracked.
   */
  readonly operation: TOperation;

  /**
   * A zero-based invocation index, unique within the tracker for this operation.
   */
  readonly index: number;
};

/**
 * Describes a lifecycle event for a tracked invocation.
 *
 * This object is passed to all tracker listeners (`onInvoked`, `onStarted`, etc.). It captures the identity (`key`),
 * optional `parentKey`, arguments, tags, and information about the phase of the invocation.
 *
 * The object is immutable. Each phase (`started`, `completed`, `errored`) includes only the fields relevant to that
 * phase.
 */
export type Invocation<TOperation extends string = string> = {
  /**
   * The unique key identifying this invocation.
   */
  readonly key: InvocationKey<TOperation>;

  /**
   * If present, the key of the parent invocation (from the invocation stack).
   */
  readonly parentKey?: InvocationKey<TOperation>;

  /**
   * If present, the arguments passed to the tracked operation.
   */
  readonly args?: readonly unknown[];

  /**
   * If present, the tags provided when creating the tracker or per invocation.
   */
  readonly tags?: readonly Tag[];
} & (
  | {
      /**
       * The phase of the invocation.
       */
      readonly phase: 'started';
    }
  | {
      /**
       * The phase of the invocation.
       */
      readonly phase: 'completed';

      /**
       * The duration of the invocation in milliseconds.
       */
      readonly duration: number;

      /**
       * If true, the tracked operation returned a thenable, typically a promise.
       */
      readonly promiseLike?: boolean;

      /**
       * The result of the invocation.
       */
      readonly result?: unknown;
    }
  | {
      /**
       * The phase of the invocation.
       */
      readonly phase: 'errored';

      /**
       * The duration of the invocation in milliseconds.
       */
      readonly duration: number;

      /**
       * If true, the tracked operation returned a thenable, typically a promise.
       */
      readonly promiseLike?: boolean;

      /**
       * The result of the invocation.
       */
      readonly error: unknown;
    }
);

/**
 * A flexible key-value tag that adds contextual metadata to a tracked invocation, being useful for filtering, routing,
 * correlation, and enriching logs or events.
 *
 * Tags may be provided when creating the tracker or per invocation. Tags from both levels are concatenated during
 * invocation. Duplicate keys are preserved (i.e., not deduplicated), allowing multiple tags with the same name.
 *
 * @example
 *
 * ```ts
 * { "service": "user", "region": "us-east-1", "feature": "login" }
 * ```
 */
export type Tag = { readonly [name: string]: string | number | boolean };

/**
 * The phases of an invocation.
 */
type Phase = Invocation['phase'];

/**
 * A narrowed version of `Invocation`, specific to a phase of the invocation.
 */
export type PhasedInvocation<TPhase extends Phase, TOperation extends string = string> = Invocation<TOperation> & {
  readonly phase: TPhase;
};

/**
 * A tracker that observes operation invocations and emits lifecycle events.
 *
 * This object is created via `createInvocationTracker()`. Once created, you can use `track(...)` to wrap operations for
 * tracking and register listeners for various invocation phases.
 */
export type InvocationTracker<TOperation extends string = string> = {
  /**
   * A unique identifier for this tracker instance.
   */
  readonly id: string;

  /**
   * Closes the tracker, preventing further tracking and releasing internal resources.
   */
  readonly close: () => void;

  /**
   * Returns whether the given operation has been tracked by this tracker, another tracker, or not at all.
   */
  readonly isTracked: (value: unknown) => 'this' | 'other' | false;

  /**
   * Wraps the given operation and tracks all its invocations. Returns the wrapped operation. If the operation is
   * already tracked by this tracker, it is returned as-is. Tags passed here are merged with the ones passed when the
   * tracker was created.
   *
   * @param operation The logical name of the operation being tracked.
   * @param fn The function that implements the operation.
   * @param options The options for the tracker.
   * @returns The wrapped operation.
   */
  readonly track: <F extends (...args: Parameters<F>) => ReturnType<F>>(
    operation: TOperation,
    fn: F,
    options?: { readonly tags?: readonly Tag[] },
  ) => F;

  /**
   * Registers a listener for all invocation events (any phase).
   *
   * These listeners are notified before the ones that are specified to each phase of the invocation.
   */
  readonly onInvoked: OnEvent<Invocation<TOperation>>;

  /**
   * Registers a listener for `started` events only.
   */
  readonly onStarted: OnEvent<PhasedInvocation<'started', TOperation>>;

  /**
   * Registers a listener for `completed` events only.
   */
  readonly onCompleted: OnEvent<PhasedInvocation<'completed', TOperation>>;

  /**
   * Registers a listener for `errored` events only.
   */
  readonly onErrored: OnEvent<PhasedInvocation<'errored', TOperation>>;
};

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
   * A stack implementation to manage parent-child relationships (defaults to a non-thread safe stack).
   *
   * The stack is closed when the tracker is closed.
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

  const stack = options?.stack ?? createInvocationStack();
  const trackerLogger = withPrefix(logger, `emitnlog.invocationTracker.${trackerId}`);

  let closed = false;
  let counter = -1;

  const tracker: InvocationTracker<TOperation> = {
    id: trackerId,

    close: () => {
      if (!closed) {
        trackerLogger.i`: closing`;
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
      const trackLogger = withPrefix(trackerLogger, `.${operation}`);

      if (closed) {
        trackLogger.d`: the tracker is closed`;
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
        const invocationLogger = withPrefix(trackLogger, `.${index}`);

        const currentKey = stack.peek();
        const parentKey = currentKey?.trackerId === trackerId ? (currentKey as InvocationKey<TOperation>) : undefined;

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

        invocationLogger.args(args).i`: starting with ${argsLength} args`;
        notifyStarted();

        let result: unknown;
        const start = performance.now();
        try {
          result = fn(...args);
        } catch (error) {
          const duration = performance.now() - start;
          stack.pop();
          invocationLogger.args(error).e`: an error was thrown '${error}'`;
          notifyErrored(duration, false, error);

          throw error;
        }

        if (!isPromiseLike(result)) {
          const duration = performance.now() - start;
          stack.pop();
          invocationLogger.i`: completed`;
          notifyCompleted(duration, false, result);

          return result;
        }

        return result.then(
          (r) => {
            const duration = performance.now() - start;
            stack.pop();
            invocationLogger.i`: resolved`;
            notifyCompleted(duration, true, r);

            return r;
          },
          (error: unknown) => {
            const duration = performance.now() - start;
            stack.pop();
            invocationLogger.args(error).e`: rejected`;
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
