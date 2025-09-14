#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if we need to build the package
const shouldBuild = process.argv.includes('--build');
if (shouldBuild) {
  console.log('Building package...');
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} else {
  console.log('Skipping build step (use --build flag to force build)');
}

// Get the tests-smoke directory
const testsSmokeDir = __dirname;

// Pack the package directly into the tests-smoke directory
console.log('Packing package...');
const packOutput = execSync('npm pack --pack-destination ' + testsSmokeDir, {
  encoding: 'utf8',
  cwd: path.join(__dirname, '..'),
});
const packageFileName = packOutput.trim().split('\n').pop();
const packagePath = path.join(testsSmokeDir, packageFileName);

// Install the package in the smoke tests directory
console.log('Installing package in smoke tests directory...');
execSync(`npm install --no-save ${packagePath}`, { cwd: testsSmokeDir, stdio: 'inherit' });

// Helper function to run tests for a specific environment
const runEnvironmentTests = (environment) => {
  console.log(`\n=== Running ${environment.toUpperCase()} Environment Tests ===`);

  // Run ESM tests
  console.log(`Running ${environment} ESM smoke tests...`);
  try {
    execSync('npm test', {
      cwd: path.join(testsSmokeDir, environment, 'esm'),
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log(`${environment} ESM smoke tests passed!`);
  } catch (error) {
    console.error(`${environment} ESM smoke tests failed!`);
    process.exit(1);
  }

  // Run CJS tests
  console.log(`Running ${environment} CJS smoke tests...`);
  try {
    execSync('npm test', { cwd: path.join(testsSmokeDir, environment, 'cjs'), stdio: 'inherit' });
    console.log(`${environment} CJS smoke tests passed!`);
  } catch (error) {
    console.error(`${environment} CJS smoke tests failed!`);
    process.exit(1);
  }
};

// Run tests for both environments
runEnvironmentTests('node');

// Note: We're keeping the tarball in the tests-smoke directory
// for reference and to make it available for manual testing if needed.
// It's ignored via .gitignore
