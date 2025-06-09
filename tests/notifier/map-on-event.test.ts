import { beforeEach, describe, expect, test } from '@jest/globals';

import type { EventNotifier, OnEvent } from '../../src/notifier/index.ts';
import { createEventNotifier, mapOnEvent, SKIP_MAPPED_EVENT } from '../../src/notifier/index.ts';

describe('emitnlog.notifier.mapOnEvent', () => {
  let sourceNotifier: EventNotifier<string>;
  let sourceOnEvent: OnEvent<string>;

  beforeEach(() => {
    sourceNotifier = createEventNotifier<string>();
    sourceOnEvent = sourceNotifier.onEvent;
  });

  test('should transform events using mapper function', () => {
    const lengthOnEvent = mapOnEvent(sourceOnEvent, (str) => str.length);

    const lengths: number[] = [];
    lengthOnEvent((length) => lengths.push(length));

    sourceNotifier.notify('hello');
    sourceNotifier.notify('world');
    sourceNotifier.notify('test');

    expect(lengths).toEqual([5, 5, 4]);
  });

  test('should support object transformation', () => {
    type SourceEvent = { message: string };
    type TransformedEvent = { message: string; timestamp: number; processed: boolean };

    const objectNotifier = createEventNotifier<SourceEvent>();
    const enrichedOnEvent = mapOnEvent(objectNotifier.onEvent, (event) => ({
      ...event,
      timestamp: Date.now(),
      processed: true,
    }));

    const events: TransformedEvent[] = [];
    enrichedOnEvent((event) => events.push(event));

    objectNotifier.notify({ message: 'test event' });

    expect(events).toHaveLength(1);
    expect(events[0].message).toBe('test event');
    expect(events[0].processed).toBe(true);
    expect(typeof events[0].timestamp).toBe('number');
  });

  test('should support chaining multiple transformations', () => {
    const lengthOnEvent = mapOnEvent(sourceOnEvent, (str) => str.length);
    const evenOnEvent = mapOnEvent(lengthOnEvent, (length) => length % 2 === 0);

    const results: boolean[] = [];
    evenOnEvent((isEven) => results.push(isEven));

    sourceNotifier.notify('hello'); // 5 -> false
    sourceNotifier.notify('test'); // 4 -> true
    sourceNotifier.notify('hi'); // 2 -> true

    expect(results).toEqual([false, true, true]);
  });

  test('should support multiple listeners on mapped OnEvent', () => {
    const lengthOnEvent = mapOnEvent(sourceOnEvent, (str) => str.length);

    const lengths1: number[] = [];
    const lengths2: number[] = [];

    lengthOnEvent((length) => lengths1.push(length));
    lengthOnEvent((length) => lengths2.push(length));

    sourceNotifier.notify('hello');

    expect(lengths1).toEqual([5]);
    expect(lengths2).toEqual([5]);
  });

  test('should maintain subscription lifecycle', () => {
    const lengthOnEvent = mapOnEvent(sourceOnEvent, (str) => str.length);
    const lengths: number[] = [];

    const subscription = lengthOnEvent((length) => lengths.push(length));

    sourceNotifier.notify('hello');
    subscription.close();
    sourceNotifier.notify('world');

    expect(lengths).toEqual([5]);
  });

  test('should handle mapper function errors gracefully', () => {
    const errors: Error[] = [];
    sourceNotifier.onError((error) => errors.push(error));

    const faultyMapper = mapOnEvent(sourceOnEvent, (str) => {
      if (str === 'error') {
        throw new Error('Mapper error');
      }
      return str.length;
    });

    const results: number[] = [];
    faultyMapper((length) => results.push(length));

    sourceNotifier.notify('hello');
    sourceNotifier.notify('error');
    sourceNotifier.notify('world');

    expect(results).toEqual([5, 5]); // Only successful transformations
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Mapper error');
  });

  test('should work with function events', () => {
    const lengthOnEvent = mapOnEvent(sourceOnEvent, (str) => str.length);
    const lengths: number[] = [];

    lengthOnEvent((length) => lengths.push(length));

    sourceNotifier.notify(() => 'dynamic');

    expect(lengths).toEqual([7]);
  });

  test('should replicate the JSDoc example use case', () => {
    type StorageEvent = { readonly action: 'created' | 'updated' | 'deleted'; readonly timestamp: number };
    const mockStorage = (() => {
      const notifier = createEventNotifier<StorageEvent>();
      return {
        onChange: notifier.onEvent,
        createUser: (_id: string) => {
          // do something
        },
        notifier, // for tests purpose
      };
    })();

    type UserEvent = { readonly userId: string } & StorageEvent;
    const createUser = (id: string): { readonly id: string; readonly onChange: OnEvent<UserEvent> } => {
      mockStorage.createUser(id);
      return { id, onChange: mapOnEvent(mockStorage.onChange, (storageEvent) => ({ userId: id, ...storageEvent })) };
    };

    const user1 = createUser('id123');

    const userEvents: UserEvent[] = [];
    user1.onChange((userEvent) => {
      userEvents.push(userEvent);
    });

    mockStorage.createUser('id123');
    mockStorage.notifier.notify({ action: 'created', timestamp: Date.now() });
    mockStorage.notifier.notify({ action: 'updated', timestamp: Date.now() });

    expect(userEvents).toHaveLength(2);
    expect(userEvents[0].userId).toBe('id123');
    expect(userEvents[0].action).toBe('created');
    expect(userEvents[1].userId).toBe('id123');
    expect(userEvents[1].action).toBe('updated');
  });

  test('should not interfere with original OnEvent', () => {
    const originalEvents: string[] = [];
    const mappedEvents: number[] = [];

    sourceOnEvent((event) => originalEvents.push(event));

    const lengthOnEvent = mapOnEvent(sourceOnEvent, (str) => str.length);
    lengthOnEvent((length) => mappedEvents.push(length));

    sourceNotifier.notify('hello');

    expect(originalEvents).toEqual(['hello']);
    expect(mappedEvents).toEqual([5]);
  });

  describe('SKIP_MAPPED_EVENT', () => {
    test('should skip events when mapper returns SKIP_MAPPED_EVENT', () => {
      const filteredOnEvent = mapOnEvent(sourceOnEvent, (str) => {
        if (str.length < 5) {
          return SKIP_MAPPED_EVENT;
        }
        return str.toUpperCase();
      });

      const results: string[] = [];
      filteredOnEvent((event) => results.push(event));

      sourceNotifier.notify('hi'); // length 2 - should be skipped
      sourceNotifier.notify('hello'); // length 5 - should be included
      sourceNotifier.notify('no'); // length 2 - should be skipped
      sourceNotifier.notify('world'); // length 5 - should be included

      expect(results).toEqual(['HELLO', 'WORLD']);
    });

    test('should skip all events when mapper always returns SKIP_MAPPED_EVENT', () => {
      const neverEmitOnEvent = mapOnEvent(sourceOnEvent, (): string | typeof SKIP_MAPPED_EVENT => SKIP_MAPPED_EVENT);

      const results: string[] = [];
      neverEmitOnEvent((event) => results.push(event));

      sourceNotifier.notify('hello');
      sourceNotifier.notify('world');
      sourceNotifier.notify('test');

      expect(results).toEqual([]);
    });

    test('should work with multiple listeners when some events are skipped', () => {
      const evenLengthOnEvent = mapOnEvent(sourceOnEvent, (str) => {
        if (str.length % 2 === 0) {
          return str.length;
        }
        return SKIP_MAPPED_EVENT;
      });

      const results1: number[] = [];
      const results2: number[] = [];

      evenLengthOnEvent((length) => results1.push(length));
      evenLengthOnEvent((length) => results2.push(length));

      sourceNotifier.notify('hello'); // length 5 - odd, should be skipped
      sourceNotifier.notify('test'); // length 4 - even, should be included
      sourceNotifier.notify('hi'); // length 2 - even, should be included
      sourceNotifier.notify('a'); // length 1 - odd, should be skipped

      expect(results1).toEqual([4, 2]);
      expect(results2).toEqual([4, 2]);
    });

    test('should work with chained transformations where intermediate steps skip events', () => {
      // First transformation: only pass strings longer than 3 characters
      const longStringsOnEvent = mapOnEvent(sourceOnEvent, (str) => {
        if (str.length > 3) {
          return str;
        }
        return SKIP_MAPPED_EVENT;
      });

      // Second transformation: convert to uppercase and skip words containing 'skip'
      const finalOnEvent = mapOnEvent(longStringsOnEvent, (str) => {
        if (str.includes('skip')) {
          return SKIP_MAPPED_EVENT;
        }
        return str.toUpperCase();
      });

      const results: string[] = [];
      finalOnEvent((event) => results.push(event));

      sourceNotifier.notify('hi'); // length 2 - skipped in first transform
      sourceNotifier.notify('hello'); // length 5 - passes both transforms
      sourceNotifier.notify('skip-me'); // length 7 - passes first, skipped in second
      sourceNotifier.notify('world'); // length 5 - passes both transforms
      sourceNotifier.notify('no'); // length 2 - skipped in first transform

      expect(results).toEqual(['HELLO', 'WORLD']);
    });

    test('should handle complex object transformations with conditional skipping', () => {
      type SourceEvent = { id: number; type: 'user' | 'admin' | 'guest'; name: string };
      type FilteredEvent = { id: number; name: string; isPrivileged: boolean };

      const objectNotifier = createEventNotifier<SourceEvent>();
      const privilegedOnEvent = mapOnEvent(objectNotifier.onEvent, (event) => {
        // Only pass through user and admin events, skip guest events
        if (event.type === 'guest') {
          return SKIP_MAPPED_EVENT;
        }
        return { id: event.id, name: event.name, isPrivileged: event.type === 'admin' };
      });

      const results: FilteredEvent[] = [];
      privilegedOnEvent((event) => results.push(event));

      objectNotifier.notify({ id: 1, type: 'user', name: 'John' });
      objectNotifier.notify({ id: 2, type: 'guest', name: 'Anonymous' }); // should be skipped
      objectNotifier.notify({ id: 3, type: 'admin', name: 'Admin' });
      objectNotifier.notify({ id: 4, type: 'guest', name: 'Visitor' }); // should be skipped

      expect(results).toEqual([
        { id: 1, name: 'John', isPrivileged: false },
        { id: 3, name: 'Admin', isPrivileged: true },
      ]);
    });

    test('should maintain subscription lifecycle when events are skipped', () => {
      const filterOnEvent = mapOnEvent(sourceOnEvent, (str) => {
        if (str.startsWith('skip')) {
          return SKIP_MAPPED_EVENT;
        }
        return str.length;
      });

      const results: number[] = [];
      const subscription = filterOnEvent((length) => results.push(length));

      sourceNotifier.notify('hello'); // should be included
      sourceNotifier.notify('skip-me'); // should be skipped
      sourceNotifier.notify('world'); // should be included

      subscription.close();

      sourceNotifier.notify('after-close'); // should not be received

      expect(results).toEqual([5, 5]);
    });

    test('should validate the documentation example scenario', () => {
      type StorageEvent = { readonly action: 'created' | 'updated' | 'deleted'; readonly timestamp: number };
      type UserEvent = { readonly userId: string } & StorageEvent;

      const storageNotifier = createEventNotifier<StorageEvent>();
      const mockStorage = { createUser: (_id: string) => ({ onChange: storageNotifier.onEvent }) };

      const createUser = (id: string): { readonly id: string; readonly onChange: OnEvent<UserEvent> } => {
        const userSubscription = mockStorage.createUser(id);
        return {
          id,
          onChange: mapOnEvent(userSubscription.onChange, (storageEvent) => {
            if (storageEvent.action === 'created') {
              return { userId: id, ...storageEvent };
            }
            return SKIP_MAPPED_EVENT;
          }),
        };
      };

      const user1 = createUser('id123');
      const userEvents: UserEvent[] = [];
      user1.onChange((userEvent) => {
        userEvents.push(userEvent);
      });

      // Emit various storage events
      storageNotifier.notify({ action: 'created', timestamp: 1000 }); // should be included
      storageNotifier.notify({ action: 'updated', timestamp: 2000 }); // should be skipped
      storageNotifier.notify({ action: 'deleted', timestamp: 3000 }); // should be skipped
      storageNotifier.notify({ action: 'created', timestamp: 4000 }); // should be included

      expect(userEvents).toHaveLength(2);
      expect(userEvents[0]).toEqual({ userId: 'id123', action: 'created', timestamp: 1000 });
      expect(userEvents[1]).toEqual({ userId: 'id123', action: 'created', timestamp: 4000 });
    });
  });
});
