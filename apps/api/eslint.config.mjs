// @ts-check
import base from '../../eslint.config.mjs';

/**
 * ESLint dla apps/api: wspólna konfiguracja monorepo (@see ../../eslint.config.mjs)
 * z jednym wyłączeniem wymuszonym przez NestJS.
 *
 * `consistent-type-imports` jest tu WYŁĄCZONE i nie wolno go włączać ponownie.
 * NestJS rozwiązuje zależności konstruktora na podstawie metadanych
 * `design:paramtypes`, które TypeScript emituje dzięki `emitDecoratorMetadata`
 * (@see tsconfig.json). Metadane powstają wyłącznie dla importów wartościowych —
 * zamiana `import { PrismaService }` na `import type { PrismaService }` kasuje
 * je bez błędu kompilacji, a aplikacja wywraca się dopiero w czasie startu:
 *
 *   Nest can't resolve dependencies of the PrismaUnitRepository (?).
 *
 * Reguła ma autofix, więc `eslint --fix` po jej włączeniu psuje wstrzykiwanie
 * zależności w całym module naraz. Typy nieużywane w DI i tak są importowane
 * przez `import type` ręcznie.
 */
export default [
  ...base,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
