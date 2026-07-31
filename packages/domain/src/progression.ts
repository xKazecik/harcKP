/**
 * Progresja (§12) — wspólny UX, różne domknięcia formalne per organizacja.
 * Nazwy stopni/wymagań pochodzą ze słowników (§2), nigdy z kodu.
 */
import type { Branch } from './unit-display-name.js';

export type ProgressionStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'CLOSED_POSITIVE'
  | 'CLOSED_NEGATIVE'
  | 'DISCONTINUED'
  | 'AWARDED'
  | 'ABANDONED';

export type ProgressionKind = 'RANK' | 'BADGE' | 'ZUCH_STAR' | 'INSTRUCTOR_RANK';

/**
 * Dozwolone przejścia stanów karty (§12.1):
 * - OH-ek (HARCERKI, RANK): próba jawnie otwierana/zamykana rozkazem,
 *   z umorzeniem (DISCONTINUED) i limitem czasu;
 * - OH-y (HARCERZE, RANK): karta jest narzędziem pracy — liczy się AWARDED
 *   rozkazem; brak formalnego zamknięcia negatywnego i umorzenia;
 * - sprawności (BADGE): zamknięcie negatywne z karencją, przedłużanie;
 * - stopnie instruktorskie: otwarcie i przyznanie rozkazem, umorzenie komisją.
 */
export function allowedTransitions(
  kind: ProgressionKind,
  branch: Branch,
  from: ProgressionStatus,
): readonly ProgressionStatus[] {
  if (from === 'ABANDONED' || from === 'AWARDED') return [];
  const anyToAbandoned: ProgressionStatus[] = ['ABANDONED']; // archiwizacja osoby (§8.3)

  if (kind === 'RANK' && branch === 'HARCERKI') {
    const map: Partial<Record<ProgressionStatus, ProgressionStatus[]>> = {
      DRAFT: ['OPEN'],
      OPEN: ['CLOSED_POSITIVE', 'CLOSED_NEGATIVE', 'DISCONTINUED'],
      CLOSED_POSITIVE: ['AWARDED'],
    };
    return [...(map[from] ?? []), ...anyToAbandoned];
  }
  if (kind === 'RANK' && branch === 'HARCERZE') {
    const map: Partial<Record<ProgressionStatus, ProgressionStatus[]>> = {
      DRAFT: ['OPEN'],
      OPEN: ['AWARDED'],
    };
    return [...(map[from] ?? []), ...anyToAbandoned];
  }
  if (kind === 'BADGE' || kind === 'ZUCH_STAR') {
    const map: Partial<Record<ProgressionStatus, ProgressionStatus[]>> = {
      DRAFT: ['OPEN'],
      OPEN: ['CLOSED_POSITIVE', 'CLOSED_NEGATIVE'],
      CLOSED_POSITIVE: ['AWARDED'],
    };
    return [...(map[from] ?? []), ...anyToAbandoned];
  }
  // INSTRUCTOR_RANK (§12.4)
  const map: Partial<Record<ProgressionStatus, ProgressionStatus[]>> = {
    DRAFT: ['OPEN'], // otwarcie próby rozkazem po rozpatrzeniu przez komisję
    OPEN: ['CLOSED_POSITIVE', 'DISCONTINUED'],
    CLOSED_POSITIVE: ['AWARDED'], // przyznanie rozkazem wg kompetencji ze słownika
  };
  return [...(map[from] ?? []), ...anyToAbandoned];
}

export function canTransitionProgression(
  kind: ProgressionKind,
  branch: Branch,
  from: ProgressionStatus,
  to: ProgressionStatus,
): boolean {
  return allowedTransitions(kind, branch, from).includes(to);
}

/** Które przejścia wymagają pozycji w rozkazie (§12.1)? */
export function transitionRequiresOrderItem(
  kind: ProgressionKind,
  branch: Branch,
  to: ProgressionStatus,
): boolean {
  if (to === 'AWARDED') return true; // przyznanie zawsze rozkazem
  if (kind === 'RANK' && branch === 'HARCERKI') {
    return to === 'OPEN' || to === 'CLOSED_POSITIVE' || to === 'CLOSED_NEGATIVE' || to === 'DISCONTINUED';
  }
  if (kind === 'INSTRUCTOR_RANK') return to === 'OPEN' || to === 'CLOSED_POSITIVE';
  return false;
}

/**
 * Walidacja kapituły (§12.2): min. 3 osoby, w tym instruktor; kapituła HR —
 * przewodniczący co najmniej podharcmistrz.
 */
export function validateChapter(args: {
  kind: string;
  members: Array<{ isChair: boolean; isInstructor: boolean; instructorRankOrder: number | null }>;
}): 'CHAPTER_TOO_SMALL' | 'CHAPTER_NO_INSTRUCTOR' | 'CHAPTER_CHAIR_RANK_TOO_LOW' | null {
  if (args.members.length < 3) return 'CHAPTER_TOO_SMALL';
  if (!args.members.some((m) => m.isInstructor)) return 'CHAPTER_NO_INSTRUCTOR';
  if (args.kind === 'HR') {
    const chair = args.members.find((m) => m.isChair);
    if (!chair || (chair.instructorRankOrder ?? 0) < 2) return 'CHAPTER_CHAIR_RANK_TOO_LOW';
  }
  return null;
}

/**
 * Walidacja wieku dla stopnia (§12.2): przedział ze słownika; ćwik — próba
 * końcowa dopiero po 14. urodzinach (finalTrialMinAgeYears w payload).
 */
export function checkRankAge(args: {
  age: number;
  ageMin: number | null;
  ageMax: number | null;
}): 'AGE_BELOW_RANGE' | 'AGE_ABOVE_RANGE' | null {
  if (args.ageMin !== null && args.age < args.ageMin) return 'AGE_BELOW_RANGE';
  if (args.ageMax !== null && args.age > args.ageMax) return 'AGE_ABOVE_RANGE';
  return null;
}
