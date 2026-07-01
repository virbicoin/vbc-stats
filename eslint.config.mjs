import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default tseslint.config(
  {
    ignores: ['node_modules/', 'dist/'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    ...eslintReact.configs['recommended-typescript'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'off',
      'react-hooks/purity': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-case-declarations': 'off',
      // Relax @eslint-react rules for legacy code
      '@eslint-react/set-state-in-effect': 'warn',
      '@eslint-react/static-components': 'off',
      '@eslint-react/unsupported-syntax': 'off',
      '@eslint-react/purity': 'warn',
      '@eslint-react/no-nested-component-definitions': 'off',
      '@eslint-react/no-array-index-key': 'warn',
      '@eslint-react/naming-convention-ref-name': 'warn',
      '@eslint-react/web-api-no-leaked-timeout': 'warn',
      '@eslint-react/no-clone-element': 'warn',
      '@eslint-react/use-state': 'warn',
    },
  },
  eslintConfigPrettier
);
