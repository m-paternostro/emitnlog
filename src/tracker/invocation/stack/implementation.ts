import type { Logger } from '../../../logger/definition.ts';
import { OFF_LOGGER } from '../../../logger/off-logger.ts';
import { withPrefix } from '../../../logger/prefixed-logger.ts';
import type { InvocationKey } from '../definition.ts';
import type { AsyncStackStorage, InvocationStack } from './definition.ts';

/**
 * Creates a basic invocation stack that tracks the nesting of invocation keys without support for multithread
 * scenarios.
 *
 * This stack is used to track parent-child relationships between invocations by pushing the `InvocationKey` of each
 * active function call and removing it after completion.
 *
 * This implementation is not thread-safe and is suitable for environments where each thread or event loop has its own
 * isolated context (e.g., browser, single-threaded Node).
 *
 * @example
 *
 * ```ts
 * const stack = createBasicInvocationStack({ logger });
 * const tracker = createInvocationTracker({ stack });
 * const fetchUser = tracker.track('fetchUser', fetchUserFn);
 * await fetchUser('123');
 * ```
 *
 * @param options - The options to use to create the stack.
 * @returns A synchronous, in-memory invocation stack.
 */
export const createBasicInvocationStack = (options?: { readonly logger: Logger }): InvocationStack => {
  const logger = withPrefix(options?.logger ?? OFF_LOGGER, 'stack.basic', { fallbackPrefix: 'emitnlog.tracker' });
  const stack: InvocationKey[] = [];

  logger.d`creating stack`;
  return {
    close: () => {
      logger.d`closing`;
      stack.length = 0;
    },

    push: (key: InvocationKey) => {
      logger.t`pushing key '${key.id}'`;
      stack.push(key);
    },

    peek: () => stack.at(-1),

    pop: () => {
      const key = stack.pop();
      logger.t`${key ? `popped key '${key.id}'` : 'no key to pop'}`;
      return key;
    },
  };
};

/**
 * Creates an invocation stack that uses a asynchronous storage to preserve the correct nesting of invocations across
 * async calls, promises, and timers — making it the recommended implementation in Node.js environments.
 *
 * The stack is automatically scoped per async context, so values pushed in one async task will not leak into others.
 *
 * @example
 *
 * ```ts
 * const storage = ...;
 * const stack = createThreadSafeInvocationStack(storage, { logger });
 * const tracker = createInvocationTracker({ stack });
 * const fetchUser = tracker.track('fetchUser', fetchUserFn);
 * await fetchUser('123');
 * ```
 *
 * @returns A thread-safe `InvocationStack` for Node.js environments.
 */
export const createThreadSafeInvocationStack = (
  storage: AsyncStackStorage,
  options?: { readonly logger: Logger },
): InvocationStack => {
  const logger = withPrefix(options?.logger ?? OFF_LOGGER, 'stack.thread-safe', { fallbackPrefix: 'emitnlog.tracker' });
  logger.d`creating stack`;
  return {
    close: () => {
      logger.d`closing`;
      storage.disable();
    },

    push: (key: InvocationKey) => {
      logger.t`pushing key '${key.id}'`;
      const current = storage.getStore() ?? [];
      storage.enterWith([...current, key]);
    },

    peek: () => {
      const current = storage.getStore();
      return current?.at(-1);
    },

    pop: () => {
      const current = storage.getStore();
      if (!current?.length) {
        logger.t`no key to pop`;
        return undefined;
      }

      logger.t`popping key '${current.at(-1)?.id}'`;
      const updated = current.slice(0, -1);
      storage.enterWith(updated);
      return current.at(-1);
    },
  };
};
