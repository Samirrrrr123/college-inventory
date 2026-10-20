import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['tests/**/*.mjs'],
    languageOptions: {
      globals: { fetch: 'readonly', process: 'readonly', console: 'readonly' },
    },
  },
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
