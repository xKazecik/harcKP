import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Aliasy wskazują źródła pakietów workspace, żeby testy jednostkowe use case'ów
 * nie wymagały wcześniejszego builda @harc/domain i @harc/contracts.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
  resolve: {
    alias: {
      '@harc/domain': fileURLToPath(
        new URL('../../packages/domain/src/index.ts', import.meta.url),
      ),
      '@harc/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url),
      ),
    },
  },
});
