import pluginJs from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import securityPlugin from 'eslint-plugin-security';
import unicornPlugin from 'eslint-plugin-unicorn';
import globals from 'globals';
import tsPlugin from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  securityPlugin.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsPlugin.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier,
      unicorn: unicornPlugin,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs.stylistic.rules,
      'prettier/prettier': ['error', { "endOfLine": "auto" }],
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prevent-abbreviations': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off', // Often too verbose

      // Not concerned about some security things since users run this themselves
      // TODO(cretz): Should we review to confirm malicious YAML doesn't do bad things?
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',

      // TODO(cretz): Why does TS one not work?
      'no-unused-vars': 'off'
      // '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'bun.lockb', '*.config.js'],
  },
];