import type { OnEvent } from '../notifier/definition.ts';

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
   *
   * The parent invocation may have been tracked by a different tracker if multiple trackers share the same stack. In
   * that case, the `operation` may fall outside the current tracker's `TOperation` union.
   */
  readonly parentKey?: InvocationKey;

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
