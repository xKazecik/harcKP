import { describe, expect, it } from 'vitest';
import { normalizeUnitLevel, type UnitType } from './unit-level.js';
import { unitDisplayName } from './unit-display-name.js';

describe('normalizeUnitLevel (§6.1 — aliasy statutowe, twarda reguła)', () => {
  it('NAMIESTNICTWO traktuje identycznie jak CHORAGIEW', () => {
    expect(normalizeUnitLevel('NAMIESTNICTWO')).toBe('CHORAGIEW');
  });

  it('ZWIAZEK_DRUZYN traktuje identycznie jak HUFIEC', () => {
    expect(normalizeUnitLevel('ZWIAZEK_DRUZYN')).toBe('HUFIEC');
  });

  it('pozostałe typy zwraca bez zmian', () => {
    const passthrough: UnitType[] = [
      'ORGANIZACJA',
      'CHORAGIEW',
      'HUFIEC',
      'GROMADA',
      'DRUZYNA',
      'DRUZYNA_WEDROWNICZA',
      'SAMODZIELNY_ZASTEP',
      'SZCZEP',
      'KRAG_HARCERSTWA_STARSZEGO',
      'KRAG_INSTRUKTORSKI',
    ];
    for (const t of passthrough) {
      expect(normalizeUnitLevel(t)).toBe(t);
    }
  });
});

describe('unitDisplayName (§6.2 — nazwa generowana, nigdy ręczna)', () => {
  it('buduje pełną nazwę z numerem, cudzysłowem typograficznym i patronem', () => {
    expect(
      unitDisplayName({
        type: 'DRUZYNA',
        branch: 'HARCERZE',
        number: '1',
        localityName: 'Sucholeska',
        properName: 'Grań',
        patron: 'rtm. Witolda Pileckiego',
      }),
    ).toBe('1 Sucholeska Drużyna Harcerzy „Grań” im. rtm. Witolda Pileckiego');
  });

  it('pomija człony puste', () => {
    expect(
      unitDisplayName({
        type: 'HUFIEC',
        branch: 'HARCERKI',
        localityName: 'Pomorska',
      }),
    ).toBe('Pomorska Hufiec Harcerek');
  });

  it('rozróżnia gałęzie', () => {
    expect(
      unitDisplayName({ type: 'GROMADA', branch: 'HARCERKI', localityName: 'Bydgoska' }),
    ).toContain('Gromada Zuchenek');
    expect(
      unitDisplayName({ type: 'GROMADA', branch: 'HARCERZE', localityName: 'Bydgoska' }),
    ).toContain('Gromada Zuchów');
  });
});
