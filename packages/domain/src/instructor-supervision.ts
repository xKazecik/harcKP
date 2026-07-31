/**
 * Oś zwierzchnictwa instruktorskiego (§7.3) — NIE pokrywa się z hierarchią
 * jednostek (§21).
 */
import type { UnitType } from './unit-level.js';
import { normalizeUnitLevel } from './unit-level.js';

export type InstructorRank = 'PRZEWODNIK' | 'PODHARCMISTRZ' | 'HARCMISTRZ';

export type SupervisorRef =
  | { kind: 'CHORAGIEW_COMMANDER'; choragiewId: string }
  | { kind: 'NACZELNIK' };

/**
 * Zwierzchnik instruktora (§7.3):
 * PRZEWODNIK/PODHARCMISTRZ → komendant(ka) chorągwi przynależności;
 * HARCMISTRZ → Naczelnik/Naczelniczka.
 */
export function getSupervisor(rank: InstructorRank, homeChoragiewId: string): SupervisorRef {
  return rank === 'HARCMISTRZ'
    ? { kind: 'NACZELNIK' }
    : { kind: 'CHORAGIEW_COMMANDER', choragiewId: homeChoragiewId };
}

export type SuperiorRef =
  | { kind: 'UNIT_LEADER'; unitId: string }
  | { kind: 'PARENT_UNIT_LEADER'; parentUnitId: string };

/**
 * Przełożony z przydziału służbowego (§7.3):
 * drużynowy → hufcowy; członek komendy hufca → hufcowy; członek komendy
 * chorągwi → komendant chorągwi; szczepowy → hufcowy (§1.3).
 *
 * @param assignmentUnitType - typ jednostki przydziału
 * @param assignmentUnitId - jednostka przydziału
 * @param parentUnitId - rodzic jednostki przydziału (dla funkcji liniowych)
 * @param isUnitLeader - czy instruktor sam prowadzi jednostkę przydziału
 * @remarks TODO(regulamin): szczepowy → hufcowy to uproszczenie wynikające
 * z zakresu (pion terenowy poza systemem).
 */
export function getDirectSuperior(args: {
  assignmentUnitType: UnitType;
  assignmentUnitId: string;
  parentUnitId: string | null;
  isUnitLeader: boolean;
}): SuperiorRef | null {
  const level = normalizeUnitLevel(args.assignmentUnitType);
  if (args.isUnitLeader || level === 'SZCZEP') {
    // Prowadzący jednostkę (i szczepowy) podlega komendantowi jednostki nadrzędnej.
    return args.parentUnitId ? { kind: 'PARENT_UNIT_LEADER', parentUnitId: args.parentUnitId } : null;
  }
  // Funkcyjny w komendzie podlega komendantowi własnej jednostki przydziału.
  return { kind: 'UNIT_LEADER', unitId: args.assignmentUnitId };
}

/**
 * Blokada mianowania na funkcję wychowawczą (§7.3): wymaga ważnej weryfikacji
 * ochrony małoletnich ORAZ potwierdzenia standardów.
 *
 * @returns kod błędu 422 albo null gdy mianowanie dopuszczalne
 */
export function checkAppointmentEligibility(args: {
  minorProtectionValidUntil: Date | null;
  standardsAcknowledgedAt: Date | null;
  now: Date;
}): 'MINOR_PROTECTION_NOT_VERIFIED' | null {
  const valid =
    args.minorProtectionValidUntil !== null &&
    args.minorProtectionValidUntil > args.now &&
    args.standardsAcknowledgedAt !== null;
  return valid ? null : 'MINOR_PROTECTION_NOT_VERIFIED';
}
