# emitnlog

## 0.9.2

### Patch Changes

- f9716d5: Add `withEmitLevel` to control the level of emitted entries
- b681bf1: enhance JSON formatting and add layout options to file logger
- 601ba3b: Add `withLevel` to create a logger with a different log level
- 5b2cfc4: Enhance `asExtendedLogger` and "with utils" to support prefix loggers

## 0.9.1

### Patch Changes

- aca9e0d: Allow the `wait` method of `PromiseHolder` and `PromiseVault` to wait for specific ids.
- 9f0e6e7: Improve the return types of the `closeAll` and `asClosable` functions to better reflect whether the closables are synchronous or asynchronous.

## 0.9.0

### Minor Changes

- 4fe6732: This change includes some significant improvements to the logger implementation and a breaking change for users.

  Breaking changes:
  - Class-based loggers removed: `ConsoleLogger`, `ConsoleErrorLogger`, and `FileLogger` are no longer available. Users should use the factory functions instead:
    - `createConsoleLogLogger`
    - `createConsoleErrorLogger`
    - `createConsoleByLevelLogger`
    - `createFileLogger`
  - BaseLogger must now be imported using the `implementation` namespace (`import { implementation } from 'emitnlog/logger';`)

  See the [logger.md](docs/logger.md) file for more details.

- da019f3: This change includes some significant improvements to the packing of the project and a breaking change for users.

  Users no longer need to explicitly import from the `node` subpath. The correct runtime variant (neutral or Node-specific) is now automatically resolved based on the environment. This simplifies usage but may affect setups that previously relied on manually selecting the Node export.

### Patch Changes

- 13c0de8: Utils small improvements: sync utilities docs with code; improve JSDoc
- a09ffee: Enforce notify return and more accurate void check
- 350928d: `stringify` now ignores object keys that throw error when accessed
- 593e547: `errorify` now uses `stringify` to compute the error message.
- 8073a17: Add `requestLogger`, a drop-in Express-compatible middleware that logs request lifecycle events.
- 987c35e: Tracker small improvements: clarify invocation index, export promise option types, and fix docs
- 19c4d53: Adds "closable" utilities: `closeAll`, `asClosable`, `asSafeClosable`, `createCloser`

## 0.8.0

### Minor Changes

- 2bd616c: Notifier fixes and implementation improvements

### Patch Changes

- 2bd616c: Tracker documentation and minor improvements
- a171807: Add the small documents referenced by the README to the packaged project

## 0.7.0

### Minor Changes

- 778b2f3: Add PromiseVault to help with code that require caching promises.

### Patch Changes

- bfebe80: Break README into smaller, more consumable, parts.
- b2f6798: Improve stringify and add stringify options to loggers

## 0.6.0

### Minor Changes

- 195cec8: Add PromiseHolder to prevent duplicate execution of expensive asynchronous operations

## 0.5.0

### Minor Changes

- b9eb592: Add `mapOnEvent` to make it easier to expose internal notifiers
- 8244da8: Add a dynamic version of `fromEnv` that supports both neutral and node
- 78adc68: Debounce notifications and debounce utility
- 9f3b5fc: Add `fromEnv` to allow configuring the logger via environment variables
- be6a5f0: Add tags to `trackMethods`
- df3fb93: Add `PromiseTracker` and `trackPromise` for monitoring and coordinating multiple unrelated promises
- 5a737c1: The tracker invocation now expose the 'stage' information as a property
- c540029: Loggers now support a format option that includes a JSON serialization version of a log line
- d2ee3d7: Allow notifier without type parameter

### Patch Changes

- c4996dc: Allow mapOnEvent to skip an event
- 28e902b: Add operation template to `trackMethods`

## 0.4.1

### Patch Changes

- 0c9e4ca: PrefixedLogger improvements, including appendPrefix and resetPrefix utilities.

## 0.4.0

### Minor Changes

- 9d03081: Add Invocation Tracker: a lightweight utility to monitor function calls, built on top of the emit n’ log core components.
- cfe5c30: PrefixedLogger: use `withPrefix` to automatically add prefixes to log messages

### Patch Changes

- e4c3f63: Rename logger/logger.ts to logger/definition.ts
- 13b4b5b: Document notifier 'waitForEvent'

## 0.3.0

### Minor Changes

- fbe25d9: Add `waitNextEvent` method to notifier allowing promise-based listeners.
- efb7358: Adding `renew` to deferredValue (and also indicating if it has been settled)

### Patch Changes

- af99872: Exposing the test coverage as a badge

## 0.2.1

### Patch Changes

- 63dfd36: Add readonly to types and better documentation

## 0.2.0

### Minor Changes

- 766c97a: Retry option for the file operation for FileLogger and new utilities (`createDeferredValue` and `startPolling`)
- 5c0fe92: Add notifier `OnEvent` type to make it easier to define notifiable interfaces
- bc869df: Better support for non-blocking FileLogger and new utilities (`delay` and `withTimeout`)
- 931eb57: New utility `isNotNullable`

### Patch Changes

- 6f0c479: Fix README Table of Contents for GitHub and NPM
- 1761fe9: README badges

## 0.1.0

### Minor Changes

- 45bb002: Initial release with logging and event notification support, tested and documented.
