/**
 * Kary organizacyjne (§11.3) — maszyna stanów i zatarcie.
 * Nagana NIE jest odwrotnością pochwały (§21) — ma własny przepływ.
 */

export type DisciplinaryStatus =
  | 'INITIATED'
  | 'EXPLANATION_REQUESTED'
  | 'SUSPENDED_PENDING'
  | 'PENALTY_ISSUED'
  | 'APPEAL_FILED'
  | 'FINAL'
  | 'EXPIRED'
  | 'ANNULLED';

const TRANSITIONS: Record<DisciplinaryStatus, readonly DisciplinaryStatus[]> = {
  INITIATED: ['EXPLANATION_REQUESTED'],
  EXPLANATION_REQUESTED: ['SUSPENDED_PENDING', 'PENALTY_ISSUED', 'ANNULLED'],
  SUSPENDED_PENDING: ['PENALTY_ISSUED', 'ANNULLED'],
  PENALTY_ISSUED: ['APPEAL_FILED', 'FINAL'],
  APPEAL_FILED: ['FINAL', 'ANNULLED'],
  FINAL: ['EXPIRED', 'ANNULLED'],
  EXPIRED: [],
  ANNULLED: [],
};

/** Czy przejście stanu jest dozwolone? Rozkaz karzący wymaga wcześniejszego
 * wezwania do wyjaśnień (INITIATED → EXPLANATION_REQUESTED → ...). */
export function canTransition(from: DisciplinaryStatus, to: DisciplinaryStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Czy kara podlega wykonaniu? W czasie apelacji — NIE (§11.3).
 */
export function isPenaltyEnforceable(status: DisciplinaryStatus): boolean {
  return status === 'FINAL';
}

/**
 * Data zatarcia (§11.3): rok od prawomocności; przy zakazie pełnienia funkcji —
 * rok od zakończenia zakazu.
 */
export function expungementDate(finalAt: Date, banEndsAt: Date | null): Date {
  const base = banEndsAt && banEndsAt > finalAt ? banEndsAt : finalAt;
  const d = new Date(base);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** Termin apelacji do Sądu Harcerskiego: 1 miesiąc od doręczenia. */
export function appealDeadline(deliveredAt: Date): Date {
  const d = new Date(deliveredAt);
  d.setMonth(d.getMonth() + 1);
  return d;
}
