import type { Simplify } from 'type-fest';

import type { OnEvent } from '../../notifier/definition.ts';

/**
 * A tracker for monitoring promises, providing centralized waiting, event notifications, and timing metrics.
 *
 * This tracker is designed for scenarios where you need to coordinate multiple unrelated promises - such as a server
 * waiting for various background operations to complete before shutdown, or monitoring promise performance across
 * different parts of an application.
 *
 * The tracker maintains an internal set of unsettled promises and provides real-time notifications when promises
 * resolve or reject. It supports both direct promises and promise suppliers (functions that return promises).
 *
 * @example Basic usage with direct promises
 *
 * ```ts
 * import { trackPromises } from 'emitnlog/tracker';
 *
 * const tracker = trackPromises();
 *
 * // Track some promises
 * const result1 = tracker.track(fetchUser(id), 'fetch-user');
 * const result2 = tracker.track(saveData(data), 'save-data');
 *
 * // Wait for all tracked promises to settle
 * await tracker.wait();
 * console.log('All operations complete');
 * ```
 *
 * @example Server shutdown coordination
 *
 * ```ts
 * import { trackPromises } from 'emitnlog/tracker';
 * import { withTimeout } from 'emitnlog/utils';
 *
 * const tracker = trackPromises({ logger: serverLogger });
 *
 * // Track various background operations
 * tracker.track(dbConnection.close(), 'db-close');
 * tracker.track(cache.flush(), 'cache-flush');
 * tracker.track(analytics.send(), 'analytics-send');
 *
 * // Graceful shutdown with timeout
 * await withTimeout(tracker.wait(), 5000);
 * ```
 *
 * @example Using promise suppliers
 *
 * ```ts
 * import { trackPromises } from 'emitnlog/tracker';
 *
 * const tracker = trackPromises();
 *
 * // Timing starts when the supplier is called, not when track() is called
 * const result = await tracker.track(async () => {
 *   await expensiveAsyncOperation1();
 *   await expensiveAsyncOperation2();
 * }, 'expensive-combined-op');
 * ```
 *
 * @example Monitoring promise performance
 *
 * ```ts
 * const tracker = trackPromises();
 *
 * tracker.onSettled((event) => {
 *   console.log(`${event.label}: ${event.duration}ms ${event.rejected ? 'FAILED' : 'SUCCESS'}`);
 * });
 *
 * tracker.track(apiCall(), 'api-call');
 * ```
 */
export type PromiseTracker = {
  /**
   * The number of currently unsettled tracked promises.
   *
   * Returns 0 after `wait()` completes and no additional promises have been tracked.
   *
   * @example
   *
   * ```ts
   * const tracker = trackPromises();
   * console.log(tracker.size); // 0
   *
   * tracker.track(slowOperation);
   * console.log(tracker.size); // 1
   *
   * await tracker.wait();
   * console.log(tracker.size); // 0
   * ```
   */
  readonly size: number;

  /**
   * Tracks the lifecycle of a promise or promise supplier, returning the same promise for chaining.
   *
   * Accepts either a direct promise or a function that returns a promise (supplier). Using a supplier provides more
   * accurate timing measurements since the duration is calculated from when the supplier is invoked rather than when
   * `track()` is called.
   *
   * The tracked promise is automatically removed from the tracker when it settles (resolves or rejects). Labels are
   * optional but recommended for debugging and monitoring purposes.
   *
   * @example Tracking direct promises
   *
   * ```ts
   * const tracker = trackPromises();
   * const result = await tracker.track(fetch('/api/data'), 'api-fetch');
   * ```
   *
   * @example Tracking promise suppliers for accurate timing
   *
   * ```ts
   * const tracker = trackPromises();
   * const result = await tracker.track(() => processLargeDataset(data), 'data-processing');
   * ```
   *
   * @param promise A promise to track, or a function that returns a promise (supplier)
   * @param label Optional label for identification in events and logs
   * @returns The same promise for chaining
   */
  track<T>(promise: Promise<T> | (() => Promise<T>)): Promise<T>;
  track<T>(label: string, promise: Promise<T> | (() => Promise<T>)): Promise<T>;

  /**
   * Waits for all currently tracked promises to settle (resolve or reject).
   *
   * This method takes a snapshot of currently tracked promises and waits for them to complete. Promises that are
   * tracked after `wait()` begins are not included in the current wait operation - this allows for predictable
   * coordination patterns.
   *
   * Calling `wait()` when no promises are tracked returns immediately. This can be used as a way to "clear" or verify
   * the tracker state.
   *
   * Consider using `withTimeout()` utility to prevent indefinite waiting in production scenarios.
   *
   * @example Server shutdown coordination
   *
   * ```ts
   * const tracker = trackPromises();
   *
   * // Start background operations
   * tracker.track(backgroundJob1());
   * tracker.track(backgroundJob2());
   *
   * // Wait for current operations to complete
   * await tracker.wait();
   *
   * // Any new promises tracked during wait() are not included above
   * tracker.track(newOperation()); // This won't block the previous wait()
   * ```
   *
   * @example With timeout protection
   *
   * ```ts
   * import { trackPromises } from 'emitnlog/tracker';
   * import { withTimeout } from 'emitnlog/utils';
   *
   * const tracker = trackPromises();
   * tracker.track(longRunningOperation());
   *
   * // Wait maximum 30 seconds
   * await withTimeout(tracker.wait(), 30000);
   * ```
   *
   * @example Clearing/verifying tracker state
   *
   * ```ts
   * const tracker = trackPromises();
   *
   * // This returns immediately if no promises are tracked
   * await tracker.wait(); // Effectively a no-op that can verify empty state
   * ```
   *
   * @returns A promise that resolves when all tracked promises have settled
   */
  readonly wait: () => Promise<void>;

  /**
   * Registers event listeners for promise settlement notifications.
   *
   * Events are emitted in real-time when tracked promises resolve or reject, providing detailed information about
   * timing, results, and labels. Multiple listeners can be registered and will all receive events.
   *
   * The event data includes duration measurements, optional labels, success/failure status, and result values (for
   * successful resolutions). This enables performance monitoring, debugging, and custom logging.
   *
   * @example Performance monitoring
   *
   * ```ts
   * const tracker = trackPromises();
   *
   * tracker.onSettled((event) => {
   *   const status = event.rejected ? 'FAILED' : 'SUCCESS';
   *   const label = event.label ?? 'unlabeled';
   *   console.log(`${label}: ${event.duration}ms - ${status}`);
   * });
   * ```
   *
   * @example Custom metrics collection
   *
   * ```ts
   * const metrics = { total: 0, failed: 0, avgDuration: 0 };
   *
   * tracker.onSettled((event) => {
   *   metrics.total++;
   *   if (event.rejected) metrics.failed++;
   *   metrics.avgDuration = (metrics.avgDuration + event.duration) / metrics.total;
   * });
   * ```
   *
   * @param listener Function called when any tracked promise settles
   */
  readonly onSettled: OnEvent<PromiseSettledEvent>;
};

/**
 * A specialized implementation of the Promise Tracker that (transiently) caches async operations by ID, ensuring each
 * operation runs only once *while* its returned promise is not settled.
 *
 * PromiseHolder is ideal when you need to prevent duplicate expensive operations, such as API calls, database queries,
 * or file system operations. Unlike PromiseTracker which focuses on coordination and monitoring, PromiseHolder
 * emphasizes operation deduplication and caching.
 *
 * The holder maintains a cache of ongoing operations by their unique IDs - in other words, the cache happens while
 * the promise is not settled. When the same ID is requested multiple times, the holder returns the same promise,
 * ensuring the underlying operation executes only once. The cache is automatically cleaned up when operations complete.
 *
 * When to use PromiseHolder vs PromiseTracker:
 *
 * - Use PromiseHolder for caching expensive operations that might be requested multiple times
 * - Use PromiseTracker for coordinating multiple different operations (like shutdown procedures), when there is no
 *   reason to identify an operation, or to track actual promises instead of operations.
 *
 * @example Basic caching of API calls
 *
 * ```ts
 * import { holdPromises } from 'emitnlog/tracker';
 *
 * const holder = holdPromises();
 *
 * // First call executes the API request
 * const user1 = holder.track('user-123', () => fetchUserFromAPI(123));
 *
 * // Second call returns the same promise, no duplicate API call
 * const user2 = holder.track('user-123', () => fetchUserFromAPI(123));
 *
 * console.log(user1 === user2); // true - same promise instance
 * ```
 *
 * @example Database query deduplication
 *
 * ```ts
 * import { holdPromises } from 'emitnlog/tracker';
 *
 * const queryHolder = holdPromises({ logger: dbLogger });
 *
 * // Multiple components request the same data simultaneously
 * const results = await Promise.all([
 *   queryHolder.track('product-456', () => db.query('SELECT * FROM products WHERE id = 456')),
 *   queryHolder.track('product-456', () => db.query('SELECT * FROM products WHERE id = 456')),
 *   queryHolder.track('product-456', () => db.query('SELECT * FROM products WHERE id = 456')),
 * ]);
 * // Only one database query was executed, but all components get the result
 * ```
 *
 * @example File system operation caching
 *
 * ```ts
 * import { holdPromises } from 'emitnlog/tracker';
 *
 * const fileHolder = holdPromises();
 *
 * // Cache expensive file operations
 * const processFile = async (filename: string) => {
 *   return fileHolder.track(`process-${filename}`, async () => {
 *     const content = await fs.readFile(filename, 'utf8');
 *     return processLargeFile(content); // Expensive operation
 *   });
 * };
 *
 * // Multiple calls to processFile with same filename will reuse the result
 * const result1 = await processFile('large-data.json');
 * const result2 = await processFile('large-data.json'); // Uses cached promise
 * ```
 *
 * @example Configuration loading with fallback
 *
 * ```ts
 * import { holdPromises } from 'emitnlog/tracker';
 *
 * const configHolder = holdPromises();
 *
 * const getConfig = (env: string) => {
 *   return configHolder.track(`config-${env}`, async () => {
 *     try {
 *       return await loadConfigFromRemote(env);
 *     } catch {
 *       return loadDefaultConfig();
 *     }
 *   });
 * };
 * ```
 */
export type PromiseHolder = Simplify<
  Omit<PromiseTracker, 'track'> & {
    /**
     * Checks if an operation with the given ID is currently cached (ongoing).
     *
     * Returns `true` if a promise with the specified ID is currently in progress. Once the operation completes
     * (resolves or rejects), the cache entry is automatically removed and this method will return `false`.
     *
     * This method is useful for conditional logic, debugging, or monitoring cache state without triggering any
     * operations.
     *
     * @example Conditional operation execution
     *
     * ```ts
     * const holder = holdPromises();
     *
     * if (!holder.has('expensive-calc')) {
     *   console.log('Starting expensive calculation...');
     * } else {
     *   console.log('Calculation already in progress...');
     * }
     *
     * const result = await holder.track('expensive-calc', () => performCalculation());
     * ```
     *
     * @example Cache monitoring
     *
     * ```ts
     * const holder = holdPromises();
     *
     * // Start some operations
     * holder.track('op1', () => longRunningTask1());
     * holder.track('op2', () => longRunningTask2());
     *
     * console.log(`Active operations: op1=${holder.has('op1')}, op2=${holder.has('op2')}`);
     * ```
     *
     * @param id The operation ID to check
     * @returns True if the operation is currently cached/ongoing, false otherwise
     */
    readonly has: (id: string) => boolean;

    /**
     * Caches and tracks an async operation by its unique ID, ensuring it runs only once per ID.
     *
     * When called with an ID that's already cached, returns the existing promise without executing the supplier again.
     * When called with a new ID, executes the supplier function and caches the resulting promise.
     *
     * The cache is automatically cleaned up when the operation settles (resolves or rejects), allowing the same ID to
     * be used again for future operations.
     *
     * Operations are tracked with the same monitoring capabilities as PromiseTracker, including timing measurements and
     * event notifications.
     *
     * Clients are expected to ensure that the id is unique based on the nature of the operation: for example, in some
     * cases the id may refer to operation itself, in others it may need to be augmented with argument information.
     *
     * @example API call deduplication
     *
     * ```ts
     * const holder = holdPromises();
     *
     * // These calls happen simultaneously from different parts of the app
     * const [result1, result2, result3] = await Promise.all([
     *   holder.track('user-data', () => fetchUserProfile()),
     *   holder.track('user-data', () => fetchUserProfile()),
     *   holder.track('user-data', () => fetchUserProfile()),
     * ]);
     * // Only one fetchUserProfile() call was made, all get the same result
     * ```
     *
     * @example Error handling with caching
     *
     * ```ts
     * const holder = holdPromises();
     *
     * try {
     *   const result = await holder.track('risky-op', () => riskyAsyncOperation());
     *   console.log('Success:', result);
     * } catch (error) {
     *   console.log('Failed:', error);
     *   // The failed operation is removed from cache, so retry is possible
     *
     *   // Later retry with same ID works
     *   const retryResult = await holder.track('risky-op', () => riskyAsyncOperation());
     * }
     * ```
     *
     * @param id Unique identifier for the operation. Operations with the same ID will be deduplicated.
     * @param supplier Function that returns the promise to execute. Only called once per unique ID.
     * @returns The promise from the supplier (cached or fresh)
     */
    track<T>(id: string, supplier: () => Promise<T>): Promise<T>;
  }
>;

/**
 * A persistent caching implementation of PromiseHolder that retains settled promises until manually cleared.
 *
 * PromiseVault provides long-term caching of expensive operations that don't change frequently, such as configuration
 * loading, initialization routines, or API calls for static data. Unlike PromiseHolder which automatically clears
 * cached promises when they settle, PromiseVault maintains the cache indefinitely until explicitly cleared.
 *
 * This is particularly useful for:
 * - Application initialization that should happen only once
 * - Configuration loading that remains valid for the application lifetime
 * - Expensive computations with results that don't change
 * - API calls for static or rarely-changing data
 *
 * **Cache Management:**
 * - Promises remain cached even after settlement (success or failure)
 * - Manual control via `clear()` to empty entire cache or `forget()` for specific entries
 * - Failed operations can be automatically cleared with `forgetOnRejection` option, or manually with `forget()`
 *
 * **Comparison with other promise utilities:**
 * - `PromiseTracker`: Coordination and monitoring, no caching
 * - `PromiseHolder`: Transient caching during promise lifecycle only
 * - `PromiseVault`: Persistent caching with manual lifecycle control
 *
 * @example Application initialization caching
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * const initVault = vaultPromises({ logger: appLogger });
 *
 * // These expensive operations happen only once, even across multiple calls
 * const initializeDatabase = () => initVault.track('database', () => setupDatabaseConnection());
 * const loadConfiguration = () => initVault.track('config', () => fetchAppConfiguration());
 * const setupAuthentication = () => initVault.track('auth', () => initializeAuthSystem());
 *
 * // Multiple components can safely call these - only first call executes
 * await Promise.all([
 *   initializeDatabase(),
 *   loadConfiguration(),
 *   setupAuthentication(),
 * ]);
 *
 * // Later in the application - these return cached results instantly
 * const config = await loadConfiguration(); // Uses cached promise
 * const dbConnection = await initializeDatabase(); // Uses cached promise
 * ```
 *
 * @example Configuration management with refresh capability
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * const configVault = vaultPromises({ logger: configLogger });
 *
 * const getConfig = (environment: string) => {
 *   return configVault.track(`config-${environment}`, async () => {
 *     console.log(`Loading config for ${environment}...`);
 *     return await fetchConfigFromRemote(environment);
 *   });
 * };
 *
 * // Initial load
 * const config1 = await getConfig('production');
 *
 * // Subsequent calls use cached result
 * const config2 = await getConfig('production'); // No network call
 *
 * // Force refresh when needed
 * configVault.forget('config-production');
 * const freshConfig = await getConfig('production'); // New network call
 * ```
 *
 * @example Static data caching with selective invalidation
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * const dataVault = vaultPromises();
 *
 * // Cache expensive computations or API calls
 * const getStaticData = (dataType: string) => {
 *   return dataVault.track(`static-${dataType}`, async () => {
 *     return await fetchStaticDataFromAPI(dataType);
 *   });
 * };
 *
 * // Load various static data - cached indefinitely
 * const countries = await getStaticData('countries');
 * const currencies = await getStaticData('currencies');
 * const timezones = await getStaticData('timezones');
 *
 * // Invalidate specific cache entries when data changes
 * dataVault.forget('static-countries'); // Only countries will be refetched
 *
 * // Or clear all cached data
 * dataVault.clear();
 * ```
 *
 * @example Resource loading with error handling
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * const resourceVault = vaultPromises({ logger: resourceLogger });
 *
 * const loadResource = async (resourceId: string) => {
 *   return resourceVault.track(`resource-${resourceId}`, async () => {
 *     const response = await fetch(`/api/resources/${resourceId}`);
 *     if (!response.ok) {
 *       throw new Error(`Failed to load resource: ${response.status}`);
 *     }
 *     return response.json();
 *   });
 * };
 *
 * // Handle errors and retries
 * try {
 *   const resource = await loadResource('important-data');
 * } catch (error) {
 *   console.error('Resource load failed:', error);
 *
 *   // Remove failed attempt from cache to allow retry
 *   resourceVault.forget('resource-important-data');
 *
 *   // Retry with fresh attempt
 *   const resource = await loadResource('important-data');
 * }
 * ```
 *
 * @example Automatic retry on failure with forgetOnRejection
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * // Vault that automatically clears failed operations for retry
 * const retryVault = vaultPromises({
 *   logger: apiLogger,
 *   forgetOnRejection: true
 * });
 *
 * const fetchWithRetry = async (url: string) => {
 *   return retryVault.track(`fetch-${url}`, async () => {
 *     const response = await fetch(url);
 *     if (!response.ok) {
 *       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
 *     }
 *     return response.json();
 *   });
 * };
 *
 * // First call fails and is automatically removed from cache
 * try {
 *   await fetchWithRetry('/api/data');
 * } catch (error) {
 *   console.log('First attempt failed');
 * }
 *
 * // Second call executes fresh attempt (not cached)
 * try {
 *   const data = await fetchWithRetry('/api/data'); // New attempt
 *   console.log('Retry succeeded:', data);
 * } catch (error) {
 *   console.log('Retry also failed');
 * }
 * ```
 *
 * @example Mixed caching strategies
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * // Cache successful results but allow retries for failures
 * const smartVault = vaultPromises({ forgetOnRejection: true });
 *
 * const getConfigWithFallback = async (env: string) => {
 *   return smartVault.track(`config-${env}`, async () => {
 *     try {
 *       // Try remote config first
 *       return await fetchRemoteConfig(env);
 *     } catch (remoteError) {
 *       // Fall back to local config
 *       console.warn(`Remote config failed, using local: ${remoteError.message}`);
 *       return await loadLocalConfig(env);
 *     }
 *   });
 * };
 *
 * // If remote fails, operation throws and is cleared from cache
 * // If local succeeds, result is cached permanently
 * const config = await getConfigWithFallback('production');
 * ```
 *
 * @example Performance monitoring with persistent caching
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * const performanceVault = vaultPromises({ logger: perfLogger });
 *
 * // Monitor cache hit rates
 * const getCacheStats = () => {
 *   return {
 *     size: performanceVault.size,
 *     entries: Array.from({length: performanceVault.size}).map((_, i) => `entry-${i}`)
 *   };
 * };
 *
 * // Track performance of cached operations
 * performanceVault.onSettled((event) => {
 *   const cacheHit = event.duration < 10; // Cached results are very fast
 *   console.log(`${event.label}: ${event.duration}ms (${cacheHit ? 'CACHE HIT' : 'CACHE MISS'})`);
 * });
 *
 * const expensiveOperation = (id: string) => {
 *   return performanceVault.track(`operation-${id}`, async () => {
 *     // Simulate expensive operation
 *     await new Promise(resolve => setTimeout(resolve, 1000));
 *     return `Result for ${id}`;
 *   });
 * };
 *
 * // First call: cache miss, slow
 * await expensiveOperation('test'); // ~1000ms
 *
 * // Second call: cache hit, fast
 * await expensiveOperation('test'); // ~1ms
 * ```
 *
 * @example Graceful cache invalidation patterns
 *
 * ```ts
 * import { vaultPromises } from 'emitnlog/tracker';
 *
 * const cacheVault = vaultPromises();
 *
 * // Time-based invalidation
 * const cacheTimestamps = new Map<string, number>();
 * const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
 *
 * const getWithTTL = async (key: string, fetcher: () => Promise<any>) => {
 *   const now = Date.now();
 *   const timestamp = cacheTimestamps.get(key);
 *
 *   if (timestamp && now - timestamp > CACHE_TTL) {
 *     cacheVault.forget(key);
 *     cacheTimestamps.delete(key);
 *   }
 *
 *   if (!cacheVault.has(key)) {
 *     cacheTimestamps.set(key, now);
 *   }
 *
 *   return cacheVault.track(key, fetcher);
 * };
 *
 * // Usage with automatic TTL
 * const data = await getWithTTL('user-settings', () => fetchUserSettings());
 * ```
 */
export type PromiseVault = PromiseHolder & {
  /**
   * Clears all cached promises from the vault.
   *
   * After calling this method, all subsequent `track()` calls will execute their suppliers regardless of whether
   * they were previously cached. This is useful for global cache invalidation or cleanup scenarios.
   *
   * @example Global cache reset
   *
   * ```ts
   * const vault = vaultPromises();
   *
   * // Cache some operations
   * await vault.track('config', () => loadConfig());
   * await vault.track('data', () => loadData());
   *
   * console.log(vault.size); // 2
   *
   * // Clear all cached entries
   * vault.clear();
   *
   * console.log(vault.size); // 0
   *
   * // Next calls will execute suppliers again
   * await vault.track('config', () => loadConfig()); // Executes loadConfig()
   * ```
   */
  clear(): void;

  /**
   * Removes a specific cached promise from the vault.
   *
   * This allows selective invalidation of cache entries. The next `track()` call with the same ID will execute the
   * supplier again instead of returning the cached promise.
   *
   * @example Selective cache invalidation
   *
   * ```ts
   * const vault = vaultPromises();
   *
   * // Cache some operations
   * await vault.track('user-123', () => fetchUser(123));
   * await vault.track('user-456', () => fetchUser(456));
   *
   * // Invalidate specific user
   * const wasRemoved = vault.forget('user-123');
   * console.log(wasRemoved); // true
   *
   * // user-123 will be fetched again, user-456 uses cached version
   * await vault.track('user-123', () => fetchUser(123)); // Executes fetchUser(123)
   * await vault.track('user-456', () => fetchUser(456)); // Uses cached promise
   * ```
   *
   * @example Error recovery
   *
   * ```ts
   * const vault = vaultPromises();
   *
   * try {
   *   await vault.track('risky-op', () => riskyOperation());
   * } catch (error) {
   *   // Remove failed operation from cache to allow retry
   *   vault.forget('risky-op');
   *
   *   // Retry will execute the operation again
   *   await vault.track('risky-op', () => riskyOperation());
   * }
   * ```
   *
   * @param id The ID of the cached promise to remove
   * @returns True if the entry was found and removed, false if it wasn't in the cache
   */
  forget(id: string): boolean;
};

/**
 * Event data emitted when a tracked promise settles (resolves or rejects).
 *
 * This event provides comprehensive information about the promise lifecycle, including timing data, optional labeling,
 * success/failure status, and result values. The duration measurement starts from when `track()` is invoked, or more
 * accurately, from when a promise supplier function is called.
 */
export type PromiseSettledEvent = {
  /**
   * Optional label provided when tracking the promise.
   *
   * Labels help identify specific promises in logs and event handlers, especially useful when tracking multiple
   * promises of the same type.
   */
  readonly label?: string;

  /**
   * Duration of the promise lifecycle in milliseconds.
   *
   * For direct promises, timing starts when `track()` is called. For promise suppliers (functions), timing starts when
   * the supplier function is invoked, providing more accurate measurements of the actual async operation duration.
   *
   * @example
   *
   * ```ts
   * // Less accurate - includes time between track() call and promise creation
   * tracker.track(someAsyncFunction(), 'operation');
   *
   * // More accurate - measures only the async operation itself
   * tracker.track(() => someAsyncFunction(), 'operation');
   * ```
   */
  readonly duration: number;

  /**
   * Indicates whether the promise was rejected.
   *
   * When `true`, the promise rejected with an error. When `false` or undefined, the promise resolved successfully.
   */
  readonly rejected?: boolean;

  /**
   * The result of the promise, either the resolved rejected value.
   */
  readonly result?: unknown;
};
