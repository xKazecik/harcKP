/**
 * Silnik autoryzacji (§10) — czysta funkcja domenowa.
 *
 * NAJWAŻNIEJSZA REGUŁA SYSTEMU: zasięg władzy NIE jest funkcją odległości
 * w drzewie. Każda akcja ma własny targetScope i targetTypes z macierzy
 * kompetencji (dane słownikowe), wynikające z konkretnego przepisu.
 */
import { normalizeHolderLevel, normalizeUnitLevel, type UnitType } from './unit-level.js';
import type { Branch } from './unit-display-name.js';
import type { InstructorRank } from './instructor-supervision.js';

export type TargetScope = 'OWN_UNIT' | 'DIRECT_CHILDREN' | 'SUBTREE' | 'OWN_BRANCH_ORG';

export interface CompetenceRow {
  action: string;
  holderLevel: UnitType;
  branch?: Branch | null;
  targetScope: TargetScope;
  targetTypes: readonly UnitType[];
  requiresAdult: boolean;
  requiresMinorProtection: boolean;
  minimumInstructorRank?: InstructorRank | null;
  delegable: boolean;
  legalBasis: string;
}

export interface ActorContext {
  personId: string;
  isAdult: boolean;
  minorProtectionValid: boolean;
  instructorRank: InstructorRank | null;
  /** Jednostki, którymi aktor kieruje (funkcja LEADER z rozkazu). */
  ledUnits: Array<{ unitId: string; unitType: UnitType; branch: Branch; isActing: boolean }>;
  /** Aktywne delegacje: akcja + jednostka kontekstu delegującego. */
  delegations: Array<{ action: string; unitId: string }>;
  /** Aktywne granty subsydiarności: targetUnitId, którego kompetencje przejęto. */
  substitutions: Array<{ grantorUnitId: string; targetUnitId: string }>;
  isSysadmin: boolean;
  isRoot: boolean;
}

export interface ResourceContext {
  unitId: string;
  unitType: UnitType;
  branch: Branch;
  /** Ścieżka przodków od rodzica do korzenia. */
  ancestorIds: readonly string[];
  parentId: string | null;
}

export type Decision =
  | { allowed: true; basis: string; via: 'COMPETENCE' | 'DELEGATION' | 'SUBSTITUTION' | 'ADMIN'; pendingApproval?: boolean }
  | { allowed: false; reason: string };

const RANK_ORDER: Record<InstructorRank, number> = {
  PRZEWODNIK: 1,
  PODHARCMISTRZ: 2,
  HARCMISTRZ: 3,
};

/**
 * Twarde wyłączenia akcji ze względu na TYP jednostki, której akcja dotyczy (§6.3).
 *
 * @remarks Samodzielny zastęp jest prowadzony przez zastępowego z uprawnieniami
 * drużynowego, ale nie prowadzi rozkazodawstwa ani kroniki jednostki.
 * `normalizeHolderLevel` sprowadza ten typ do poziomu `DRUZYNA`, więc bez tej
 * listy zastępowy dziedziczyłby także obie te akcje.
 *
 * Wyłączenie jest wiązane z ZASOBEM, nie z aktorem, i z trzech powodów:
 * 1. obowiązuje niezależnie od tego, kto działa — także wobec hufcowego
 *    i posiadacza delegacji, więc §6.3 nie da się obejść nadaniem uprawnienia;
 * 2. nie odbiera nic osobie, która obok samodzielnego zastępu prowadzi zwykłą
 *    drużynę — tam rozkaz nadal wydaje;
 * 3. działa, zanim macierz zostanie odpytana, więc brak wiersza w słowniku nie
 *    zamienia twardego zakazu na `ACTION_UNKNOWN`.
 *
 * Wykluczenie `SAMODZIELNY_ZASTEP` z `targetTypes` wiersza `ISSUE_ORDER`
 * w słowniku zostaje jako druga, niezależna linia obrony.
 */
const HARD_EXCLUDED_BY_RESOURCE_TYPE: Partial<Record<UnitType, readonly string[]>> = {
  SAMODZIELNY_ZASTEP: ['ISSUE_ORDER', 'MAINTAIN_UNIT_LOGBOOK'],
};

function scopeMatches(
  scope: TargetScope,
  holderUnit: { unitId: string },
  resource: ResourceContext,
): boolean {
  switch (scope) {
    case 'OWN_UNIT':
      return resource.unitId === holderUnit.unitId;
    case 'DIRECT_CHILDREN':
      return resource.parentId === holderUnit.unitId;
    case 'SUBTREE':
      return (
        resource.unitId === holderUnit.unitId || resource.ancestorIds.includes(holderUnit.unitId)
      );
    case 'OWN_BRANCH_ORG':
      // Oś zwierzchnika (branch sprawdzany niżej); szczegółowa weryfikacja
      // przynależności instruktora do chorągwi następuje w use case.
      return true;
  }
}

/**
 * Decyzja autoryzacyjna dla (aktor, akcja, zasób).
 *
 * Kolejność (§10.2): twarde wyłączenia per typ jednostki → kompetencja
 * z urzędu/delegacji/subsydiarności → targetScope TEJ akcji → targetTypes →
 * branch → pełnoletność (p.o. → pendingApproval) → ochrona małoletnich →
 * minimalny stopień.
 *
 * @remarks SYSADMIN nie może zarządzać innymi sysadminami ani sobą — ta reguła
 * jest wymuszana dla akcji ADMIN_* w use case'ach; tutaj ADMIN daje dostęp
 * wyłącznie do akcji nie-administracyjnych na jednostkach.
 */
export function authorize(
  actor: ActorContext,
  action: string,
  resource: ResourceContext,
  matrix: readonly CompetenceRow[],
): Decision {
  // Twarde wyłączenie z §6.3 obowiązuje przed wszystkim innym — także wobec
  // ROOT-a i SYSADMIN-a, bo dotyczy tego, czego dana JEDNOSTKA w ogóle nie
  // prowadzi (samodzielny zastęp nie ma rozkazodawstwa ani kroniki).
  if (HARD_EXCLUDED_BY_RESOURCE_TYPE[resource.unitType]?.includes(action)) {
    return { allowed: false, reason: 'HARD_EXCLUDED_FOR_UNIT_TYPE' };
  }

  if (actor.isRoot) return { allowed: true, basis: 'ROOT', via: 'ADMIN' };
  if (actor.isSysadmin) return { allowed: true, basis: 'SYSADMIN', via: 'ADMIN' };

  const rows = matrix.filter((r) => r.action === action);
  if (rows.length === 0) return { allowed: false, reason: 'ACTION_UNKNOWN' };

  for (const row of rows) {
    if (row.branch && row.branch !== resource.branch) continue;

    // 1) kompetencja z urzędu: aktor kieruje jednostką poziomu holderLevel
    for (const led of actor.ledUnits) {
      if (normalizeHolderLevel(led.unitType) !== normalizeHolderLevel(row.holderLevel)) continue;
      if (led.branch !== resource.branch) continue; // separacja gałęzi (§10.5)
      if (!scopeMatches(row.targetScope, led, resource)) continue;
      if (
        row.targetTypes.length > 0 &&
        !row.targetTypes.map(normalizeUnitLevel).includes(normalizeUnitLevel(resource.unitType))
      )
        continue;
      if (
        row.minimumInstructorRank &&
        (!actor.instructorRank ||
          RANK_ORDER[actor.instructorRank] < RANK_ORDER[row.minimumInstructorRank])
      )
        continue;
      if (row.requiresMinorProtection && !actor.minorProtectionValid) {
        return { allowed: false, reason: 'MINOR_PROTECTION_NOT_VERIFIED' };
      }
      if (row.requiresAdult && (!actor.isAdult || led.isActing)) {
        // p.o. (§7.4): akcja czeka na kontrasygnatę opiekuna.
        return {
          allowed: true,
          basis: row.legalBasis,
          via: 'COMPETENCE',
          pendingApproval: true,
        };
      }
      return { allowed: true, basis: row.legalBasis, via: 'COMPETENCE' };
    }

    // 2) subsydiarność (§10.3): jawny grant na jednostkę docelową
    for (const sub of actor.substitutions) {
      if (sub.targetUnitId !== resource.unitId && sub.targetUnitId !== resource.parentId) continue;
      const grantorLeads = actor.ledUnits.some((l) => l.unitId === sub.grantorUnitId);
      if (!grantorLeads) continue;
      return { allowed: true, basis: `${row.legalBasis} (SubstitutionGrant)`, via: 'SUBSTITUTION' };
    }
  }

  // 3) delegacja (§10.4): wyłącznie akcje delegable, w kontekście jednostki
  const delegable = rows.some((r) => r.delegable);
  if (delegable) {
    const match = actor.delegations.find(
      (d) =>
        d.action === action &&
        (d.unitId === resource.unitId || resource.ancestorIds.includes(d.unitId)),
    );
    if (match) {
      const row = rows.find((r) => r.delegable);
      return { allowed: true, basis: `${row?.legalBasis ?? action} (delegacja)`, via: 'DELEGATION' };
    }
  }

  return { allowed: false, reason: 'NO_COMPETENCE' };
}
