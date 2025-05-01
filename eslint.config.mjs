import path from 'node:path';
import { fileURLToPath } from 'node:url';

import globals from 'globals';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import stylistic from '@stylistic/eslint-plugin';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import ts from 'typescript-eslint';
import * as nodeImportPrefix from 'eslint-plugin-require-node-import-prefix';

export default ts.config([
  {
    name: 'ignore',
    ignores: ['coverage/**', 'dist/**', '**/*.js', '**/*.cjs', '**/*.mjs', 'jest.config.ts', 'tsup.config.ts'],
  },
  {
    name: 'default',

    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url)) },
    },

    extends: [prettier, ts.configs.strictTypeChecked, importPlugin.flatConfigs.recommended],

    plugins: {
      '@stylistic': stylistic,
      'simple-import-sort': simpleImportSort,
      'require-node-import-prefix': nodeImportPrefix,
    },

    rules: {
      // Enforce consistent arrow function parentheses
      '@stylistic/arrow-parens': 'error',

      // Enforce consistent delimiter style for interfaces and type literals
      '@stylistic/member-delimiter-style': 'error',

      // Enforce consistent spacing around type annotations
      '@stylistic/type-annotation-spacing': [
        'error',
        { after: true, before: false, overrides: { arrow: { after: true, before: true } } },
      ],

      // Enforce using array type syntax for arrays
      '@typescript-eslint/array-type': ['error', { default: 'array' }],

      // Enforce consistent return statements
      '@typescript-eslint/consistent-return': 'error',

      // Enforce consistent type assertion style using 'as'
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'allow-as-parameter' },
      ],

      // Enforce using type imports rather than value imports for types
      '@typescript-eslint/consistent-type-imports': 'error',

      // Require explicit accessibility modifiers on class properties and methods
      '@typescript-eslint/explicit-member-accessibility': 'error',

      // Prevent implicit toString() calls that may yield unexpected results
      '@typescript-eslint/no-base-to-string': 'error',

      // Prevent expressions that have confusing void returns
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],

      // Disallow empty functions
      '@typescript-eslint/no-empty-function': 'error',

      // Disallow usage of the any type
      '@typescript-eslint/no-explicit-any': 'error',

      // Allow non-null assertions (obj!)
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Disallow importing from test directories
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: ['**/tests/**'] }],

      // Disallow variable declarations from shadowing variables in the outer scope
      '@typescript-eslint/no-shadow': 'error',

      // Allow unnecessary type parameters
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',

      // Disallow unused expressions which don't affect program state
      '@typescript-eslint/no-unused-expressions': ['error', { allowTaggedTemplates: true }],

      // Disallow unused variables with special handling for underscore prefixed variables
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // Allow references to variables before they are defined for specified types
      '@typescript-eslint/no-use-before-define': [
        'error',
        { classes: false, functions: false, typedefs: false, variables: false },
      ],

      // Disable requiring await in async functions
      '@typescript-eslint/require-await': 'off',

      // Restrict template expressions to safe types
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowNever: true }],

      // Enforce exhaustive switch statements with default case for non-unions
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: true },
      ],

      // Enforce unbound methods are called with their expected scope
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],

      // Enforce using arrow functions with minimal braces
      'arrow-body-style': ['error', 'as-needed'],

      // Require === and !== instead of == and !=
      eqeqeq: 'error',

      // Enforce function expressions over declarations
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],

      // Disable warnings for importing default member that was also imported as a named import
      'import/no-named-as-default-member': 'off',

      // Disable checking module resolution
      'import/no-unresolved': 'off',

      // Disallow await inside loops
      'no-await-in-loop': 'error',

      // Disallow bitwise operators
      'no-bitwise': 'error',

      // Disallow use of console methods
      'no-console': 'error',

      // Disallow continue statements
      'no-continue': 'error',

      // Disallow eval()
      'no-eval': 'error',

      // Disallow new operators with wrapper objects
      'no-new-wrappers': 'error',

      // Restrict usage of specified global variables
      'no-restricted-globals': ['error'],

      // Disallow comparing a variable against itself
      'no-self-compare': 'error',

      // Disallow tabs
      'no-tabs': 'error',

      // Disallow template literal placeholder syntax in regular strings
      'no-template-curly-in-string': 'error',

      // Disallow use of undeclared variables
      'no-undef': 'error',

      // Disallow use of dangling underscores in identifiers except after this
      'no-underscore-dangle': ['error', { allowAfterThis: true }],

      // Enforce organizing exports alphabetically
      'simple-import-sort/exports': 'error',

      // Enforce organized imports with custom grouping
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^@jest/globals\\u0000$', '^@jest/globals$', '^tsup$', '^esbuild$'],
            ['^node:'],
            ['^@\\w', '^\\w'],
            ['^\\.\\u0000$', '^\\.'],
          ],
        },
      ],

      // Disable default sort-imports in favor of simple-import-sort
      'sort-imports': 'off',

      // Require var declarations to be at the top of their scope
      'vars-on-top': 'error',
    },
  },
  {
    name: 'neutral',
    files: ['src/**/*.ts'],
    languageOptions: { globals: { setTimeout: 'readonly' } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'fs', message: 'Use only inside src/node/' },
            { name: 'path', message: 'Use only inside src/node/' },
            { name: 'os', message: 'Use only inside src/node/' },
            { name: 'child_process', message: 'Use only inside src/node/' },
          ],
          patterns: [{ group: ['node:*'], message: 'Use only inside src/node/' }],
        },
      ],
    },
  },
  { name: 'node', files: ['src/*/node/**/*.ts'], rules: { 'no-restricted-imports': 'off' } },
  {
    name: 'tests',
    files: ['tests/**/*'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off', '@typescript-eslint/unbound-method': 'off' },
  },
]);
