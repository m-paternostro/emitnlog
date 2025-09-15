# AGENTS Guidelines for This Repository (emitnlog)

This repository implements `emitnlog`, a modern, type‑safe library for logging, event notifications, and observability in JavaScript/TypeScript.
When working on the project interactively with an agent, follow the guidelines below to keep changes clean, consistent, and easy to validate.

## 1. Repo Overview

- Zero dependencies, ESM‑first library with CJS bundles produced by `tsup`.
- Targets neutral JavaScript runtimes; Node.js specifics are kept separate and bundled.
- `tsc` performs type checking only (no emit). JS conversion is done by `tsup`.
- Source lives under `src/`; tests live under `tests/` and use Jest; "smoke tests" live under `tests-smoke` and also use Jest.

## 2. Useful Commands

| Command                    | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `npm run format`           | Format the code.                                          |
| `npm run format:check`     | Check formatting without writing changes.                 |
| `npm run lint`             | ESLint with auto‑fix where possible.                      |
| `npm run lint:check`       | ESLint checks only (no fixes).                            |
| `npm run typecheck`        | TypeScript checks (no code emit).                         |
| `npm run build`            | Build ESM/CJS bundles via `tsup`.                         |
| `npm run test`             | Run tests with Jest.                                      |
| `npm run test:coverage`    | Run tests with coverage.                                  |
| `npm run test:smoke`       | Run smoke tests (without rebuilding).                     |
| `npm run test:smoke:build` | Build and run the smoke tests.                            |
| `npm run validate`         | Typecheck → build → format check → lint check (no tests). |

Tip: During active iteration, run `npm run typecheck` and `npm run test` frequently; before handoff, run `npm run validate` and then `npm run postvalidate`.

## 3. Coding Conventions

- TypeScript:
  - Type safety is required; NEVER use `any`.
  - Keep code clean, precise, and idiomatic TypeScript consistent with existing patterns.
  - Minimize exports: only export what is truly needed.
  - Prefer reusing utilities from `src/utils`. If a utility complicates the code, flag it for discussion (it might need improvement or removal).
- Style and design:
  - Follow the project’s logging, testing, and naming conventions.
  - Keep duplication low; adhere to established design patterns in adjacent code.
- Comments and docs:
  - Line comments are only for non‑obvious design decisions; avoid restating the method name or obvious behavior.
  - Exported APIs should have JSDoc unless trivially self‑explanatory.
    - Include parameters, return type details (e.g., read‑only arrays, undefined cases), errors thrown/rejected, and gotchas.
    - Provide at least one example; if multiple are needed, order from simplest to most complex.
    - Maintain consistency with existing documentation patterns and favor usefulness in editors/tooltips.

## 4. Tests

- Framework: Jest with explicit imports from `@jest/globals`.
- Philosophy:
  - Focus on validating behavior over implementation details; it’s OK to test internals when flow/timing is complex.
  - Prefer real code; use Jest mocking only when absolutely necessary and keep it minimal.
  - Maintain high, useful coverage—do not add tests merely for coverage.
  - On failures, review real code first, then consider test issues.
- Utilities: See `tests/jester.setup.ts` for useful helpers.

## 5. Imports

- Separate type and value imports into distinct lines; use `type` keyword for type imports.
  - Example: `import type { Foo } from './foo.ts'` and `import { bar } from './bar.ts'`.
- In `src/`: use relative paths and include the `.ts` extension.
- In `tests/`: import relatively from either `index.ts` or `index-node.ts` in `src`.
- There are lint rules that enforce import order and structure; keep imports tidy.

## 6. Runtime Targets

- Primary target is neutral runtimes. Node.js specifics can be used but must be clearly separated and bundled appropriately.
- ESM and CJS bundles (including neutral and Node variants) are produced with `tsup`.
- When in doubt, favor neutral implementations and avoid Node‑only APIs in shared code paths.

## 7. Process & Workflow

- Backwards compatibility can be broken only when it clearly simplifies and cleans the design.
- If anything is unclear, ask clarifying questions before coding.
- For non‑trivial changes:
  1. Present a concise plan (design, structure, package layout, API surface).
  2. Proceed to implementation after alignment.
- Keep changes scoped and surgical; do not over‑refactor or change filenames/styles unnecessarily.
- Update documentation as needed to keep it consistent and helpful.

## 8. Working With Agents (Codex CLI)

- Exploration:
  - Use a fast code search tool available in the environment (for example `rg` if installed; otherwise `git grep`, `grep -R`, `fd`, etc.). The goal is speed and reliability, not a specific binary.
  - Read files in chunks sized to the tool’s output limits. If unsure, start with small chunks (around 200–300 lines or similar byte caps) and adjust to the harness/agent constraints.
- Edits:
  - Use targeted patches; keep diffs minimal and focused on the task at hand.
  - Adhere to existing code style and docs patterns; do not add external dependencies (project policy is zero dependencies) unless explicitly requested.
- Validation:
  - For iteration: run `npm run typecheck` and `npm run test` as needed; optionally run `npm run test:smoke` when relevant.
  - Before handoff: run `npm run validate` to ensure build and all tests pass.
  - If validation fails on format or lint: run `npm run format` and then `npm run lint` (auto‑fixes some issues), make any remaining code changes as needed, and re‑run `npm run validate`.
- Tests and builds should not introduce external side effects. Keep CI‑friendly by avoiding network, filesystem, or environment coupling unless already supported by the repo.

## 9. Where to Look

- Project README: `README.md` and linked files — overview, examples, and links to component docs.
- Bundling config: `tsup.config.ts` — how ESM/CJS/node bundles are produced.
- Package exports and entry points: `package.json` → `exports`.
- Utilities: `src/utils/` — prefer reuse over re‑implementation.
- Smoke test README: `tests-smoke/README.md`

---

By following these guidelines, changes stay consistent, type‑safe, and easy to maintain while preserving the project’s runtime neutrality and zero‑dependency design.
