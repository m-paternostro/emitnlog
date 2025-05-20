import { AsyncLocalStorage } from 'node:async_hooks';

import type { Logger } from '../../logger/definition.ts';
import type { InvocationKey } from '../definition.ts';
import type { InvocationStack } from '../stack/definition.ts';
import { createThreadSafeInvocationStack } from '../stack/implementation.ts';

/**
 * Creates a thread-safe invocation stack backed by NodeJS's `AsyncLocalStorage`.
 *
 * @example
 *
 * ```ts
 * const stack = createAsyncLocalStorageInvocationStack({ logger });
 * const tracker = createInvocationTracker({ stack });
 * const fetchUser = tracker.track('fetchUser', fetchUserFn);
 * await fetchUser('123');
 * ```
 *
 * @returns A thread-safe `InvocationStack` for Node.js environments.
 */
export const createAsyncLocalStorageInvocationStack = (options?: { readonly logger: Logger }): InvocationStack => {
  const asyncLocal = new AsyncLocalStorage<InvocationKey[]>();
  return createThreadSafeInvocationStack(asyncLocal, options);
};
