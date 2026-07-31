/**
 * Generator docs/uprawnienia.md z seedu macierzy kompetencji (§10.6, §18).
 * Uruchomienie: node scripts/generate-permissions-doc.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync('packages/db/seeds/competences.json', 'utf8'));

const header = `# Macierz kompetencji HARC

> Plik GENEROWANY automatycznie z \`packages/db/seeds/competences.json\` —
> nie edytuj ręcznie. Regeneracja: \`node scripts/generate-permissions-doc.mjs\`.

Zasięg władzy NIE jest funkcją głębokości w drzewie (§10.2). Aliasy statutowe
(NAMIESTNICTWO≡CHORAGIEW, ZWIAZEK_DRUZYN≡HUFIEC) są normalizowane w silniku.

| Akcja | Poziom | Zasięg | Typy docelowe | Pełnoletność | Ochr. małoletnich | Delegowalna | Podstawa prawna |
|---|---|---|---|---|---|---|---|
`;

const rows = seed.entries
  .map(
    (e) =>
      `| \`${e.action}\` | ${e.holderLevel} | ${e.targetScope} | ${e.targetTypes.join(', ') || '—'} | ${e.requiresAdult ? 'tak' : 'nie'} | ${e.requiresMinorProtection ? 'tak' : 'nie'} | ${e.delegable ? 'tak' : 'nie'} | ${e.legalBasis} |`,
  )
  .join('\n');

const todos = seed.entries
  .filter((e) => e.legalBasis.includes('TODO(regulamin)'))
  .map((e) => `- \`${e.action}\` (${e.holderLevel})`)
  .join('\n');

writeFileSync(
  'docs/uprawnienia.md',
  `${header}${rows}\n\n## Otwarte TODO(regulamin)\n\n${todos || '- brak'}\n`,
);
console.log('docs/uprawnienia.md wygenerowany:', seed.entries.length, 'wierszy');
