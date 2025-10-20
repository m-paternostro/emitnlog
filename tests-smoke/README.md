# Smoke Tests

This directory contains smoke tests for the `emitnlog` package. These tests verify that the package can be properly imported and used after it has been built and published.

## Purpose

The smoke tests verify:

- ESM and CJS imports work as expected (flat, namespace, and path imports)
- The core functionality is accessible and working
- There is no duplication of declarations, by testing singletons and class definitions

These tests complement the unit tests by validating the package from a consumer's perspective, ensuring that the build and packaging process produces a correctly functioning library.

## Structure

- `node/`: Tests for Node.js environment (uses Node-specific builds and features)
  - `esm/`: ESM tests with Node.js-specific functionality
  - `cjs/`: CommonJS tests with Node.js-specific functionality
- `non-node/`: Tests for non-Node environments (browser-like, uses platform-neutral builds)
  - `esm/`: ESM tests using platform-neutral builds
  - `cjs/`: CommonJS tests using platform-neutral builds
- Each folder contains tests for flat imports, namespace imports, and (sub)path imports

## Running the Tests

To run the smoke tests:

```bash
# Run smoke tests using current build
npm run test:smoke

# Run smoke tests with a fresh build
npm run test:smoke:build
```

This will:

1. Pack the package into a tarball (building first if using test:smoke:build)
2. Install it in the `tests-smoke` directory
3. Run both Node and non-Node environment tests:
   - Node environment tests verify Node-specific features (file logging, AsyncLocalStorage)
   - Non-Node environment tests verify platform-neutral builds work correctly
4. For each environment, both ESM and CJS tests are executed

You can also run the script directly:

```bash
# Run smoke tests using current build
node tests-smoke/run.js

# Run smoke tests with a fresh build
node tests-smoke/run.js --build
```

## How It Works

The smoke tests simulate how real users would consume the package in different environments:

1. The package is built and packed into a tarball
2. The tarball is installed in the `tests-smoke` directory
3. Tests import from the installed package using different module resolution conditions:
   - **Node environment**: Uses the `"node"` condition from package.json exports, getting Node-specific builds
   - **Non-Node environment**: Forces the `"default"` condition, getting platform-neutral builds
4. Tests verify that imports work and expected functionality is available for each environment

### Key Differences Between Environments

**Node Environment Tests:**

- File-based logging works with `fromEnv()` when `EMITNLOG_LOGGER=file:...`
- `createAsyncLocalStorageInvocationStack()` is available for tracking
- Uses builds optimized for Node.js (platform: 'node', target: 'node20')

**Non-Node Environment Tests:**

- File-based logging is disabled; `fromEnv()` always returns `OFF_LOGGER`
- `createAsyncLocalStorageInvocationStack()` is undefined (AsyncLocalStorage is Node-specific)
- Uses platform-neutral builds (platform: 'neutral', target: 'es2023')
