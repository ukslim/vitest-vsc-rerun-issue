import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitest/config';

export const createVitestConfig = (overrides = {}) =>
  defineConfig({
    plugins: [nxViteTsPaths()],
    test: {
      disableConsoleIntercept: !process.env['CI'],
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
      reporters: ['default', 'junit'],
      coverage: {
        provider: 'v8',
        reporter: ['cobertura'],
        exclude: [
          '*.{js,ts}', // configs in root folder
          '**/*.config.{js,ts}',
          '**/*.d.ts',
          '**/constants.{js,ts}',
          '**/coverage/**',
          '**/open-api/**/*',
          '**/schema.{js,ts}',
          '**/vendor/**',
          'dist/',
          'eslint-local-rules/',
          'node_modules/',
          'packages/*/*/src/index.ts', // barrel files
          'packages/*/*/test/**', // cucumber folders
          'tools/scripts/',
        ],
      },
      ...overrides,
    },
  });
