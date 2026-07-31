import { describe, expect, it } from 'vitest';
import { ageAt, guardianConsentStatus } from './guardian-consent.js';

const NOW = new Date('2026-07-31');

describe('ageAt', () => {
  it('liczy pełne lata przed i po urodzinach', () => {
    expect(ageAt(new Date('2010-08-01'), NOW)).toBe(15); // urodziny jutro
    expect(ageAt(new Date('2010-07-31'), NOW)).toBe(16); // urodziny dziś
    expect(ageAt(new Date('2010-07-30'), NOW)).toBe(16);
  });
});

describe('guardianConsentStatus (przypomnienie, nie blokada — decyzja 2026-07-31)', () => {
  it('<16 bez zgody → MISSING (ostrzeżenie dla drużynowego, operacje NIE są blokowane)', () => {
    expect(guardianConsentStatus(new Date('2013-01-15'), [], NOW)).toBe('MISSING');
    expect(
      guardianConsentStatus(new Date('2013-01-15'), [{ consentGivenAt: null }], NOW),
    ).toBe('MISSING');
  });

  it('<16 ze zgodą → PRESENT', () => {
    expect(
      guardianConsentStatus(
        new Date('2013-01-15'),
        [{ consentGivenAt: new Date('2025-09-01') }],
        NOW,
      ),
    ).toBe('PRESENT');
  });

  it('≥16 → NOT_REQUIRED niezależnie od opiekunów', () => {
    expect(guardianConsentStatus(new Date('2009-01-15'), [], NOW)).toBe('NOT_REQUIRED');
  });

  it('brak daty urodzenia → NOT_REQUIRED (przypomnienie po uzupełnieniu profilu)', () => {
    expect(guardianConsentStatus(null, [], NOW)).toBe('NOT_REQUIRED');
  });
});
