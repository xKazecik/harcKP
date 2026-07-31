import { describe, expect, it } from 'vitest';
import {
  checkAppointmentEligibility,
  getDirectSuperior,
  getSupervisor,
} from './instructor-supervision.js';

const NOW = new Date('2026-07-31');

describe('getSupervisor (§7.3 — zwierzchnik ≠ przełożony)', () => {
  it('przewodnik i podharcmistrz → komendant chorągwi przynależności', () => {
    expect(getSupervisor('PRZEWODNIK', 'ch-1')).toEqual({
      kind: 'CHORAGIEW_COMMANDER',
      choragiewId: 'ch-1',
    });
    expect(getSupervisor('PODHARCMISTRZ', 'ch-1')).toEqual({
      kind: 'CHORAGIEW_COMMANDER',
      choragiewId: 'ch-1',
    });
  });

  it('harcmistrz → Naczelnik', () => {
    expect(getSupervisor('HARCMISTRZ', 'ch-1')).toEqual({ kind: 'NACZELNIK' });
  });
});

describe('getDirectSuperior (§7.3, §1.3)', () => {
  it('drużynowy → hufcowy (komendant jednostki nadrzędnej)', () => {
    expect(
      getDirectSuperior({
        assignmentUnitType: 'DRUZYNA',
        assignmentUnitId: 'd-1',
        parentUnitId: 'h-1',
        isUnitLeader: true,
      }),
    ).toEqual({ kind: 'PARENT_UNIT_LEADER', parentUnitId: 'h-1' });
  });

  it('członek komendy hufca → hufcowy (komendant własnej jednostki)', () => {
    expect(
      getDirectSuperior({
        assignmentUnitType: 'HUFIEC',
        assignmentUnitId: 'h-1',
        parentUnitId: 'ch-1',
        isUnitLeader: false,
      }),
    ).toEqual({ kind: 'UNIT_LEADER', unitId: 'h-1' });
  });

  it('szczepowy → hufcowy (uproszczenie §1.3)', () => {
    expect(
      getDirectSuperior({
        assignmentUnitType: 'SZCZEP',
        assignmentUnitId: 's-1',
        parentUnitId: 'h-1',
        isUnitLeader: false,
      }),
    ).toEqual({ kind: 'PARENT_UNIT_LEADER', parentUnitId: 'h-1' });
  });
});

describe('checkAppointmentEligibility (§7.3 — blokada mianowania)', () => {
  it('NEGATYWNY: brak weryfikacji ochrony małoletnich → MINOR_PROTECTION_NOT_VERIFIED', () => {
    expect(
      checkAppointmentEligibility({
        minorProtectionValidUntil: null,
        standardsAcknowledgedAt: new Date('2026-01-01'),
        now: NOW,
      }),
    ).toBe('MINOR_PROTECTION_NOT_VERIFIED');
  });

  it('NEGATYWNY: weryfikacja wygasła → blokada', () => {
    expect(
      checkAppointmentEligibility({
        minorProtectionValidUntil: new Date('2026-01-01'),
        standardsAcknowledgedAt: new Date('2025-01-01'),
        now: NOW,
      }),
    ).toBe('MINOR_PROTECTION_NOT_VERIFIED');
  });

  it('NEGATYWNY: brak potwierdzenia standardów → blokada', () => {
    expect(
      checkAppointmentEligibility({
        minorProtectionValidUntil: new Date('2027-01-01'),
        standardsAcknowledgedAt: null,
        now: NOW,
      }),
    ).toBe('MINOR_PROTECTION_NOT_VERIFIED');
  });

  it('komplet ważnych weryfikacji → mianowanie dopuszczalne', () => {
    expect(
      checkAppointmentEligibility({
        minorProtectionValidUntil: new Date('2027-01-01'),
        standardsAcknowledgedAt: new Date('2026-01-01'),
        now: NOW,
      }),
    ).toBeNull();
  });
});
