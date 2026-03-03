---
'emitnlog': patch
---

Refactor file logger options and file sink: immutable options in createFileLogger, clearer state (needsOverwrite), idempotent directory init via promise, one newline per log line
