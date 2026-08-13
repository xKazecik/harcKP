/**
 * Typy jednostek pionu wychowawczego — kopia domenowa (pakiet domain ma ZERO
 * zależności zewnętrznych, więc nie importuje enuma Prisma; zgodność typów
 * pilnowana testem kontraktowym w @harc/contracts).
 */
export type UnitType =
  | 'ORGANIZACJA'
  | 'CHORAGIEW'
  | 'NAMIESTNICTWO'
  | 'HUFIEC'
  | 'ZWIAZEK_DRUZYN'
  | 'GROMADA'
  | 'DRUZYNA'
  | 'DRUZYNA_WEDROWNICZA'
  | 'SAMODZIELNY_ZASTEP'
  | 'SZCZEP'
  | 'KRAG_HARCERSTWA_STARSZEGO'
  | 'KRAG_INSTRUKTORSKI';

/** Poziom znormalizowany — bez aliasów statutowych. */
export type NormalizedUnitLevel = Exclude<UnitType, 'NAMIESTNICTWO' | 'ZWIAZEK_DRUZYN'>;

/**
 * Normalizuje aliasy statutowe do poziomu bazowego (§6.1).
 *
 * @param type - typ jednostki, w tym aliasy statutowe
 * @returns poziom znormalizowany: NAMIESTNICTWO → CHORAGIEW, ZWIAZEK_DRUZYN → HUFIEC
 * @remarks Statut ZHR: namiestnictwo jest chorągwią, związek drużyn jest hufcem.
 * CAŁY silnik uprawnień używa wyłącznie tej funkcji — nigdy duplikowanych
 * warunków na aliasy (twarda reguła §6.1).
 */
export function normalizeUnitLevel(type: UnitType): NormalizedUnitLevel {
  switch (type) {
    case 'NAMIESTNICTWO':
      return 'CHORAGIEW';
    case 'ZWIAZEK_DRUZYN':
      return 'HUFIEC';
    default:
      return type;
  }
}

/**
 * Typy jednostek, których komendant ma kompetencje poziomu drużynowego (§6.3).
 *
 * @remarks Gromada, drużyna wędrownicza i samodzielny zastęp są prowadzone przez
 * funkcyjnego o kompetencjach drużynowego. Macierz kompetencji nie powiela dla
 * nich wierszy — zamiast tego poziom posiadacza jest sprowadzany do `DRUZYNA`.
 * Samodzielny zastęp ma dodatkowo twarde wyłączenia (patrz `authorization.ts`).
 */
const DRUZYNA_LEVEL_TYPES = ['GROMADA', 'DRUZYNA_WEDROWNICZA', 'SAMODZIELNY_ZASTEP'] as const;

/**
 * Normalizuje typ jednostki do poziomu POSIADACZA kompetencji (§6.3, §10.2).
 *
 * @param type - typ jednostki, którą kieruje aktor
 * @returns poziom używany do dopasowania `holderLevel` w macierzy kompetencji
 * @remarks Różni się od {@link normalizeUnitLevel} celowo i tej różnicy NIE wolno
 * znieść. Ta funkcja odpowiada na pytanie „jakiego poziomu kompetencje ma
 * komendant tej jednostki", więc sprowadza gromadę, drużynę wędrowniczą
 * i samodzielny zastęp do `DRUZYNA`. `normalizeUnitLevel` odpowiada na pytanie
 * „czym jest ta jednostka jako CEL akcji" i zachowuje typy rozłącznie.
 *
 * Gdyby jedna funkcja obsługiwała oba pytania, `SAMODZIELNY_ZASTEP` stałby się
 * prawidłowym celem `ISSUE_ORDER` (którego `targetTypes` obejmuje `DRUZYNA`),
 * co znosi twarde wyłączenie z §6.3.
 */
export function normalizeHolderLevel(type: UnitType): NormalizedUnitLevel {
  if ((DRUZYNA_LEVEL_TYPES as readonly string[]).includes(type)) return 'DRUZYNA';
  return normalizeUnitLevel(type);
}
