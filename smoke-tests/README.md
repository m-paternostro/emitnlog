# Smoke Tests

This directory contains smoke tests for the `emitnlog` package. These tests verify that the package can be properly imported and used after it has been built and published.

## Purpose

The smoke tests verify:

- ESM imports work as expected (both flat and named imports)
- CommonJS imports work as expected (both flat and named imports)
- The core functionality is accessible and working

These tests complement the unit tests by validating the package from a consumer's perspective, ensuring that the build and packaging process produces a correctly functioning library.

## Structure

- `esm/`: Contains tests for ESM imports
- `cjs/`: Contains tests for CommonJS imports
- Each folder has tests for both flat imports and named/subpath imports

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
2. Install it in the smoke-tests directory
3. Run both ESM and CJS tests
4. Clean up afterward

You can also run the script directly:

```bash
# Run smoke tests using current build
node smoke-tests/run.js

# Run smoke tests with a fresh build
node smoke-tests/run.js --build
```

## How It Works

The smoke tests simulate how a real user would consume the package:

1. The package is built and packed into a tarball
2. The tarball is installed in the smoke-tests directory
3. Tests import from the installed package
4. Tests verify that imports work and basic functionality is accessible
