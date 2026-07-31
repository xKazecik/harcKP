import { describe, expect, it } from 'vitest';
import {
  appealDeadline,
  canTransition,
  expungementDate,
  isPenaltyEnforceable,
} from './disciplinary.js';
import {
  canTransitionProgression,
  transitionRequiresOrderItem,
  validateChapter,
} from './progression.js';

describe('DisciplinaryCase (§11.3)', () => {
  it('rozkaz karzący wymaga wcześniejszego wezwania do wyjaśnień', () => {
    expect(canTransition('INITIATED', 'PENALTY_ISSUED')).toBe(false);
    expect(canTransition('INITIATED', 'EXPLANATION_REQUESTED')).toBe(true);
    expect(canTransition('EXPLANATION_REQUESTED', 'PENALTY_ISSUED')).toBe(true);
  });

  it('w czasie apelacji kara NIE podlega wykonaniu', () => {
    expect(isPenaltyEnforceable('APPEAL_FILED')).toBe(false);
    expect(isPenaltyEnforceable('PENALTY_ISSUED')).toBe(false);
    expect(isPenaltyEnforceable('FINAL')).toBe(true);
  });

  it('zatarcie: rok od prawomocności; zakaz funkcji — rok od końca zakazu', () => {
    const finalAt = new Date('2026-03-01');
    expect(expungementDate(finalAt, null)).toEqual(new Date('2027-03-01'));
    expect(expungementDate(finalAt, new Date('2026-09-01'))).toEqual(new Date('2027-09-01'));
  });

  it('termin apelacji: 1 miesiąc', () => {
    expect(appealDeadline(new Date('2026-01-15'))).toEqual(new Date('2026-02-15'));
  });
});

describe('Progresja (§12.1 — różne domknięcia, wspólny UX)', () => {
  it('OH-ek: próba otwierana i zamykana z umorzeniem', () => {
    expect(canTransitionProgression('RANK', 'HARCERKI', 'OPEN', 'DISCONTINUED')).toBe(true);
    expect(canTransitionProgression('RANK', 'HARCERKI', 'OPEN', 'CLOSED_NEGATIVE')).toBe(true);
  });

  it('OH-y: bez umorzenia i zamknięcia negatywnego — liczy się przyznanie rozkazem', () => {
    expect(canTransitionProgression('RANK', 'HARCERZE', 'OPEN', 'DISCONTINUED')).toBe(false);
    expect(canTransitionProgression('RANK', 'HARCERZE', 'OPEN', 'CLOSED_NEGATIVE')).toBe(false);
    expect(canTransitionProgression('RANK', 'HARCERZE', 'OPEN', 'AWARDED')).toBe(true);
  });

  it('AWARDED zawsze wymaga pozycji w rozkazie; OH-ek także otwarcie/zamknięcie', () => {
    expect(transitionRequiresOrderItem('RANK', 'HARCERZE', 'AWARDED')).toBe(true);
    expect(transitionRequiresOrderItem('RANK', 'HARCERKI', 'OPEN')).toBe(true);
    expect(transitionRequiresOrderItem('RANK', 'HARCERZE', 'OPEN')).toBe(false);
    expect(transitionRequiresOrderItem('BADGE', 'HARCERZE', 'OPEN')).toBe(false);
  });

  it('archiwizacja osoby → ABANDONED z każdego stanu aktywnego (§8.3)', () => {
    expect(canTransitionProgression('RANK', 'HARCERZE', 'OPEN', 'ABANDONED')).toBe(true);
    expect(canTransitionProgression('BADGE', 'HARCERKI', 'DRAFT', 'ABANDONED')).toBe(true);
    expect(canTransitionProgression('RANK', 'HARCERZE', 'AWARDED', 'ABANDONED')).toBe(false);
  });

  it('kapituła: min. 3 osoby, instruktor, HR — przewodniczący ≥ phm', () => {
    const instruktor = { isChair: false, isInstructor: true, instructorRankOrder: 1 };
    const hr = { isChair: false, isInstructor: false, instructorRankOrder: null };
    expect(validateChapter({ kind: 'HO', members: [instruktor, hr] })).toBe('CHAPTER_TOO_SMALL');
    expect(validateChapter({ kind: 'HO', members: [hr, hr, hr] })).toBe('CHAPTER_NO_INSTRUCTOR');
    expect(
      validateChapter({
        kind: 'HR',
        members: [{ isChair: true, isInstructor: true, instructorRankOrder: 1 }, instruktor, hr],
      }),
    ).toBe('CHAPTER_CHAIR_RANK_TOO_LOW');
    expect(
      validateChapter({
        kind: 'HR',
        members: [{ isChair: true, isInstructor: true, instructorRankOrder: 2 }, instruktor, hr],
      }),
    ).toBeNull();
  });
});
