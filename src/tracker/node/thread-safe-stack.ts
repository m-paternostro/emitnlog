import { AsyncLocalStorage } from 'node:async_hooks';

import type { InvocationKey } from '../invocation-tracker.ts';
import type { InvocationStack } from '../stack.ts';

/**
 * Creates an `InvocationStack` implementation that is safe across asynchronous boundaries by using Node.js
 * `AsyncLocalStorage`.
 *
 * This stack preserves the correct nesting of invocations across async calls, promises, and timers — making it the
 * recommended implementation in Node.js environments.
 *
 * The stack is automatically scoped per async context, so values pushed in one async task will not leak into others.
 *
 * @example
 *
 * ```ts
 * const stack = createThreadSafeInvocationStack();
 * const tracker = createInvocationTracker({ stack });
 * const fetchUser = tracker.track('fetchUser', fetchUserFn);
 * await fetchUser('123');
 * ```
 *
 * @returns A thread-safe `InvocationStack` for Node.js environments.
 */
export const createThreadSafeInvocationStack = (): InvocationStack => {
  const asyncLocal = new AsyncLocalStorage<InvocationKey[]>();
  return {
    close: () => {
      asyncLocal.disable();
    },

    push: (key: InvocationKey) => {
      const current = asyncLocal.getStore() ?? [];
      asyncLocal.enterWith([...current, key]);
    },

    peek: () => {
      const current = asyncLocal.getStore();
      return current?.at(-1);
    },

    pop: () => {
      const current = asyncLocal.getStore();
      if (!current?.length) {
        return undefined;
      }

      const updated = current.slice(0, -1);
      asyncLocal.enterWith(updated);
      return current.at(-1);
    },
  };
};
