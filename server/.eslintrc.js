module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Basic rules only
    'no-unused-vars': 'warn',
    'no-console': 'off',
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'drizzle/',
    '*.js',
    '*.d.ts',
  ],
};