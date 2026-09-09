import { FlatCompat } from '@eslint/eslintrc';

/**
 * Flat config, because `next lint` is on its way out and Next 15 reads this
 * directly. The rule set is Next's own `core-web-vitals` — the same one
 * `create-next-app` scaffolds — plus its TypeScript rules. Nothing bespoke:
 * the point is to have a lint gate at all, not a house style.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'src/types/database.ts',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      // A leading underscore is the project's mark for a parameter that has to
      // exist for a signature but is deliberately unread — a mock that mirrors
      // a real implementation's arguments, a discriminant switched on elsewhere.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
];

export default config;
