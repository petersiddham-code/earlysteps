/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // RN/Metro tooling config files are conventionally CommonJS (require/module.exports) —
      // matches Expo's own generated defaults and every real-world Metro/Jest/Babel config.
      files: ['apps/mobile/metro.config.js', 'apps/mobile/jest.config.js'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
  ],
};
