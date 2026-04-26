import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sharedRules = {
  ...tsPlugin.configs.recommended.rules,
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
};

function typedConfig(files, project) {
  return {
    files,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project,
        tsconfigRootDir: __dirname,
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: sharedRules,
  };
}

export default [
  {
    ignores: [
      'node_modules/**',
      'api/node_modules/**',
      '.expo/**',
      'dist/**',
      'build/**',
      'eslint.config.mjs',
      '.eslintrc.js',
    ],
  },
  typedConfig(['*.{ts,tsx}', 'app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'], './tsconfig.json'),
  typedConfig(['api/src/**/*.ts'], './api/tsconfig.json'),
  prettierConfig,
];
