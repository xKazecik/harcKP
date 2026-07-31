/**
 * @harc/domain — reguły domenowe HARC.
 *
 * @remarks Pakiet ma ZERO zależności zewnętrznych (§3). Reguły organizacyjne
 * ZHR nie są tu zakodowane na sztywno — pakiet dostarcza czyste funkcje
 * operujące na danych słownikowych (§2).
 */
export { normalizeUnitLevel } from './unit-level.js';
export type { UnitType, NormalizedUnitLevel } from './unit-level.js';
export { unitDisplayName } from './unit-display-name.js';
export type { Branch, UnitNameParts } from './unit-display-name.js';
export { validateUnitParent, canGroupUnit, HORIZONTAL_TYPES } from './unit-hierarchy.js';
export type { HierarchyViolation, ParentValidationInput } from './unit-hierarchy.js';
export { ageAt, guardianConsentStatus } from './guardian-consent.js';
export type { ConsentStatus, GuardianSnapshot } from './guardian-consent.js';
export {
  getSupervisor,
  getDirectSuperior,
  checkAppointmentEligibility,
} from './instructor-supervision.js';
export type { InstructorRank, SupervisorRef, SuperiorRef } from './instructor-supervision.js';
export { authorize } from './authorization.js';
export type {
  ActorContext,
  ResourceContext,
  CompetenceRow,
  Decision,
  TargetScope,
} from './authorization.js';
export {
  canTransition,
  isPenaltyEnforceable,
  expungementDate,
  appealDeadline,
} from './disciplinary.js';
export type { DisciplinaryStatus } from './disciplinary.js';
export {
  allowedTransitions,
  canTransitionProgression,
  transitionRequiresOrderItem,
  validateChapter,
  checkRankAge,
} from './progression.js';
export type { ProgressionStatus, ProgressionKind } from './progression.js';
