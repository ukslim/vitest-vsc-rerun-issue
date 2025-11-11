import { defineConfig, globalIgnores } from 'eslint/config';
import parser from 'jsonc-eslint-parser';
import nxconfig from '../../../eslint.config.mjs';

export default defineConfig([
  globalIgnores(['!**/*']),
  {
    extends: [nxconfig],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    files: ['**/*.json'],

    languageOptions: {
      parser: parser,
    },
  },
]);
