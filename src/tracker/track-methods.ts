import { isNotNullable } from '../utils/common/is-not-nullable.ts';
import type { InvocationTracker } from './definition.ts';

/**
 * Wraps and tracks methods of the given object using the provided tracker.
 *
 * This utility modifies the passed-in object directly, replacing method implementations with tracked versions. If
 * method names are not specified, all enumerable method names (including inherited ones, except from Object.prototype)
 * are tracked. Clients should consider reducing the amount of tracked method for objects with too many properties.
 *
 * Works with both class instances and plain objects. Supports any value with callable properties, including arrays and
 * built-in types — use with care if targeting unexpected inputs.
 *
 * By default the method of built-in objects (like Arrays, Maps, and Sets) are not tracked. Use the
 * `options.trackBuiltIn` to change this behavior, however these objects may behave unexpectedly in testing frameworks
 * or serialization tools after being tracked.
 *
 * @example
 *
 * ```ts
 * // Track all methods of a plain object
 * const calculator = { add: (a, b) => a + b, subtract: (a, b) => a - b };
 * trackMethods(tracker, calculator);
 * calculator.add(5, 3); // This invocation will be tracked
 * ```
 *
 * @example
 *
 * ```ts
 * // Track specific methods only
 * class UserService {
 *   createUser(name) {
 *     return { id: 1, name };
 *   }
 *   deleteUser(id) {
 *     return true;
 *   }
 *   getUsers() {
 *     return [];
 *   }
 * }
 * const service = new UserService();
 *
 * // Only createUser and deleteUser are tracked
 * trackMethods(tracker, service, { methods: ['createUser', 'deleteUser'] });
 * ```
 *
 * @example
 *
 * ```ts
 * // Track methods of built-in types
 * const mySet = new Set([1, 2, 3]);
 * trackMethods(tracker, mySet, { methods: ['add', 'delete'], trackBuiltIn: true });
 * mySet.add(4); // This invocation is tracked
 * ```
 *
 * @param tracker - The tracker to use to track the methods.
 * @param target - The object to track the methods of.
 * @param options - The options to use to track the methods.
 * @returns A set of method names that were successfully wrapped.
 */
export const trackMethods = (
  tracker: InvocationTracker,
  target: unknown,
  options?: {
    /**
     * The methods to track. If not provided, all enumerable method names (including inherited ones, except from
     * Object.prototype) are tracked.
     */
    readonly methods?: readonly string[];

    /**
     * Whether to include the constructor in the tracked methods.
     *
     * This value is ignored if `methods` is specified.
     */
    readonly includeConstructor?: boolean;

    /**
     * Whether to track built-in objects like Arrays, Maps, and Sets.
     */
    readonly trackBuiltIn?: boolean;
  },
): ReadonlySet<string> => {
  if (!isNotNullable(target) || (!options?.trackBuiltIn && isBuiltIn(target))) {
    return new Set();
  }

  const selected = options?.methods?.length
    ? new Set(options.methods.filter((method) => isMethod(target, method)))
    : collectAllMethods(target, options?.includeConstructor);

  if (!selected.size) {
    return selected;
  }

  for (const method of selected) {
    const fn = (target as Record<string, () => unknown>)[method];
    (target as Record<string, () => unknown>)[method] = tracker.track(method, fn.bind(target));
  }

  return selected;
};

const collectAllMethods = (notNullable: unknown, includeConstructor: boolean | undefined): ReadonlySet<string> => {
  const methodNames = new Set<string>();

  let current: unknown = notNullable;
  while (current && current !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(current)) {
      if (isMethod(current, key) && (includeConstructor || key !== 'constructor')) {
        methodNames.add(key);
      }
    }
    current = Object.getPrototypeOf(current);
  }

  return methodNames;
};

const isMethod = (notNullable: unknown, key: string): boolean =>
  typeof (notNullable as Record<string, unknown>)[key] === 'function';

const isBuiltIn = (target: object): boolean => {
  const ctor = (target as Record<string, unknown>).constructor;
  return ctor === Array || ctor === Map || ctor === Set || ctor === WeakMap || ctor === WeakSet;
};
