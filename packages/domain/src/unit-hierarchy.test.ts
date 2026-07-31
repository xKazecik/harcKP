import { describe, expect, it } from 'vitest';
import { validateUnitParent, canGroupUnit } from './unit-hierarchy.js';

describe('validateUnitParent (§6.1 — testy hierarchii)', () => {
  it('DRUZYNA pod HUFCEM — poprawna', () => {
    expect(
      validateUnitParent({
        childType: 'DRUZYNA',
        childBranch: 'HARCERZE',
        parentType: 'HUFIEC',
        parentBranch: 'HARCERZE',
      }),
    ).toBeNull();
  });

  it('alias: DRUZYNA pod ZWIAZEK_DRUZYN — poprawna (identycznie jak HUFIEC)', () => {
    expect(
      validateUnitParent({
        childType: 'DRUZYNA',
        childBranch: 'HARCERKI',
        parentType: 'ZWIAZEK_DRUZYN',
        parentBranch: 'HARCERKI',
      }),
    ).toBeNull();
  });

  it('alias: HUFIEC pod NAMIESTNICTWEM — poprawny (identycznie jak CHORAGIEW)', () => {
    expect(
      validateUnitParent({
        childType: 'HUFIEC',
        childBranch: 'HARCERKI',
        parentType: 'NAMIESTNICTWO',
        parentBranch: 'HARCERKI',
      }),
    ).toBeNull();
  });

  it('NEGATYWNY: DRUZYNA bezpośrednio pod CHORAGWIA — INVALID_PARENT_TYPE', () => {
    expect(
      validateUnitParent({
        childType: 'DRUZYNA',
        childBranch: 'HARCERZE',
        parentType: 'CHORAGIEW',
        parentBranch: 'HARCERZE',
      }),
    ).toBe('INVALID_PARENT_TYPE');
  });

  it('NEGATYWNY: niezgodność gałęzi — BRANCH_MISMATCH', () => {
    expect(
      validateUnitParent({
        childType: 'DRUZYNA',
        childBranch: 'HARCERKI',
        parentType: 'HUFIEC',
        parentBranch: 'HARCERZE',
      }),
    ).toBe('BRANCH_MISMATCH');
  });

  it('NEGATYWNY: ORGANIZACJA z rodzicem — PARENT_FORBIDDEN', () => {
    expect(
      validateUnitParent({
        childType: 'ORGANIZACJA',
        childBranch: 'HARCERZE',
        parentType: 'ORGANIZACJA',
        parentBranch: 'HARCERZE',
      }),
    ).toBe('PARENT_FORBIDDEN');
  });

  it('NEGATYWNY: CHORAGIEW bez rodzica — PARENT_REQUIRED', () => {
    expect(
      validateUnitParent({ childType: 'CHORAGIEW', childBranch: 'HARCERZE' }),
    ).toBe('PARENT_REQUIRED');
  });

  it('SAMODZIELNY_ZASTEP podlega hufcowi (§6.3)', () => {
    expect(
      validateUnitParent({
        childType: 'SAMODZIELNY_ZASTEP',
        childBranch: 'HARCERZE',
        parentType: 'HUFIEC',
        parentBranch: 'HARCERZE',
      }),
    ).toBeNull();
    expect(
      validateUnitParent({
        childType: 'SAMODZIELNY_ZASTEP',
        childBranch: 'HARCERZE',
        parentType: 'DRUZYNA',
        parentBranch: 'HARCERZE',
      }),
    ).toBe('INVALID_PARENT_TYPE');
  });
});

describe('canGroupUnit (jednostki poziome)', () => {
  it('szczep grupuje drużyny, drużyny wędrownicze i gromady', () => {
    expect(canGroupUnit('SZCZEP', 'DRUZYNA')).toBe(true);
    expect(canGroupUnit('SZCZEP', 'DRUZYNA_WEDROWNICZA')).toBe(true);
    expect(canGroupUnit('SZCZEP', 'GROMADA')).toBe(true);
  });

  it('NEGATYWNY: szczep nie grupuje hufców ani kręgów', () => {
    expect(canGroupUnit('SZCZEP', 'HUFIEC')).toBe(false);
    expect(canGroupUnit('SZCZEP', 'KRAG_INSTRUKTORSKI')).toBe(false);
  });

  it('NEGATYWNY: kręgi nie grupują jednostek (grupują osoby)', () => {
    expect(canGroupUnit('KRAG_INSTRUKTORSKI', 'DRUZYNA')).toBe(false);
  });
});
