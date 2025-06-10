import type { Writable } from 'type-fest';

import type { Logger } from '../../logger/definition.ts';
import { OFF_LOGGER } from '../../logger/off-logger.ts';
import { withPrefix } from '../../logger/prefixed-logger.ts';
import { createEventNotifier } from '../../notifier/implementation.ts';
import type { PromiseSettledEvent, PromiseTracker } from './definition.ts';

/**
 * Creates a new promise tracker for monitoring promises and coordinating async operations.
 *
 * The tracker maintains an internal set of unsettled promises and provides centralized waiting, real-time event
 * notifications, and detailed timing metrics. It's designed for scenarios where you need to coordinate multiple
 * unrelated promises or monitor promise performance across different parts of an application.
 *
 * Each tracker instance is independent and manages its own set of promises. The tracker automatically handles cleanup
 * when promises settle and provides comprehensive logging when a logger is configured.
 *
 * @example Basic tracker creation
 *
 * ```ts
 * import { trackPromises } from 'emitnlog/tracker';
 *
 * // Create a tracker without logging
 * const tracker = trackPromises();
 *
 * // Track some operations
 * const result1 = tracker.track(fetchData(), 'fetch-operation');
 * const result2 = tracker.track(() => processData(), 'process-operation');
 *
 * // Wait for all to complete
 * await tracker.wait();
 * ```
 *
 * @example Tracker with logging
 *
 * ```ts
 * import { trackPromises } from 'emitnlog/tracker';
 *
 * const logger = ;
 * const tracker = trackPromises({ logger: new ConsoleLogger('debug') });
 *
 * // All tracking operations will be logged with 'promise' prefix
 * tracker.track(apiCall(), 'api-request');
 * // Logs: "promise: tracking a promise with label api-request"
 * // Later: "promise: promise with label api-request resolved in 150ms"
 * ```
 *
 * @example Server shutdown coordination
 *
 * ```ts
 * import { trackPromises } from 'emitnlog/tracker';
 * import { withTimeout } from 'emitnlog/utils';
 *
 * const shutdownTracker = trackPromises({ logger: serverLogger });
 *
 * // Track cleanup operations
 * shutdownTracker.track(database.close(), 'db-close');
 * shutdownTracker.track(cache.flush(), 'cache-flush');
 * shutdownTracker.track(server.close(), 'server-close');
 *
 * // Wait with timeout for graceful shutdown
 * try {
 *   await withTimeout(shutdownTracker.wait(), 30000);
 *   console.log('Graceful shutdown completed');
 * } catch {
 *   console.log('Shutdown timeout - forcing exit');
 * }
 * ```
 *
 * @example Performance monitoring
 *
 * ```ts
 * import { trackPromises } from 'emitnlog/tracker';
 *
 * const performanceTracker = trackPromises({ logger: metricsLogger });
 *
 * // Monitor performance across different operations
 * performanceTracker.onSettled((event) => {
 *   const status = event.rejected ? 'FAILED' : 'SUCCESS';
 *   metricsCollector.record({ operation: event.label, duration: event.duration, status: status });
 * });
 *
 * // Track various operations
 * performanceTracker.track(userService.authenticate(token), 'auth');
 * performanceTracker.track(dataService.fetchProfile(userId), 'profile');
 * ```
 *
 * @param options Configuration options for the tracker
 * @param options.logger Optional logger for internal tracker operations. If not provided, logging is disabled. The
 *   logger will be prefixed with 'promise' for easy identification.
 * @returns A new PromiseTracker instance
 */
export const trackPromises = (options?: { readonly logger?: Logger }): PromiseTracker => {
  const promises = new Set<Promise<unknown>>();
  const logger = withPrefix(options?.logger ?? OFF_LOGGER, 'promise', { fallbackPrefix: 'emitnlog.promise-tracker' });

  const onSettledNotifier = createEventNotifier<PromiseSettledEvent>();

  return {
    get size() {
      return promises.size;
    },

    onSettled: onSettledNotifier.onEvent,

    wait: async () => {
      if (!promises.size) {
        return;
      }

      logger.d`waiting for ${promises.size} promises to settle`;
      await Promise.allSettled(promises);
    },

    track: <T>(promise: Promise<T> | (() => Promise<T>), label?: string): Promise<T> => {
      let trackedPromise: Promise<T>;

      let start: number;
      if (typeof promise === 'function') {
        logger.d`tracking a promise supplier${label ? ` with label ${label}` : ''}`;
        start = performance.now();
        try {
          trackedPromise = promise();
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          trackedPromise = Promise.reject(error);
        }
      } else {
        logger.d`tracking a promise${label ? ` with label ${label}` : ''}`;
        start = performance.now();
        trackedPromise = promise;
      }

      // Completely paranoid...
      if (!(trackedPromise as { then?: unknown } | undefined)?.then) {
        trackedPromise = Promise.resolve(trackedPromise);
      }

      promises.add(trackedPromise);

      return trackedPromise.then(
        (result) => {
          promises.delete(trackedPromise);

          const duration = performance.now() - start;
          logger.d`promise${label ? ` with label ${label}` : ''} resolved in ${duration}ms`;

          const event: Writable<PromiseSettledEvent> = { duration };
          if (label !== undefined) {
            event.label = label;
          }
          if (result !== undefined) {
            event.result = result;
          }
          onSettledNotifier.notify(event);
          return result;
        },
        (error: unknown) => {
          promises.delete(trackedPromise);

          const duration = performance.now() - start;
          logger.d`promise${label ? ` with label ${label}` : ''} rejected in ${duration}ms`;

          const event: Writable<PromiseSettledEvent> = { duration, rejected: true };
          if (label !== undefined) {
            event.label = label;
          }
          if (error !== undefined) {
            event.result = error;
          }
          onSettledNotifier.notify(event);
          throw error;
        },
      );
    },
  };
};
