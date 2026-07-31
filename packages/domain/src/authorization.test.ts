import { describe, expect, it } from 'vitest';
import { authorize, type ActorContext, type CompetenceRow, type ResourceContext } from './authorization.js';

/** Minimalna macierz testowa odzwierciedlająca §10.2. */
const MATRIX: CompetenceRow[] = [
  {
    action: 'APPOINT_PATROL_LEADER',
    holderLevel: 'DRUZYNA',
    targetScope: 'OWN_UNIT',
    targetTypes: ['DRUZYNA', 'DRUZYNA_WEDROWNICZA'],
    requiresAdult: false,
    requiresMinorProtection: false,
    delegable: false,
    legalBasis: 'Reg. Drużyny — wyłączna kompetencja drużynowego',
  },
  {
    action: 'FOUND_UNIT',
    holderLevel: 'HUFIEC',
    targetScope: 'DIRECT_CHILDREN',
    targetTypes: ['DRUZYNA', 'DRUZYNA_WEDROWNICZA', 'GROMADA', 'SAMODZIELNY_ZASTEP'],
    requiresAdult: true,
    requiresMinorProtection: false,
    delegable: false,
    legalBasis: 'Reg. Hufca',
  },
  {
    action: 'AWARD_INSTRUCTOR_RANK',
    holderLevel: 'CHORAGIEW',
    targetScope: 'OWN_BRANCH_ORG',
    targetTypes: [],
    requiresAdult: true,
    requiresMinorProtection: false,
    delegable: false,
    legalBasis: 'Reg. stopni instruktorskich',
  },
  {
    action: 'APPROVE_WORK_PLAN',
    holderLevel: 'HUFIEC',
    targetScope: 'DIRECT_CHILDREN',
    targetTypes: ['DRUZYNA', 'DRUZYNA_WEDROWNICZA', 'GROMADA'],
    requiresAdult: true,
    requiresMinorProtection: false,
    delegable: true,
    legalBasis: 'Reg. Hufca — zatwierdzanie planów pracy',
  },
];

const druzyna: ResourceContext = {
  unitId: 'druzyna-1',
  unitType: 'DRUZYNA',
  branch: 'HARCERZE',
  parentId: 'hufiec-1',
  ancestorIds: ['hufiec-1', 'choragiew-1', 'org-1'],
};

function actor(partial: Partial<ActorContext>): ActorContext {
  return {
    personId: 'p1',
    isAdult: true,
    minorProtectionValid: true,
    instructorRank: 'PRZEWODNIK',
    ledUnits: [],
    delegations: [],
    substitutions: [],
    isSysadmin: false,
    isRoot: false,
    ...partial,
  };
}

const hufcowy = actor({
  ledUnits: [{ unitId: 'hufiec-1', unitType: 'HUFIEC', branch: 'HARCERZE', isActing: false }],
});
const druzynowy = actor({
  ledUnits: [{ unitId: 'druzyna-1', unitType: 'DRUZYNA', branch: 'HARCERZE', isActing: false }],
});
const komendantChoragwi = actor({
  ledUnits: [{ unitId: 'choragiew-1', unitType: 'CHORAGIEW', branch: 'HARCERZE', isActing: false }],
});

describe('authorize — testy §10.6 (obowiązkowe negatywne)', () => {
  it('drużynowy mianuje zastępowego we własnej drużynie', () => {
    expect(authorize(druzynowy, 'APPOINT_PATROL_LEADER', druzyna, MATRIX).allowed).toBe(true);
  });

  it('NEGATYWNY: hufcowy NIE może mianować zastępowego (wyłączna kompetencja drużynowego)', () => {
    expect(authorize(hufcowy, 'APPOINT_PATROL_LEADER', druzyna, MATRIX).allowed).toBe(false);
  });

  it('hufcowy powołuje drużynę bezpośrednio podległą', () => {
    expect(authorize(hufcowy, 'FOUND_UNIT', druzyna, MATRIX).allowed).toBe(true);
  });

  it('NEGATYWNY: komendant chorągwi NIE może powołać drużyny bez SubstitutionGrant (mimo poddrzewa)', () => {
    expect(authorize(komendantChoragwi, 'FOUND_UNIT', druzyna, MATRIX).allowed).toBe(false);
  });

  it('komendant chorągwi powołuje drużynę Z jawnym SubstitutionGrant (§10.3)', () => {
    const withGrant = actor({
      ledUnits: komendantChoragwi.ledUnits,
      substitutions: [{ grantorUnitId: 'choragiew-1', targetUnitId: 'hufiec-1' }],
    });
    const d = authorize(withGrant, 'FOUND_UNIT', druzyna, MATRIX);
    expect(d.allowed).toBe(true);
    expect(d.allowed && d.via).toBe('SUBSTITUTION');
  });

  it('NEGATYWNY: hufcowy NIE może przyznać stopnia instruktorskiego', () => {
    expect(authorize(hufcowy, 'AWARD_INSTRUCTOR_RANK', druzyna, MATRIX).allowed).toBe(false);
  });

  it('NEGATYWNY: drużynowy NIE może przyznać stopnia instruktorskiego', () => {
    expect(authorize(druzynowy, 'AWARD_INSTRUCTOR_RANK', druzyna, MATRIX).allowed).toBe(false);
  });

  it('alias statutowy: komendant ZWIĄZKU DRUŻYN działa jak hufcowy', () => {
    const komendantZD = actor({
      ledUnits: [
        { unitId: 'hufiec-1', unitType: 'ZWIAZEK_DRUZYN', branch: 'HARCERZE', isActing: false },
      ],
    });
    expect(authorize(komendantZD, 'FOUND_UNIT', druzyna, MATRIX).allowed).toBe(true);
  });

  it('NEGATYWNY: separacja gałęzi — hufcowy harcerzy nie działa na drużynie harcerek', () => {
    const druzynaHarcerek: ResourceContext = { ...druzyna, branch: 'HARCERKI' };
    expect(authorize(hufcowy, 'FOUND_UNIT', druzynaHarcerek, MATRIX).allowed).toBe(false);
  });

  it('p.o. drużynowego: akcja requiresAdult → pendingApproval (kontrasygnata opiekuna, §7.4)', () => {
    const po = actor({
      isAdult: false,
      ledUnits: [{ unitId: 'hufiec-1', unitType: 'HUFIEC', branch: 'HARCERZE', isActing: true }],
    });
    const d = authorize(po, 'FOUND_UNIT', druzyna, MATRIX);
    expect(d.allowed).toBe(true);
    expect(d.allowed && d.pendingApproval).toBe(true);
  });

  it('delegacja: tylko akcje delegable, w kontekście jednostki delegującego (§10.4)', () => {
    const czlonekKomendy = actor({
      delegations: [{ action: 'APPROVE_WORK_PLAN', unitId: 'hufiec-1' }],
    });
    expect(authorize(czlonekKomendy, 'APPROVE_WORK_PLAN', druzyna, MATRIX).allowed).toBe(true);
    // NEGATYWNY: FOUND_UNIT nie jest delegable
    const zlaDelegacja = actor({ delegations: [{ action: 'FOUND_UNIT', unitId: 'hufiec-1' }] });
    expect(authorize(zlaDelegacja, 'FOUND_UNIT', druzyna, MATRIX).allowed).toBe(false);
  });

  it('ROOT i SYSADMIN przechodzą (zarządzanie sysadminami wymuszane osobno)', () => {
    expect(authorize(actor({ isRoot: true }), 'FOUND_UNIT', druzyna, MATRIX).allowed).toBe(true);
    expect(authorize(actor({ isSysadmin: true }), 'FOUND_UNIT', druzyna, MATRIX).allowed).toBe(true);
  });
});
