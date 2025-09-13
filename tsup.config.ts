import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'tsup';

const generateCjsProxyExports = (
  baseDir: string,
  entries: { readonly [importPath: string]: string },
): Promise<void> => {
  for (const entryName of Object.keys(entries)) {
    const importPath = entryName;
    const namespace = entries[entryName];

    const file = path.join(baseDir, `${importPath}/index.cjs`);
    fs.writeFileSync(file, `module.exports = require('../index.cjs').${namespace};\n`, 'utf8');
  }

  return Promise.resolve();
};

export default defineConfig([
  {
    outDir: 'dist/esm',
    entry: {
      index: 'src/index.ts',
      'logger/index': 'src/logger/index.ts',
      'notifier/index': 'src/notifier/index.ts',
      'tracker/index': 'src/tracker/index.ts',
      'utils/index': 'src/utils/index.ts',
    },
    platform: 'neutral',
    target: 'es2022',
    format: 'esm',
    bundle: true,
    splitting: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    dts: true,
    tsconfig: 'tsconfig.prod.json',
  },
  {
    outDir: 'dist/esm-node',
    entry: {
      index: 'src/index-node.ts',
      'logger/index': 'src/logger/index-node.ts',
      'notifier/index': 'src/notifier/index.ts',
      'tracker/index': 'src/tracker/index-node.ts',
      'utils/index': 'src/utils/index.ts',
    },
    platform: 'node',
    target: 'node20',
    format: 'esm',
    bundle: true,
    splitting: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    dts: true,
    tsconfig: 'tsconfig.prod.json',
  },
  {
    outDir: 'dist/cjs',
    entry: {
      index: 'src/index.ts',
      'logger/index': 'src/logger/index.ts',
      'notifier/index': 'src/notifier/index.ts',
      'tracker/index': 'src/tracker/index.ts',
      'utils/index': 'src/utils/index.ts',
    },
    platform: 'neutral',
    target: 'es2022',
    format: 'cjs',
    bundle: true,
    splitting: false,
    clean: true,
    sourcemap: true,
    treeshake: true,
    dts: true,
    tsconfig: 'tsconfig.prod.json',
    onSuccess: () =>
      generateCjsProxyExports('dist/cjs', {
        logger: 'logging',
        notifier: 'notifying',
        tracker: 'tracking',
        utils: 'utils',
      }),
  },
  {
    outDir: 'dist/cjs-node',
    entry: {
      index: 'src/index-node.ts',
      'logger/index': 'src/logger/index-node.ts',
      'notifier/index': 'src/notifier/index.ts',
      'tracker/index': 'src/tracker/index-node.ts',
      'utils/index': 'src/utils/index.ts',
    },
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    bundle: true,
    splitting: false,
    clean: true,
    sourcemap: true,
    treeshake: true,
    dts: true,
    tsconfig: 'tsconfig.prod.json',
    onSuccess: () =>
      generateCjsProxyExports('dist/cjs-node', {
        logger: 'logging',
        notifier: 'notifying',
        tracker: 'tracking',
        utils: 'utils',
      }),
  },
]);
