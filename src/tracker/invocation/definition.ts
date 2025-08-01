import type { Logger } from '../../logger/definition.ts';
import type { OnEvent } from '../../notifier/definition.ts';
import type { InvocationStack } from './stack/definition.ts';

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
 * Describes a tracked invocation.
 *
 * This object is passed to all tracker listeners (`onInvoked`, `onStarted`, etc.). It captures the identity (`key`),
 * optional `parentKey`, arguments, tags, and information about the stage of the invocation.
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
   * If present, contains tags provided when creating the tracker or per invocation.
   *
   * The tags are sorted and the array does not contain duplicated tags (it may have tags with the same name but not
   * with the same name and value).
   */
  readonly tags?: readonly Tag[];

  /**
   * The stage of the invocation, which can be
   *
   * - `started`: at the very beginning of the invocation
   * - `completed`: after a successful invocation (sync or async)
   * - `errored`: after a value is thrown or rejected
   */
  readonly stage: InvocationStage;
};

export type InvocationStage = StartedStage | CompletedStage | ErroredStage;

export type StartedStage = {
  /**
   * The type of the stage of the invocation.
   */
  readonly type: 'started';
};

export type CompletedStage = {
  /**
   * The type of the stage of the invocation.
   */
  readonly type: 'completed';

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
};

export type ErroredStage = {
  /**
   * The type of the stage of the invocation.
   */
  readonly type: 'errored';

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
};

/**
 * A key-value tag that adds contextual metadata to a tracked invocation, being useful for filtering, routing,
 * correlation, and enriching logs or invocations.
 *
 * @example
 *
 * ```ts
 * { "name": "service", "value": "auth" }
 * ```
 */
export type Tag = { readonly name: string; readonly value: string | number | boolean };

/**
 * A collection of tags, either as an array of tag objects or a record with the tag names and respective values.
 */
export type Tags = readonly Tag[] | { readonly [name: string]: Tag['value'] };

type StageType = InvocationStage['type'];

/**
 * A narrowed version of `Invocation`, specific to a stage of the invocation.
 */
export type InvocationAtStage<
  TStageType extends StageType,
  TOperation extends string = string,
> = Invocation<TOperation> & { readonly stage: InvocationStage & { readonly type: TStageType } };

/**
 * A tracker that observes operations and emits an invocation description.
 *
 * This object is created via `createInvocationTracker()`. Once created, you can use `track(...)` to wrap operations for
 * tracking and register listeners for various invocation stages.
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
    options?: {
      /**
       * The tags to add to the invocation object.
       *
       * These tags are merged with any tags set when the invocation tracker was created.
       */
      readonly tags?: Tags;
    },
  ) => F;

  /**
   * Registers a listener for all invocations on any stage.
   *
   * These listeners are notified before the ones that are specified to each stage of the invocation.
   */
  readonly onInvoked: OnEvent<Invocation<TOperation>>;

  /**
   * Registers a listener for `started` invocations only.
   */
  readonly onStarted: OnEvent<InvocationAtStage<'started', TOperation>>;

  /**
   * Registers a listener for `completed` invocations only.
   */
  readonly onCompleted: OnEvent<InvocationAtStage<'completed', TOperation>>;

  /**
   * Registers a listener for `errored` invocations only.
   */
  readonly onErrored: OnEvent<InvocationAtStage<'errored', TOperation>>;
};

export type InvocationTrackerOptions = {
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
  readonly tags?: Tags;

  /**
   * An optional logger used to emit tracker-level log messages.
   */
  readonly logger?: Logger;
};
