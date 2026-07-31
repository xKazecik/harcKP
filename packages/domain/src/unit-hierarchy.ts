import { normalizeUnitLevel, type NormalizedUnitLevel, type UnitType } from './unit-level.js';
import type { Branch } from './unit-display-name.js';

/** Kody naruszeń hierarchii — mapowane na 422 w API. */
export type HierarchyViolation =
  | 'PARENT_REQUIRED'
  | 'PARENT_FORBIDDEN'
  | 'INVALID_PARENT_TYPE'
  | 'BRANCH_MISMATCH';

/**
 * Dozwolone poziomy rodzica per typ jednostki (§6.1), po normalizacji aliasów.
 * `null` = jednostka nie ma rodzica (korzeń).
 *
 * @remarks Aliasy statutowe NIE występują w tej tabeli — walidacja przechodzi
 * przez normalizeUnitLevel(), więc DRUZYNA pod ZWIAZEK_DRUZYN jest poprawna
 * automatycznie, bez duplikowania warunków (twarda reguła §6.1).
 */
const ALLOWED_PARENTS: Record<NormalizedUnitLevel, readonly NormalizedUnitLevel[] | null> = {
  ORGANIZACJA: null,
  CHORAGIEW: ['ORGANIZACJA'],
  HUFIEC: ['CHORAGIEW'],
  GROMADA: ['HUFIEC'],
  DRUZYNA: ['HUFIEC'],
  DRUZYNA_WEDROWNICZA: ['HUFIEC'],
  // Samodzielny zastęp podlega hufcowi (§6.3).
  SAMODZIELNY_ZASTEP: ['HUFIEC'],
  // Szczep: pozioma; przełożonym szczepowego jest hufcowy — patrz §1.3.
  // TODO(regulamin): uproszczenie wynikające z zakresu (pion terenowy poza systemem).
  SZCZEP: ['HUFIEC'],
  // TODO(regulamin): poziom umocowania kręgów do potwierdzenia z GK.
  KRAG_HARCERSTWA_STARSZEGO: ['HUFIEC', 'CHORAGIEW', 'ORGANIZACJA'],
  KRAG_INSTRUKTORSKI: ['HUFIEC', 'CHORAGIEW', 'ORGANIZACJA'],
};

/** Jednostki poziome — grupują inne jednostki zamiast być ich przełożonym. */
export const HORIZONTAL_TYPES: readonly NormalizedUnitLevel[] = [
  'SZCZEP',
  'KRAG_HARCERSTWA_STARSZEGO',
  'KRAG_INSTRUKTORSKI',
];

/**
 * Typy jednostek, które szczep może grupować (§6.1).
 * TODO(regulamin): przynależność gromad do szczepu do potwierdzenia z GK.
 */
const SZCZEP_MEMBER_TYPES: readonly NormalizedUnitLevel[] = [
  'DRUZYNA',
  'DRUZYNA_WEDROWNICZA',
  'GROMADA',
];

export interface ParentValidationInput {
  childType: UnitType;
  childBranch: Branch;
  parentType?: UnitType | null;
  parentBranch?: Branch | null;
}

/**
 * Waliduje umocowanie jednostki w drzewie (§6.1).
 *
 * @param input - typ i gałąź dziecka oraz (opcjonalnie) rodzica
 * @returns kod naruszenia albo `null` gdy hierarchia jest poprawna
 * @remarks Reguły: ORGANIZACJA nie ma rodzica; pozostałe typy muszą mieć
 * rodzica dozwolonego poziomu (po normalizacji aliasów) i tej samej gałęzi.
 * TODO(regulamin): kręgi instruktorskie bywają koedukacyjne — zgodność gałęzi
 * dla kręgów do potwierdzenia z GK; do tego czasu wymagana.
 */
export function validateUnitParent(input: ParentValidationInput): HierarchyViolation | null {
  const childLevel = normalizeUnitLevel(input.childType);
  const allowed = ALLOWED_PARENTS[childLevel];

  if (allowed === null) {
    return input.parentType ? 'PARENT_FORBIDDEN' : null;
  }
  if (!input.parentType || !input.parentBranch) {
    return 'PARENT_REQUIRED';
  }
  const parentLevel = normalizeUnitLevel(input.parentType);
  if (!allowed.includes(parentLevel)) {
    return 'INVALID_PARENT_TYPE';
  }
  if (input.parentBranch !== input.childBranch) {
    return 'BRANCH_MISMATCH';
  }
  return null;
}

/**
 * Czy jednostka pozioma `groupType` może grupować jednostkę `memberType` (§6.1)?
 *
 * @remarks Grupowanie ≠ podległość: drużyna w szczepie nadal podlega hufcowi.
 */
export function canGroupUnit(groupType: UnitType, memberType: UnitType): boolean {
  const group = normalizeUnitLevel(groupType);
  const member = normalizeUnitLevel(memberType);
  if (group === 'SZCZEP') return SZCZEP_MEMBER_TYPES.includes(member);
  // Kręgi grupują osoby, nie jednostki.
  return false;
}
