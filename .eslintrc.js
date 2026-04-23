module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react-native/all',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
  },
  env: {
    'react-native/react-native': true,
  },
  ignorePatterns: ['node_modules/', '.expo/', 'dist/', '*.config.js', '.eslintrc.js'],
};
