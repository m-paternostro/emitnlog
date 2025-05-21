# emitnlog

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
