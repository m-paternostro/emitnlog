import { beforeEach, describe, expect, test } from '@jest/globals';

import { createEventNotifier } from '../../src/notifier/index.ts';

describe('emitnlog.notifier', () => {
  let notifier: ReturnType<typeof createEventNotifier<string>>;

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
});
