import type { Writable } from 'type-fest';

import { withLogger } from '../../logger/off-logger.ts';
import { withPrefix } from '../../logger/prefixed-logger.ts';
import { createEventNotifier } from '../../notifier/implementation.ts';
import { stringifyDuration } from '../../utils/common/duration.ts';
import { isNotNullable } from '../../utils/common/is-not-nullable.ts';
import type {
  PromiseHolder,
  PromiseSettledEvent,
  PromiseTracker,
  PromiseTrackerOptions,
  PromiseVault,
  PromiseVaultOptions,
} from './definition.ts';

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
 * import { createConsoleLogLogger } from 'emitnlog/logger';
 * import { trackPromises } from 'emitnlog/tracker';
 *
 * const tracker = trackPromises({ logger: createConsoleLogLogger('debug') });
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
  const logger = withPrefix(withLogger(options?.logger), 'promise', { fallbackPrefix: 'emitnlog.promise-tracker' });

  const onSettledNotifier = createEventNotifier<PromiseSettledEvent>();

  return {
    get size() {
      return promises.size;
    },

    onSettled: onSettledNotifier.onEvent,

    wait: () => {
      if (!promises.size) {
        return Promise.resolve();
      }

      logger.d`waiting for ${promises.size} promises to settle`;
      return Promise.allSettled(promises).then(() => undefined);
    },

    track: <T>(
      first: string | Promise<T> | (() => Promise<T>),
      second?: Promise<T> | (() => Promise<T>),
      idMap?: Map<string, Promise<unknown>>,
      keep?: boolean,
      forgetOnRejection?: boolean,
    ): Promise<T> => {
      const label = typeof first === 'string' ? first : undefined;
      const promise = typeof first === 'string' ? (second as Promise<T> | (() => Promise<T>)) : first;

      if (label !== undefined && idMap) {
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

          if (label !== undefined && idMap && !keep) {
            idMap.delete(label);
          }

          const duration = performance.now() - start;
          logger.d`promise${label ? ` with label '${label}'` : ''} resolved in ${stringifyDuration(duration)}`;

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

          if (label !== undefined && idMap && (!keep || forgetOnRejection)) {
            idMap.delete(label);
          }

          const duration = performance.now() - start;
          logger.d`promise${label ? ` with label '${label}'` : ''} rejected in ${stringifyDuration(duration)}`;

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

      if (label !== undefined && idMap) {
        idMap.set(label, finalPromise);
      }

      return finalPromise;
    },
  };
};

/**
 * Creates a new promise holder for transiently caching ongoing async operations to preventing duplicate execution.
 *
 * The Promise Holder is a Promise Tracker that maintains a cache of ongoing operations identified by unique IDs,
 * automatically clearing the cache when the operation completes. When an operation identified by the same ID is
 * requested multiple times in a short period of time, the holder returns the cached promise instead of executing the
 * operation again. This is particularly useful for expensive operations like API calls, database queries, or file
 * system operations that might be requested simultaneously from different parts of an application.
 *
 * Each holder instance is independent and manages its own operation cache. The cache is automatically cleaned up when
 * operations complete, and comprehensive logging is provided when a logger is configured.
 *
 * **Key differences from PromiseTracker:**
 *
 * - **PromiseTracker**: Coordinates multiple different operations, ideal for shutdown/monitoring scenarios
 * - **PromiseHolder**: Caches ongoing operations by ID to prevent duplicates, ideal for deduplication
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
 * import { createConsoleLogLogger } from 'emitnlog/logger';
 * import { holdPromises } from 'emitnlog/tracker';
 *
 * const queryHolder = holdPromises({ logger: createConsoleLogLogger('debug') });
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

    wait: (...ids: readonly string[]) => {
      if (!ids.length) {
        return tracker.wait();
      }

      const filteredPromises = ids.map((id) => idMap.get(id)).filter(isNotNullable);
      if (!filteredPromises.length) {
        return Promise.resolve();
      }

      return Promise.allSettled(filteredPromises).then(() => undefined);
    },

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

/**
 * Creates a new promise vault for persistent caching of expensive operations.
 *
 * The vault maintains a permanent cache of settled promises until explicitly cleared, making it ideal for expensive
 * operations that don't change frequently such as configuration loading, initialization routines, or API calls for
 * static data.
 *
 * Unlike PromiseHolder which automatically clears cached promises when they settle, PromiseVault retains all cached
 * promises indefinitely until manually cleared via `clear()` or `forget()`. This provides long-term caching for
 * operations that should execute only once per application lifecycle.
 *
 * @example Application initialization
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * const initVault = vaultPromises({ logger: appLogger });
 *
 * // These operations happen only once, even across multiple calls
 * const initializeDatabase = () => initVault.track('database', () => setupDatabaseConnection());
 * const loadConfiguration = () => initVault.track('config', () => fetchAppConfiguration());
 *
 * // Later calls return cached results instantly
 * const config = await loadConfiguration(); // Uses cached promise
 * ```
 *
 * @example Configuration with refresh capability
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * const configVault = vaultPromises();
 *
 * const getConfig = (env: string) => {
 *   return configVault.track(`config-${env}`, () => fetchConfigFromRemote(env));
 * };
 *
 * // Force refresh when needed
 * configVault.forget('config-production');
 * const freshConfig = await getConfig('production'); // New network call
 * ```
 *
 * @example Automatic retry on failure
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * // Vault that automatically clears failed operations for retry
 * const retryVault = vaultPromises({ logger: apiLogger, forgetOnRejection: true });
 *
 * const fetchData = async (id: string) => {
 *   return retryVault.track(`data-${id}`, async () => {
 *     const response = await fetch(`/api/data/${id}`);
 *     if (!response.ok) {
 *       throw new Error(`Failed to fetch data: ${response.status}`);
 *     }
 *     return response.json();
 *   });
 * };
 *
 * // First attempt fails and is automatically removed from cache
 * try {
 *   await fetchData('123');
 * } catch (error) {
 *   console.log('First attempt failed, will retry');
 * }
 *
 * // Second attempt executes fresh (not cached)
 * const data = await fetchData('123'); // New attempt
 * ```
 *
 * @param options Configuration options for the vault
 * @param options.forgetOnRejection When true, failed operations are automatically removed from the cache, allowing
 *   immediate retries. When false (default), failed operations remain cached and must be manually cleared with
 *   `forget()` to enable retries.
 * @param options.logger Optional logger for internal operations. If not provided, logging is disabled. The logger will
 *   be prefixed with 'promise' for easy identification.
 * @returns A new PromiseVault instance
 */
export const vaultPromises = (options?: PromiseVaultOptions): PromiseVault => {
  const idMap = new Map<string, Promise<unknown>>();

  const tracker = trackPromises(options);

  return {
    get size() {
      return idMap.size;
    },

    onSettled: tracker.onSettled,

    wait: (...ids: readonly string[]) => {
      if (!ids.length) {
        return tracker.wait();
      }

      const filteredPromises = ids.map((id) => idMap.get(id)).filter(isNotNullable);
      if (!filteredPromises.length) {
        return Promise.resolve();
      }

      return Promise.allSettled(filteredPromises).then(() => undefined);
    },

    has: (id: string) => idMap.has(id),

    clear: () => {
      idMap.clear();
    },

    forget: (id: string) => idMap.delete(id),

    track: <T>(id: string, supplier: () => Promise<T>, opt?: { forget?: boolean }): Promise<T> =>
      (
        tracker.track as (
          id: string,
          promise: Promise<T> | (() => Promise<T>),
          idMap: Map<string, Promise<unknown>>,
          keep?: boolean,
          forgetOnRejection?: boolean,
        ) => Promise<T>
      )(id, supplier, idMap, !opt?.forget, options?.forgetOnRejection),
  };
};
