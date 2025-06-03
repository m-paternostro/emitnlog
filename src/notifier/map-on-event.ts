import type { OnEvent } from './definition.ts';

/**
 * Creates a new OnEvent function that transforms events using a mapper function before passing them to listeners.
 *
 * This function provides a lightweight way to transform events in the `OnEvent` subscription pattern without creating a
 * full EventNotifier. It allows you to create an API that exposes events created by other, possible private,
 * notifiers.
 *
 * @example
 *
 * ```ts
 * import type { OnEvent } from 'emitnlog/notifier';
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
 *     onChange: mapOnEvent(userSubscription.onChange, (storageEvent) => ({ userId: id, ...storageEvent })),
 *   };
 * };
 *
 * const user1 = createUser('id123');
 * user1.onChange((userEvent) => {
 *   // Handle user event with userId and storage details
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
  <R, T>(onEvent: OnEvent<T>, mapper: (event: T) => R): OnEvent<R> =>
  (listener) =>
    onEvent((event) => {
      listener(mapper(event));
    });
