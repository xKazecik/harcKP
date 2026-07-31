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
