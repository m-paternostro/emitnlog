---
'emitnlog': minor
---

This change includes some significant improvements to the logger implementation and a breaking change for users.

Breaking changes:

- Class-based loggers removed: `ConsoleLogger`, `ConsoleErrorLogger`, and `FileLogger` are no longer available. Users should use the factory functions instead:
  - `createConsoleLogLogger`
  - `createConsoleErrorLogger`
  - `createConsoleByLevelLogger`
  - `createFileLogger`
- BaseLogger must now be imported using the `implementation` namespace (`import { implementation } from 'emitnlog/logger';`)

See the [logger.md](docs/logger.md) file for more details.
