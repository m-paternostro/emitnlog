import type { Writable } from 'type-fest';

import type { Logger } from '../../logger/definition.ts';
import { OFF_LOGGER } from '../../logger/off-logger.ts';
import { appendPrefix, withPrefix } from '../../logger/prefixed-logger.ts';
import { createEventNotifier } from '../../notifier/implementation.ts';
import { generateRandomString } from '../../utils/common/generate-random-string.ts';
import { isNotNullable } from '../../utils/common/is-not-nullable.ts';
import type {
  CompletedStage,
  ErroredStage,
  Invocation,
  InvocationAtStage,
  InvocationKey,
  InvocationTracker,
  InvocationTrackerOptions,
  Tag,
  Tags,
} from './definition.ts';
import type { InvocationStack } from './stack/definition.ts';
import { createBasicInvocationStack, createThreadSafeInvocationStack } from './stack/implementation.ts';

/**
 * Creates an invocation tracker that monitors and notifies about operation invocations.
 *
 * Each tracker assigns a unique tracker ID and supports multiple listeners for invocations:
 *
 * - `onInvoked`: all invocations regardless of the stage
 * - `onStarted`: before invocation
 * - `onCompleted`: after successful invocation (sync or async)
 * - `onErrored`: after an error is thrown or a promise is rejected
 *
 * Tags can be used to provide contextual metadata for invocations and can be specified in two places:
 *
 * - Globally, when creating the tracker: `createInvocationTracker({ tags })`
 * - Per-invocation, when calling `track`: `tracker.track('op', fn, { tags })`
 *
 * Tags can be defined either as:
 *
 * - An array: `[{ name: 'foo', value: 'bar' }]`
 * - A record: `{ foo: 'bar' }`
 *
 * During invocation, the two sources of tags are merged. If the same tag name appears in both sources, their values are
 * de-duplicated. The merged result is sorted by name and value and stored as an array.
 *
 * Although the original tag sources (arrays, records, or tag objects) can be mutated during execution, the merged tags
 * are captured and fixed at invocation start. This ensures consistency across the `started`, `completed`, and `errored`
 * stages of a single invocation.
 *
 * @example
 *
 * ```ts
 * import { createInvocationTracker } from 'emitnlog/tracker';
 *
 * const tracker = createInvocationTracker({ tags: { service: 'auth' } });
 *
 * tracker.onCompleted((invocation) => {
 *   console.log(`${invocation.key.operation} completed in ${invocation.duration}ms`);
 *
 *   // [{ name: 'feature', value: 'signup' }, { name: 'service', value: 'auth' }]
 *   console.log(invocation.tags);
 * });
 *
 * const wrapped = tracker.track('saveUser', saveUserFn, { tags: [{ name: 'feature', value: 'signup' }] });
 * await wrapped({ name: 'Jane' });
 * ```
 *
 * @example
 *
 * ```ts
 * import { createInvocationTracker } from 'emitnlog/tracker';
 *
 * // Creates a tracker for the operations 'fetchUser' and 'fetchAccount'.
 * const tracker = createInvocationTracker<'fetchUser', 'fetchAccount'>();
 * const fetchUser = tracker.track('fetchUser', fetchUserFn);
 * const fetchAccount = tracker.track('fetchAccount', fetchUserFn);
 * ```
 *
 * @param options Optional configuration for the tracker. @returns A new `InvocationTracker` instance.
 */
export const createInvocationTracker = <TOperation extends string = string>(
  options?: InvocationTrackerOptions,
): InvocationTracker<TOperation> => {
  const trackerId = generateRandomString();
  const logger = options?.logger ?? OFF_LOGGER;

  const invokedNotifier = createEventNotifier<Invocation<TOperation>>();
  const startedNotifier = createEventNotifier<InvocationAtStage<'started', TOperation>>();
  const completedNotifier = createEventNotifier<InvocationAtStage<'completed', TOperation>>();
  const erroredNotifier = createEventNotifier<InvocationAtStage<'errored', TOperation>>();

  const trackerLogger = withPrefix(logger, '', { fallbackPrefix: `emitnlog.invocation-tracker.${trackerId}` });
  const stack = options?.stack ?? stackFactory({ logger: trackerLogger });

  let closed = false;
  let counter = -1;

  const tracker: InvocationTracker<TOperation> = {
    id: trackerId,

    close: () => {
      if (!closed) {
        trackerLogger.d`closing tracker`;
        closed = true;

        invokedNotifier.close();
        startedNotifier.close();
        completedNotifier.close();
        erroredNotifier.close();
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
      const trackedLogger = appendPrefix(trackerLogger, `operation.${operation}`);

      if (closed) {
        trackedLogger.d`the tracker is closed`;
        return fn;
      }

      // tags do not affect this by design.
      if (toTrackedTrackerId(fn) === trackerId) {
        return fn;
      }

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

        const mergedTags = mergeTags(options?.tags, opt?.tags);

        const notifyStarted = () => {
          const invocation: Writable<InvocationAtStage<'started', TOperation>> = { key, stage: { type: 'started' } };

          if (parentKey) {
            invocation.parentKey = parentKey;
          }

          if (argsLength) {
            invocation.args = args;
          }

          if (mergedTags?.length) {
            invocation.tags = mergedTags;
          }

          invokedNotifier.notify(invocation);
          startedNotifier.notify(invocation);
        };

        const notifyCompleted = (duration: number, promiseLike: boolean, result: unknown) => {
          const stage: Writable<CompletedStage> = { type: 'completed', duration, result };

          if (promiseLike) {
            stage.promiseLike = true;
          }

          const invocation: Writable<InvocationAtStage<'completed', TOperation>> = { key, stage };

          if (parentKey) {
            invocation.parentKey = parentKey;
          }

          if (argsLength) {
            invocation.args = args;
          }

          if (mergedTags?.length) {
            invocation.tags = mergedTags;
          }

          invokedNotifier.notify(invocation);
          completedNotifier.notify(invocation);
        };

        const notifyErrored = (duration: number, promiseLike: boolean, error: unknown) => {
          const stage: Writable<ErroredStage> = { type: 'errored', duration, error };

          if (promiseLike) {
            stage.promiseLike = true;
          }

          const invocation: Writable<InvocationAtStage<'errored', TOperation>> = { key, stage };

          if (parentKey) {
            invocation.parentKey = parentKey;
          }

          if (argsLength) {
            invocation.args = args;
          }

          if (mergedTags?.length) {
            invocation.tags = mergedTags;
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

const trackedSymbol = Symbol.for('@emitnlog/tracker/tracked');

const toTrackedTrackerId = (value: unknown): string | undefined =>
  isNotNullable(value) &&
  typeof value === 'function' &&
  trackedSymbol in value &&
  typeof value[trackedSymbol] === 'string'
    ? value[trackedSymbol]
    : undefined;

const isPromiseLike = <T>(value: unknown): value is PromiseLike<T> =>
  isNotNullable(value) && typeof value === 'object' && 'then' in value && typeof value.then === 'function';

const mergeTags = (tags1: Tags | undefined, tags2: Tags | undefined): readonly Tag[] | undefined => {
  if (tags1 && typeof tags1 === 'object' && !Array.isArray(tags1)) {
    tags1 = Object.keys(tags1).map((name) => ({ name, value: (tags1 as Record<string, Tag['value']>)[name] }));
  }

  if (tags2 && typeof tags2 === 'object' && !Array.isArray(tags2)) {
    tags2 = Object.keys(tags2).map((name) => ({ name, value: (tags2 as Record<string, Tag['value']>)[name] }));
  }

  if (!tags1?.length && !tags2?.length) {
    return undefined;
  }

  const mergedTags: Tag[] = [];
  const map = new Map<string, Set<Tag['value']>>();

  const addTag = (tag: Tag): void => {
    let values = map.get(tag.name);
    if (!values) {
      values = new Set();
      map.set(tag.name, values);
    }

    if (!values.has(tag.value)) {
      values.add(tag.value);
      mergedTags.push(tag);
    }
  };

  tags1?.forEach(addTag);
  tags2?.forEach(addTag);
  return mergedTags.sort((a, b) => a.name.localeCompare(b.name) || String(a.value).localeCompare(String(b.value)));
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
