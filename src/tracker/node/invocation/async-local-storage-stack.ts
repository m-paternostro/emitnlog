import { AsyncLocalStorage } from 'node:async_hooks';

import type { Logger } from '../../../logger/definition.ts';
import type { InvocationKey } from '../../invocation/definition.ts';
import type { InvocationStack } from '../../invocation/stack/definition.ts';
import { createThreadSafeInvocationStack } from '../../invocation/stack/implementation.ts';

/**
 * Creates a thread-safe invocation stack backed by NodeJS's `AsyncLocalStorage`.
 *
 * @example
 *
 * ```ts
 * import { createAsyncLocalStorageInvocationStack } from 'emitnlog/tracker/node';
 *
 * const stack = createAsyncLocalStorageInvocationStack({ logger });
 * const tracker = createInvocationTracker({ stack });
 * const fetchUser = tracker.track('fetchUser', fetchUserFn);
 * await fetchUser('123');
 * ```
 *
 * @param options - The options to use to create the stack.
 * @returns A thread-safe `InvocationStack` for NodeJS environments.
 */
export const createAsyncLocalStorageInvocationStack = (options?: { readonly logger: Logger }): InvocationStack => {
  const asyncLocal = new AsyncLocalStorage<InvocationKey[]>();
  return createThreadSafeInvocationStack(asyncLocal, options);
};
