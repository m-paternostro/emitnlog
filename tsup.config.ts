import { defineConfig } from 'tsup';

export default defineConfig([
  {
    outDir: 'dist/neutral',
    entry: {
      index: 'src/index.ts',
      'logger/index': 'src/logger/index.ts',
      'logger/environment': 'src/logger/environment-logger.ts',
      'notifier/index': 'src/notifier/index.ts',
      'tracker/index': 'src/tracker/index.ts',
      'utils/index': 'src/utils/index.ts',
    },
    platform: 'neutral',
    target: 'es2022',
    format: ['esm', 'cjs'],
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    dts: true,
    tsconfig: 'tsconfig.prod.json',
  },
  {
    outDir: 'dist/node',
    entry: {
      'logger/node/index': 'src/logger/node/index.ts',
      'logger/environment': 'src/logger/node/environment-logger.ts',
      'tracker/node/index': 'src/tracker/node/index.ts',
    },
    format: ['esm', 'cjs'],
    platform: 'node',
    target: 'node20',
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    dts: true,
    tsconfig: 'tsconfig.prod.json',
  },
]);
