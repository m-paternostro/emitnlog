import type { InvocationKey } from './invocation-tracker.ts';

/**
 * A stack abstraction used by the invocation tracker to track the nesting of invocation keys.
 *
 * `InvocationStack` enables the tracker to determine parent-child relationships between invocations by tracking the
 * currently active `InvocationKey` at any point in the program. This is particularly useful when correlating nested or
 * reentrant function calls and building hierarchical traces.
 *
 * The tracker uses the top value from the stack (via `peek()`) to determine the parent for the next invocation. The
 * stack is updated automatically by the tracker: `push()` is called at the start of a tracked function, and `pop()` is
 * called after the function completes or throws. The return value of `pop()` is the key that was just removed.
 *
 * There are two built-in implementations:
 *
 * - `createInvocationStack()` — a synchronous, in-memory implementation (default). Suitable for browser or
 *   single-threaded environments.
 * - `createThreadSafeInvocationStack()` — a Node.js implementation that uses `AsyncLocalStorage` to maintain stack state
 *   across async boundaries.
 *
 * Clients may provide their own implementation if they need integration with custom async contexts, request-local
 * storage, or thread-local semantics in other platforms. Any implementation must conform to this interface.
 *
 * The stack is automatically closed when the associated tracker is closed.
 */
export type InvocationStack = {
  /**
   * Closes the stack, clearing all invocation keys.
   */
  readonly close: () => void;

  /**
   * Pushes a new invocation key onto the stack.
   */
  readonly push: (key: InvocationKey) => void;

  /**
   * Returns the top invocation key from the stack without removing it. Returns `undefined` if the stack is empty.
   */
  readonly peek: () => InvocationKey | undefined;

  /**
   * Removes the top invocation key from the stack and returns the removed key.If the stack is empty, returns
   * `undefined`.
   */
  readonly pop: () => InvocationKey | undefined;
};

/**
 * A stack that tracks the nesting of invocation keys without support for multithread scenarios.
 *
 * This stack is used to track parent-child relationships between invocations by pushing the `InvocationKey` of each
 * active function call and removing it after completion.
 *
 * This implementation is not thread-safe and is suitable for environments where each thread or event loop has its own
 * isolated context (e.g., browser, single-threaded Node).
 *
 * This is the default invocation stack used when creating an invocation tracker (`createInvocationTracker`).
 *
 * @returns A synchronous, in-memory invocation stack.
 */
export const createInvocationStack = (): InvocationStack => {
  const stack: InvocationKey[] = [];

  return {
    close: () => {
      stack.length = 0;
    },

    push: (key: InvocationKey) => {
      stack.push(key);
    },

    peek: () => stack.at(-1),

    pop: () => stack.pop(),
  };
};
