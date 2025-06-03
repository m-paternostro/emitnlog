import { beforeEach, describe, expect, test } from '@jest/globals';

import type { EventNotifier, OnEvent } from '../../src/notifier/index.ts';
import { createEventNotifier, mapOnEvent } from '../../src/notifier/index.ts';

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
});
