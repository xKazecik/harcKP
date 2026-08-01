/**
 * Metadane dokumentów i lokalizacja katalogu `docs/`.
 *
 * Katalogu szukamy wśród kandydatów, bo `process.cwd()` różni się między
 * trybami: w dev jest to katalog aplikacji, a serwer standalone Next.js
 * uruchamia workera z `cwd = /app/apps/web`, podczas gdy `docs/` leży w `/app`.
 * Sztywne `join(process.cwd(), 'docs')` działa więc tylko w jednym z nich.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Pierwszy istniejący katalog z dokumentacją albo ścieżka domyślna. */
function resolveDocsDir(): string {
  const cwd = process.cwd();
  const candidates = [
    process.env.DOCS_DIR,
    join(cwd, 'docs'),
    resolve(cwd, '..', '..', 'docs'),
    '/app/docs',
  ].filter((p): p is string => Boolean(p));

  return candidates.find((p) => existsSync(p)) ?? join(cwd, 'docs');
}

export const DOCS_DIR = resolveDocsDir();

export const DOC_TITLES: Record<string, { title: string; desc: string; icon: string }> = {
  uzytkownik: {
    title: 'Instrukcja użytkownika',
    desc: 'Ścieżki zadaniowe dla drużynowego, harcerza, hufcowego i komendanta chorągwi.',
    icon: '👤',
  },
  administrator: {
    title: 'Administrator',
    desc: 'Wdrożenie, konfiguracja, kopie zapasowe, aktualizacje.',
    icon: '🛠',
  },
  keycloak: {
    title: 'Keycloak',
    desc: 'Pełna konfiguracja realmu, klientów, scope’ów i ról konta serwisowego — krok po kroku.',
    icon: '🔑',
  },
  api: { title: 'API', desc: 'Opis endpointów i kontraktów.', icon: '🔌' },
  uprawnienia: {
    title: 'Macierz uprawnień',
    desc: 'Generowana ze słownika kompetencji, z kolumną podstawy prawnej.',
    icon: '🔐',
  },
  'cykl-zycia-konta': {
    title: 'Cykl życia konta',
    desc: 'Zaproszenie, archiwizacja, przywrócenie i ponowne użycie adresu e-mail.',
    icon: '🔄',
  },
  'model-danych': { title: 'Model danych', desc: 'Diagram encji i opis modeli.', icon: '🗃' },
  integracje: {
    title: 'Integracje',
    desc: 'Google Drive i Calendar, S3, konfiguracja i uprawnienia.',
    icon: '🔗',
  },
  eksport: {
    title: 'Eksport danych',
    desc: 'Formaty, filtrowanie hierarchiczne i zasady RODO.',
    icon: '📤',
  },
  regulaminy: {
    title: 'Reguły a przepisy',
    desc: 'Mapowanie reguły w kodzie na przepis ZHR wraz z listą otwartych pytań do GK.',
    icon: '⚖',
  },
};
