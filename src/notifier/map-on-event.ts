import type { OnEvent } from './definition.ts';

/**
 * Creates a new OnEvent function that transforms events using a mapper function before passing them to listeners.
 *
 * This function provides a lightweight way to transform events in the `OnEvent` subscription pattern without creating a
 * full EventNotifier. It allows you to create an API that exposes events created by other, possible private,
 * notifiers.
 *
 * The mapper function can return a special value `SKIP_MAPPED_EVENT` to skip the event from being passed to the
 * listener.
 *
 * @example
 *
 * ```ts
 * import type { OnEvent } from 'emitnlog/notifier';
 * import { mapOnEvent, SKIP_MAPPED_EVENT } from 'emitnlog/notifier';
 *
 * import type { StorageEvent } from 'my_cool_storage';
 * import { storage } from 'my_cool_storage';
 *
 * type UserEvent = { readonly userId: string } & StorageEvent;
 *
 * const createUser = (id: string): { readonly id: string; readonly onChange: OnEvent<UserEvent> } => {
 *   const userSubscription = storage.createUser(id);
 *   return {
 *     id,
 *     onChange: mapOnEvent(userSubscription.onChange, (storageEvent) => {
 *       if (storageEvent.action === 'created') {
 *         return { userId: id, ...storageEvent };
 *       }
 *       return SKIP_MAPPED_EVENT;
 *     }),
 *   };
 * };
 *
 * const user1 = createUser('id123');
 * user1.onChange((userEvent) => {
 *   // Handle user event with userId and storage details
 *   // This will only receive 'created' events, other actions are skipped
 * });
 * ```
 *
 * @template R The type of events the mapped OnEvent will pass to listeners
 * @template T The type of events the source OnEvent receives
 * @param onEvent The source OnEvent function to map events from
 * @param mapper A function that transforms events from type T to type R
 * @returns A new OnEvent function that passes transformed events of type R to listeners
 */
export const mapOnEvent =
  <R, T>(onEvent: OnEvent<T>, mapper: (event: T) => R | typeof SKIP_MAPPED_EVENT): OnEvent<R> =>
  (listener) =>
    onEvent((event) => {
      const mapped = mapper(event);
      if (mapped !== SKIP_MAPPED_EVENT) {
        listener(mapped);
      }
    });

/**
 * A special value that can be returned from the mapper function to skip the event from being passed to the listener.
 */
export const SKIP_MAPPED_EVENT = Symbol.for('@emitnlog/notifier/skip-mapped-event');
