import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { EventNotifier, OnEvent } from '../../src/notifier/index.ts';
import { createEventNotifier } from '../../src/notifier/index.ts';
import { delay } from '../../src/utils/index.ts';

describe('emitnlog.notifier', () => {
  test('should be able to create a notifier with no type parameters', () => {
    const notifier = createEventNotifier();

    const onEvent: OnEvent = notifier.onEvent;

    let counter = 0;
    onEvent((event) => {
      expect(event).toBeUndefined();
      counter++;
    });

    notifier.notify();
    expect(counter).toBe(1);

    notifier.notify();
    expect(counter).toBe(2);
  });

  let notifier: EventNotifier<string>;

  beforeEach(() => {
    notifier = createEventNotifier<string>();
  });

  test('should notify listeners in registration order', () => {
    const events: string[] = [];
    notifier.onEvent((event) => events.push(`first: ${event}`));
    notifier.onEvent((event) => events.push(`second: ${event}`));
    notifier.onEvent((event) => events.push(`third: ${event}`));

    notifier.notify('test event');

    expect(events).toEqual(['first: test event', 'second: test event', 'third: test event']);
  });

  test('should not notify unsubscribed listeners', () => {
    const events: string[] = [];
    const subscription = notifier.onEvent((event) => events.push(event));

    notifier.notify('first event');
    subscription.close();
    notifier.notify('second event');

    expect(events).toEqual(['first event']);
  });

  test('should handle function events', () => {
    const events: string[] = [];
    notifier.onEvent((event) => events.push(event));

    notifier.notify(() => 'dynamic event');

    expect(events).toEqual(['dynamic event']);
  });

  test('should handle errors through error handler', () => {
    const errors: Error[] = [];
    notifier.onError((error) => errors.push(error));

    notifier.onEvent(() => {
      throw new Error('test error');
    });

    notifier.notify('test event');

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect(errors[0].message).toBe('test error');
  });

  test('should not notify after close', () => {
    const events: string[] = [];
    notifier.onEvent((event) => events.push(event));

    notifier.notify('first event');
    notifier.close();
    notifier.notify('second event');

    expect(events).toEqual(['first event']);
  });

  test('should handle multiple subscriptions and unsubscriptions', () => {
    const events: string[] = [];
    const subscription1 = notifier.onEvent((event) => events.push(`1: ${event}`));
    const subscription2 = notifier.onEvent((event) => events.push(`2: ${event}`));

    notifier.notify('first event');
    subscription1.close();
    notifier.notify('second event');
    subscription2.close();
    notifier.notify('third event');

    expect(events).toEqual(['1: first event', '2: first event', '2: second event']);
  });

  test('should handle error handler after close', () => {
    const errors: Error[] = [];
    notifier.onError((error) => errors.push(error));
    notifier.close();

    notifier.onEvent(() => {
      throw new Error('test error');
    });

    notifier.notify('test event');

    expect(errors).toHaveLength(0);
  });

  test('should clear error handler on close', () => {
    const errors: Error[] = [];
    notifier.onError((error) => errors.push(error));

    notifier.close();

    notifier.onEvent(() => {
      throw new Error('test error');
    });

    notifier.notify('test event');

    expect(errors).toHaveLength(0);
  });

  test('should use the last set error handler', () => {
    const errors1: Error[] = [];
    const errors2: Error[] = [];

    notifier.onError((error) => errors1.push(error));

    notifier.onError((error) => errors2.push(error));

    notifier.onEvent(() => {
      throw new Error('test error');
    });

    notifier.notify('test event');

    expect(errors1).toHaveLength(0);
    expect(errors2).toHaveLength(1);
    expect(errors2[0].message).toBe('test error');
  });

  test('should validate the Car example from JSDoc', () => {
    class Car {
      private _onStartNotifier = createEventNotifier<{ mileage: number }>();
      public onStart = this._onStartNotifier.onEvent;

      private _onStopNotifier = createEventNotifier<{ engineOn: boolean }>();
      public onStop = this._onStopNotifier.onEvent;

      public start() {
        // Use lazy evaluation: compute only if someone is listening
        this._onStartNotifier.notify(() => ({ mileage: this.computeMileage() }));
      }

      public stop() {
        this._onStopNotifier.notify({ engineOn: this.isRunning() });
      }

      private computeMileage(): number {
        // expensive computation
        return 42;
      }

      private isRunning(): boolean {
        return true;
      }
    }

    const car = new Car();
    const startEvents: { mileage: number }[] = [];
    const stopEvents: { engineOn: boolean }[] = [];

    const startListener = car.onStart((event) => {
      startEvents.push(event);
    });

    const stopListener = car.onStop((event) => {
      stopEvents.push(event);
    });

    car.start();
    car.stop();

    expect(startEvents).toEqual([{ mileage: 42 }]);
    expect(stopEvents).toEqual([{ engineOn: true }]);

    // Clear previous events
    startEvents.length = 0;
    stopEvents.length = 0;

    // Unsubscribe
    startListener.close();
    stopListener.close();

    // These should not trigger any events
    car.start();
    car.stop();

    expect(startEvents).toEqual([]);
    expect(stopEvents).toEqual([]);
  });

  // waitForEvent tests
  describe('waitForEvent', () => {
    test('should resolve with the next notified event and without any listeners', async () => {
      const eventPromise = notifier.waitForEvent();
      notifier.notify('test event');
      const result = await eventPromise;
      expect(result).toBe('test event');
    });

    test('should resolve with function events', async () => {
      const eventPromise = notifier.waitForEvent();
      notifier.notify(() => 'dynamic event');
      const result = await eventPromise;
      expect(result).toBe('dynamic event');
    });

    test('should work alongside onEvent listeners', async () => {
      const events: string[] = [];
      notifier.onEvent((event) => events.push(event));

      const eventPromise = notifier.waitForEvent();

      let invocationCount = 0;
      notifier.notify(() => {
        invocationCount++;
        return 'test event';
      });

      const result = await eventPromise;
      expect(result).toBe('test event');
      expect(events).toEqual(['test event']);
      expect(invocationCount).toBe(1);
    });

    test('should resolve to the same event when waitForEvent is called multiple times', async () => {
      const promise1 = notifier.waitForEvent();
      const promise2 = notifier.waitForEvent();

      let invocationCount = 0;
      notifier.notify(() => {
        invocationCount++;
        return 'first event';
      });

      const result1 = await promise1;

      notifier.notify(() => {
        invocationCount++;
        return 'second event';
      });

      const result2 = await promise2;

      expect(result1).toBe('first event');
      expect(result2).toBe('first event');
      expect(invocationCount).toBe(1);
    });

    test('should not be affected by listener errors', async () => {
      const errors: Error[] = [];
      notifier.onError((error) => errors.push(error));

      notifier.onEvent(() => {
        throw new Error('listener error');
      });

      const eventPromise = notifier.waitForEvent();
      notifier.notify('test event');

      const result = await eventPromise;
      expect(result).toBe('test event');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('listener error');
    });

    test('should not create new promise for each waitForEvent call between event notifications', async () => {
      const promise1 = notifier.waitForEvent();
      const promise2 = notifier.waitForEvent();

      expect(promise1).toBe(promise2);

      notifier.notify('event1');

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1).toBe('event1');
      expect(result2).toBe('event1');

      const promise3 = notifier.waitForEvent();
      expect(promise3).not.toBe(promise1);

      let resolvedEvent: string | undefined;
      void promise3.then((event) => (resolvedEvent = event));

      void delay(50).then(() => notifier.notify('event2'));
      await expect(notifier.waitForEvent()).resolves.toBe('event2');
      expect(resolvedEvent).toBe('event2');
    });

    test('should still work after the notifier has been closed and reopened', async () => {
      notifier.close();
      const eventPromise = notifier.waitForEvent();
      notifier.notify('after close');
      const result = await eventPromise;
      expect(result).toBe('after close');
    });

    test('should work in a loop as shown in the example', async () => {
      const values = ['first', 'second', 'third', 'fourth', 'fifth'];

      const notifyingPromises = values.map((value) => delay(5).then(() => notifier.notify(value)));

      const events: string[] = [];
      const waitForEvents = async () => {
        for (let i = 0; i < values.length; i++) {
          // eslint-disable-next-line no-await-in-loop
          const value = await notifier.waitForEvent();
          events.push(value);
        }
      };
      void waitForEvents();

      for (let i = 0; i < values.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await notifyingPromises[i];
      }

      await delay(10);

      expect(events).toEqual(values);
    });
  });

  describe('debouncing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should debounce notifications to listeners', async () => {
      const debouncedNotifier = createEventNotifier<string>({ debounceDelay: 300 });
      const events: string[] = [];

      debouncedNotifier.onEvent((event) => events.push(event));

      // Rapid notifications - only the last should reach listeners
      debouncedNotifier.notify('first');
      debouncedNotifier.notify('second');
      debouncedNotifier.notify('third');

      // No events yet
      expect(events).toEqual([]);

      // Advance time to trigger debounced execution
      jest.advanceTimersByTime(300);

      // Only the last event should be received
      expect(events).toEqual(['third']);
    });

    test('should debounce waitForEvent results', async () => {
      const debouncedNotifier = createEventNotifier<string>({ debounceDelay: 300 });

      const eventPromise = debouncedNotifier.waitForEvent();

      // Rapid notifications
      debouncedNotifier.notify('first');
      debouncedNotifier.notify('second');
      debouncedNotifier.notify('third');

      // Advance time to trigger debounced execution
      jest.advanceTimersByTime(300);

      // waitForEvent should resolve with the last value
      await expect(eventPromise).resolves.toBe('third');
    });

    test('should ensure listeners and waitForEvent receive the same debounced result', async () => {
      const debouncedNotifier = createEventNotifier<string>({ debounceDelay: 300 });
      const events: string[] = [];

      debouncedNotifier.onEvent((event) => events.push(event));
      const eventPromise = debouncedNotifier.waitForEvent();

      // Rapid notifications
      debouncedNotifier.notify('first');
      debouncedNotifier.notify('second');
      debouncedNotifier.notify('final');

      // Advance time to trigger debounced execution
      jest.advanceTimersByTime(300);

      // Both should receive the same final result
      await expect(eventPromise).resolves.toBe('final');
      expect(events).toEqual(['final']);
    });

    test('should work with function events when debounced', async () => {
      const debouncedNotifier = createEventNotifier<string>({ debounceDelay: 300 });
      const events: string[] = [];
      let callCount = 0;

      debouncedNotifier.onEvent((event) => events.push(event));

      // Function that tracks invocation count
      const eventFn = () => {
        callCount++;
        return `computed-${callCount}`;
      };

      // Rapid notifications with functions
      debouncedNotifier.notify(() => eventFn());
      debouncedNotifier.notify(() => eventFn());
      debouncedNotifier.notify(() => eventFn());

      expect(callCount).toBe(0); // Functions not called yet

      // Advance time to trigger debounced execution
      jest.advanceTimersByTime(300);

      // Only the last function should be called once
      expect(callCount).toBe(1);
      expect(events).toEqual(['computed-1']);
    });

    test('should work without debouncing when no debounceDelay specified', async () => {
      const regularNotifier = createEventNotifier<string>();
      const events: string[] = [];

      regularNotifier.onEvent((event) => events.push(event));

      // Rapid notifications should all go through immediately
      regularNotifier.notify('first');
      regularNotifier.notify('second');
      regularNotifier.notify('third');

      // All events should be received immediately
      expect(events).toEqual(['first', 'second', 'third']);
    });
  });
});
