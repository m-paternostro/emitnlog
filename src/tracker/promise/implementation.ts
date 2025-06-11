import type { Writable } from 'type-fest';

import type { Logger } from '../../logger/definition.ts';
import { OFF_LOGGER } from '../../logger/off-logger.ts';
import { withPrefix } from '../../logger/prefixed-logger.ts';
import { createEventNotifier } from '../../notifier/implementation.ts';
import type { PromiseHolder, PromiseSettledEvent, PromiseTracker } from './definition.ts';

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
export const trackPromises = (options?: PromiseTrackerOptions): PromiseTracker => {
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

    track: <T>(
      first: string | Promise<T> | (() => Promise<T>),
      second?: Promise<T> | (() => Promise<T>),
      idMap?: Map<string, Promise<unknown>>,
    ): Promise<T> => {
      const label = typeof first === 'string' ? first : undefined;
      const promise = typeof first === 'string' ? (second as Promise<T> | (() => Promise<T>)) : first;

      if (label && idMap) {
        const existing = idMap.get(label);
        if (existing) {
          logger.d`returning existing promise for label '${label}'`;
          return existing as Promise<T>;
        }
      }

      let trackedPromise: Promise<T>;

      let start: number;
      if (typeof promise === 'function') {
        logger.d`tracking a promise supplier${label ? ` with label '${label}'` : ''}`;
        start = performance.now();
        try {
          trackedPromise = promise();
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          trackedPromise = Promise.reject(error);
        }
      } else {
        logger.d`tracking a promise${label ? ` with label '${label}'` : ''}`;
        start = performance.now();
        trackedPromise = promise;
      }

      // Completely paranoid...
      if (!(trackedPromise as { then?: unknown } | undefined)?.then) {
        trackedPromise = Promise.resolve(trackedPromise);
      }

      promises.add(trackedPromise);

      const finalPromise = trackedPromise.then(
        (result) => {
          promises.delete(trackedPromise);

          if (label && idMap) {
            idMap.delete(label);
          }

          const duration = performance.now() - start;
          logger.d`promise${label ? ` with label '${label}'` : ''} resolved in ${duration}ms`;

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

          if (label && idMap) {
            idMap.delete(label);
          }

          const duration = performance.now() - start;
          logger.d`promise${label ? ` with label '${label}'` : ''} rejected in ${duration}ms`;

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

      if (label && idMap) {
        idMap.set(label, finalPromise);
      }

      return finalPromise;
    },
  };
};

/**
 * Creates a new promise holder for caching async operations and preventing duplicate execution.
 *
 * The promise holder maintains a cache of ongoing operations identified by unique IDs. When the same operation is
 * requested multiple times (same ID), the holder returns the cached promise instead of executing the operation again.
 * This is particularly useful for expensive operations like API calls, database queries, or file system operations that
 * might be requested simultaneously from different parts of an application.
 *
 * Each holder instance is independent and manages its own operation cache. The cache is automatically cleaned up when
 * operations complete, and comprehensive logging is provided when a logger is configured.
 *
 * **Key differences from PromiseTracker:**
 *
 * - **PromiseHolder**: Caches operations by ID to prevent duplicates, ideal for deduplication
 * - **PromiseTracker**: Coordinates multiple different operations, ideal for shutdown/monitoring scenarios
 *
 * @example Basic API call caching
 *
 * ```ts
 * import { holdPromises } from 'emitnlog/tracker';
 *
 * const apiHolder = holdPromises();
 *
 * // Multiple simultaneous requests for the same user
 * const getUserData = (userId: string) => {
 *   return apiHolder.track(`user-${userId}`, () => fetchUserFromAPI(userId));
 * };
 *
 * // All these calls will share the same promise/result
 * const [user1, user2, user3] = await Promise.all([getUserData('123'), getUserData('123'), getUserData('123')]);
 * // Only one API call was made
 * ```
 *
 * @example Database query deduplication with logging
 *
 * ```ts
 * import { holdPromises } from 'emitnlog/tracker';
 * import { ConsoleLogger } from 'emitnlog/logger';
 *
 * const queryHolder = holdPromises({ logger: new ConsoleLogger('debug') });
 *
 * // Cache expensive queries
 * const getProductById = (id: number) => {
 *   return queryHolder.track(`product-${id}`, async () => {
 *     console.log(`Executing query for product ${id}`);
 *     return await db.query('SELECT * FROM products WHERE id = ?', [id]);
 *   });
 * };
 *
 * // Multiple components requesting the same product
 * const product = await getProductById(456);
 * const sameProduct = await getProductById(456); // Uses cached result, no duplicate query
 * ```
 *
 * @example Configuration loading with graceful degradation
 *
 * ```ts
 * import { holdPromises } from 'emitnlog/tracker';
 * import { withTimeout } from 'emitnlog/utils';
 *
 * const configHolder = holdPromises({ logger: appLogger });
 *
 * const loadConfig = (environment: string) => {
 *   return configHolder.track(`config-${environment}`, async () => {
 *     try {
 *       // Try to load from remote first
 *       return await withTimeout(fetchRemoteConfig(environment), 5000);
 *     } catch (error) {
 *       appLogger.w`Failed to load remote config, using local fallback: ${error}`;
 *       return loadLocalConfig(environment);
 *     }
 *   });
 * };
 *
 * // Multiple services requesting config simultaneously
 * const [config1, config2] = await Promise.all([loadConfig('production'), loadConfig('production')]);
 * // Only one config load attempt (remote + fallback if needed)
 * ```
 *
 * @example File processing with monitoring
 *
 * ```ts
 * import { holdPromises } from 'emitnlog/tracker';
 *
 * const fileHolder = holdPromises({ logger: fileLogger });
 *
 * // Monitor file processing performance
 * fileHolder.onSettled((event) => {
 *   const status = event.rejected ? 'FAILED' : 'SUCCESS';
 *   console.log(`File ${event.label}: ${event.duration}ms - ${status}`);
 * });
 *
 * const processFile = (filename: string) => {
 *   return fileHolder.track(`file-${filename}`, async () => {
 *     const content = await fs.readFile(filename, 'utf8');
 *     return await processLargeFile(content);
 *   });
 * };
 *
 * // Multiple requests for the same file processing
 * const [result1, result2] = await Promise.all([
 *   processFile('data.json'),
 *   processFile('data.json'), // Cached - no duplicate file processing
 * ]);
 * ```
 *
 * @example Cache inspection and conditional logic
 *
 * ```ts
 * import { holdPromises } from 'emitnlog/tracker';
 *
 * const operationHolder = holdPromises();
 *
 * const performExpensiveOperation = async (id: string) => {
 *   if (operationHolder.has(id)) {
 *     console.log(`Operation ${id} already in progress...`);
 *   } else {
 *     console.log(`Starting operation ${id}...`);
 *   }
 *
 *   return operationHolder.track(id, () => expensiveAsyncOperation());
 * };
 *
 * // Start operation
 * performExpensiveOperation('task-1');
 * // Will show "already in progress" message
 * performExpensiveOperation('task-1');
 * ```
 *
 * @param options Configuration options for the holder
 * @param options.logger Optional logger for internal operations. If not provided, logging is disabled. The logger will
 *   be prefixed with 'promise' for easy identification of holder-related logs.
 * @returns A new PromiseHolder instance
 */
export const holdPromises = (options?: PromiseTrackerOptions): PromiseHolder => {
  const idMap = new Map<string, Promise<unknown>>();

  const tracker = trackPromises(options);

  return {
    get size() {
      return idMap.size;
    },

    onSettled: tracker.onSettled,

    wait: tracker.wait,

    has: (id: string) => idMap.has(id),

    track: <T>(id: string, supplier: () => Promise<T>): Promise<T> =>
      (
        tracker.track as (
          id: string,
          promise: Promise<T> | (() => Promise<T>),
          idMap: Map<string, Promise<unknown>>,
        ) => Promise<T>
      )(id, supplier, idMap),
  };
};

type PromiseTrackerOptions = { readonly logger?: Logger };
