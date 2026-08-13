import { describe, expect, it } from 'vitest';
import {
  canDelegate,
  canManageAdminGrant,
  type GrantActor,
  type GrantTarget,
} from './admin-grants.js';

function grantActor(partial: Partial<GrantActor> = {}): GrantActor {
  return {
    personId: 'actor-1',
    isRoot: false,
    isSysadmin: false,
    unitAdminOf: [],
    ...partial,
  };
}

function target(partial: Partial<GrantTarget> = {}): GrantTarget {
  return {
    role: 'UNIT_ADMIN',
    personId: 'target-1',
    unitId: 'hufiec-1',
    unitAncestorIds: ['choragiew-1', 'org-1'],
    ...partial,
  };
}

describe('canManageAdminGrant (§10.1 — wymuszane w domenie, nie w UI)', () => {
  it('ROOT nadaje SYSADMIN-a', () => {
    const d = canManageAdminGrant(grantActor({ isRoot: true }), target({ role: 'SYSADMIN' }));
    expect(d.allowed).toBe(true);
  });

  it('NEGATYWNY §10.6: sysadmin NIE może odebrać uprawnień innemu sysadminowi', () => {
    const d = canManageAdminGrant(
      grantActor({ isSysadmin: true }),
      target({ role: 'SYSADMIN', personId: 'inny-sysadmin' }),
    );
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.reason).toBe('SYSADMIN_CANNOT_MANAGE_SYSADMIN');
  });

  it('NEGATYWNY: sysadmin NIE może nadać SYSADMIN-a (awans do własnego poziomu)', () => {
    const d = canManageAdminGrant(
      grantActor({ isSysadmin: true }),
      target({ role: 'SYSADMIN', personId: 'ktos' }),
    );
    expect(d.allowed).toBe(false);
  });

  it('NEGATYWNY §10.1: sysadmin NIE może zmienić własnych uprawnień', () => {
    const d = canManageAdminGrant(
      grantActor({ personId: 'ja', isSysadmin: true }),
      target({ role: 'UNIT_ADMIN', personId: 'ja' }),
    );
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.reason).toBe('CANNOT_MANAGE_OWN_GRANTS');
  });

  it('ROOT może zmienić uprawnienia samemu sobie', () => {
    const d = canManageAdminGrant(
      grantActor({ personId: 'ja', isRoot: true }),
      target({ personId: 'ja' }),
    );
    expect(d.allowed).toBe(true);
  });

  it('sysadmin nadaje UNIT_ADMIN-a w dowolnej jednostce', () => {
    expect(canManageAdminGrant(grantActor({ isSysadmin: true }), target()).allowed).toBe(true);
  });

  it('UNIT_ADMIN nadaje uprawnienia we własnej jednostce', () => {
    const d = canManageAdminGrant(grantActor({ unitAdminOf: ['hufiec-1'] }), target());
    expect(d.allowed).toBe(true);
  });

  it('UNIT_ADMIN nadaje uprawnienia w jednostce podległej', () => {
    const d = canManageAdminGrant(
      grantActor({ unitAdminOf: ['choragiew-1'] }),
      target({ unitId: 'hufiec-1', unitAncestorIds: ['choragiew-1', 'org-1'] }),
    );
    expect(d.allowed).toBe(true);
  });

  it('NEGATYWNY: UNIT_ADMIN nie sięga poza własne poddrzewo', () => {
    const d = canManageAdminGrant(
      grantActor({ unitAdminOf: ['hufiec-1'] }),
      target({ unitId: 'obcy-hufiec', unitAncestorIds: ['inna-choragiew'] }),
    );
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.reason).toBe('OUTSIDE_ADMIN_SCOPE');
  });

  it('NEGATYWNY: osoba bez uprawnień administracyjnych nie nadaje niczego', () => {
    const d = canManageAdminGrant(grantActor(), target());
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.reason).toBe('NO_ADMIN_AUTHORITY');
  });

  it('UNIT_ADMIN bez wskazanej jednostki jest odrzucany', () => {
    const d = canManageAdminGrant(
      grantActor({ isSysadmin: true }),
      target({ role: 'UNIT_ADMIN', unitId: null }),
    );
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.reason).toBe('UNIT_REQUIRED_FOR_UNIT_ADMIN');
  });
});

describe('canDelegate (§10.4 — tylko własne i tylko delegowalne)', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const future = new Date('2026-06-01T00:00:00Z');

  it('przechodzi dla akcji delegowalnej, posiadanej, z terminem', () => {
    expect(
      canDelegate(
        {
          action: 'APPROVE_WORK_PLAN',
          isDelegable: true,
          delegatorHasCompetence: true,
          delegatorCompetenceVia: 'COMPETENCE',
          expiresAt: future,
        },
        now,
      ).allowed,
    ).toBe(true);
  });

  it('NEGATYWNY: akcja nieoznaczona jako delegowalna', () => {
    const d = canDelegate(
      {
        action: 'FOUND_UNIT',
        isDelegable: false,
        delegatorHasCompetence: true,
        delegatorCompetenceVia: 'COMPETENCE',
        expiresAt: future,
      },
      now,
    );
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.reason).toBe('ACTION_NOT_DELEGABLE');
  });

  it('NEGATYWNY: zakaz subdelegacji — kto ma z delegacji, nie przekazuje dalej', () => {
    const d = canDelegate(
      {
        action: 'APPROVE_WORK_PLAN',
        isDelegable: true,
        delegatorHasCompetence: true,
        delegatorCompetenceVia: 'DELEGATION',
        expiresAt: future,
      },
      now,
    );
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.reason).toBe('SUBDELEGATION_NOT_ALLOWED');
  });

  it('władza z podstawienia (§10.3) nadaje się do delegowania', () => {
    expect(
      canDelegate(
        {
          action: 'APPROVE_WORK_PLAN',
          isDelegable: true,
          delegatorHasCompetence: true,
          delegatorCompetenceVia: 'SUBSTITUTION',
          expiresAt: future,
        },
        now,
      ).allowed,
    ).toBe(true);
  });

  it('NEGATYWNY: nie można delegować kompetencji, której się nie ma', () => {
    const d = canDelegate(
      {
        action: 'APPROVE_WORK_PLAN',
        isDelegable: true,
        delegatorHasCompetence: false,
        delegatorCompetenceVia: null,
        expiresAt: future,
      },
      now,
    );
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.reason).toBe('DELEGATOR_LACKS_COMPETENCE');
  });

  it('NEGATYWNY: delegacja bezterminowa i wsteczna', () => {
    const bez = canDelegate(
      {
        action: 'APPROVE_WORK_PLAN',
        isDelegable: true,
        delegatorHasCompetence: true,
        delegatorCompetenceVia: 'COMPETENCE',
        expiresAt: null,
      },
      now,
    );
    expect(bez.allowed === false && bez.reason).toBe('EXPIRY_REQUIRED');

    const wstecz = canDelegate(
      {
        action: 'APPROVE_WORK_PLAN',
        isDelegable: true,
        delegatorHasCompetence: true,
        delegatorCompetenceVia: 'COMPETENCE',
        expiresAt: new Date('2025-01-01T00:00:00Z'),
      },
      now,
    );
    expect(wstecz.allowed === false && wstecz.reason).toBe('EXPIRY_IN_PAST');
  });
});
