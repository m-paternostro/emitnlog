import type { InvocationKey } from '../definition.ts';

/**
 * A stack abstraction used by the invocation tracker (`createInvocationTracker`) to track the nesting of invocation
 * keys.
 *
 * `InvocationStack` enables the tracker to determine parent-child relationships between invocations by tracking the
 * currently active `InvocationKey` at any point in the program. This is particularly useful when correlating nested or
 * reentrant function calls and building hierarchical traces.
 *
 * The tracker uses the top value from the stack (via `peek()`) to determine the parent for the next invocation. The
 * stack is updated automatically by the tracker: `push()` is called at the start of a tracked function, and `pop()` is
 * called after the function completes or throws. The return value of `pop()` is the key that was just removed.
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
 * A stack storage to support thread-safe scenarios, modeled after NodeJS's `AsyncLocalStorage`.
 */
export interface AsyncStackStorage {
  getStore(): InvocationKey[] | undefined;
  enterWith(store: InvocationKey[]): void;
  disable(): void;
}
