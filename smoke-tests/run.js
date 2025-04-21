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

// Get the smoke tests directory
const smokeTestsDir = __dirname;

// Pack the package directly into the smoke-tests directory
console.log('Packing package...');
const packOutput = execSync('npm pack --pack-destination ' + smokeTestsDir, {
  encoding: 'utf8',
  cwd: path.join(__dirname, '..'),
});
const packageFileName = packOutput.trim().split('\n').pop();
const packagePath = path.join(smokeTestsDir, packageFileName);

// Install the package in the smoke tests directory
console.log('Installing package in smoke tests directory...');
execSync(`npm install --no-save ${packagePath}`, { cwd: smokeTestsDir, stdio: 'inherit' });

// Run ESM smoke tests
console.log('Running ESM smoke tests...');
try {
  // Use node directly with explicit experimental flag to make sure ESM tests work
  execSync('node --experimental-vm-modules ../../node_modules/jest/bin/jest.js', {
    cwd: path.join(smokeTestsDir, 'esm'),
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
  });
  console.log('ESM smoke tests passed!');
} catch (error) {
  console.error('ESM smoke tests failed!');
  process.exit(1);
}

// Run CJS smoke tests
console.log('Running CJS smoke tests...');
try {
  execSync('npm test', { cwd: path.join(smokeTestsDir, 'cjs'), stdio: 'inherit' });
  console.log('CJS smoke tests passed!');
} catch (error) {
  console.error('CJS smoke tests failed!');
  process.exit(1);
}

// Note: We're keeping the tarball in the smoke-tests directory
// for reference and to make it available for manual testing if needed.
// It's ignored via .gitignore
