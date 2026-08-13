// @ts-check
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import base from '../../eslint.config.mjs';

/**
 * ESLint dla apps/web: reguły Next.js + wspólna konfiguracja monorepo
 * (@see ../../eslint.config.mjs).
 *
 * `next lint` jest wycofywane w Next.js 16, dlatego pakiet uruchamia CLI ESLinta
 * bezpośrednio. `eslint-config-next` wciąż jest wydawany w formacie eslintrc,
 * stąd most `FlatCompat`.
 *
 * Kolejność jest istotna: `eslint-config-next` narzuca własny parser dla plików
 * TypeScript, a ten nie przekazuje `parserServices` do reguł typowanych
 * (m.in. `consistent-type-imports`). Dlatego po konfiguracji Next.js parser jest
 * przywracany na `@typescript-eslint/parser`.
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', 'next-env.d.ts', 'tsconfig.tsbuildinfo'] },
  ...compat.extends('next/core-web-vitals'),
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
  },
];

export default config;
