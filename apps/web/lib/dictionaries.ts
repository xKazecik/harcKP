/**
 * Etykiety ze słowników wersjonowanych (§2).
 *
 * Nazwy stopni, sprawności i gwiazdek zuchowych NIE mogą pochodzić z kodu
 * (§21) — czytamy je ze słowników przez API. Ten moduł scala potrzebne
 * katalogi w jedną mapę `kod → etykieta` na potrzeby list i tabel.
 */
import { apiSafe } from './api';

interface DictEntry {
  id: string;
  code: string;
  labelPl: string;
}

/** Katalogi używane w widokach progresji. */
const PROGRESSION_DICTIONARIES = [
  'ranks_harcerze',
  'ranks_harcerki',
  'badges',
  'zuchy_gwiazdki',
  'instructor_ranks',
] as const;

/**
 * Mapa `kod → etykieta` scalona ze słowników progresji.
 *
 * @returns mapa etykiet; przy braku wpisu wywołujący pokazuje surowy kod
 */
export async function progressionLabels(): Promise<Map<string, string>> {
  const results = await Promise.all(
    PROGRESSION_DICTIONARIES.map((key) => apiSafe<DictEntry[]>(`/directory/dictionary/${key}`, [])),
  );
  const map = new Map<string, string>();
  for (const entries of results) {
    for (const e of entries) map.set(e.code, e.labelPl);
  }
  return map;
}

/** Etykieta kodu albo sam kod, gdy słownik go nie zna. */
export function labelFor(labels: Map<string, string>, code: string | null | undefined): string {
  if (!code) return '—';
  return labels.get(code) ?? code;
}
