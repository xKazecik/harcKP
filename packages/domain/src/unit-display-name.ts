import type { UnitType } from './unit-level.js';

export type Branch = 'HARCERZE' | 'HARCERKI';

/** Dane potrzebne do zbudowania nazwy wyświetlanej jednostki (§6.2). */
export interface UnitNameParts {
  type: UnitType;
  branch: Branch;
  number?: string | null;
  localityName: string;
  properName?: string | null;
  patron?: string | null;
}

/**
 * Etykieta typu jednostki per gałąź, w formie do nazwy własnej
 * (np. "Drużyna Harcerzy"). To NIE jest nomenklatura funkcyjnych (§6.4) —
 * ta pochodzi z tabeli Nomenclature.
 */
function typeLabel(type: UnitType, branch: Branch): string {
  const f = branch === 'HARCERKI';
  switch (type) {
    case 'ORGANIZACJA':
      return f ? 'Organizacja Harcerek' : 'Organizacja Harcerzy';
    case 'CHORAGIEW':
      return f ? 'Chorągiew Harcerek' : 'Chorągiew Harcerzy';
    case 'NAMIESTNICTWO':
      return f ? 'Namiestnictwo Harcerek' : 'Namiestnictwo Harcerzy';
    case 'HUFIEC':
      return f ? 'Hufiec Harcerek' : 'Hufiec Harcerzy';
    case 'ZWIAZEK_DRUZYN':
      return f ? 'Związek Drużyn Harcerek' : 'Związek Drużyn Harcerzy';
    case 'GROMADA':
      return f ? 'Gromada Zuchenek' : 'Gromada Zuchów';
    case 'DRUZYNA':
      return f ? 'Drużyna Harcerek' : 'Drużyna Harcerzy';
    case 'DRUZYNA_WEDROWNICZA':
      return f ? 'Drużyna Wędrowniczek' : 'Drużyna Wędrowników';
    case 'SAMODZIELNY_ZASTEP':
      return f ? 'Samodzielny Zastęp Harcerek' : 'Samodzielny Zastęp Harcerzy';
    case 'SZCZEP':
      return 'Szczep';
    case 'KRAG_HARCERSTWA_STARSZEGO':
      return 'Krąg Harcerstwa Starszego';
    case 'KRAG_INSTRUKTORSKI':
      return 'Krąg Instruktorski';
  }
}

/**
 * Generuje nazwę wyświetlaną jednostki (§6.2). Nazwa NIGDY nie jest wpisywana
 * ręcznie.
 *
 * @param parts - składowe nazwy
 * @returns np. `1 Sucholeska Drużyna Harcerzy „Grań” im. rtm. Witolda Pileckiego`
 * @remarks Wzorzec: `{number} {localityName} {typeLabel} „{properName}” im. {patron}`,
 * z pominięciem członów pustych.
 */
export function unitDisplayName(parts: UnitNameParts): string {
  const segments: string[] = [];
  if (parts.number) segments.push(parts.number);
  // ORGANIZACJA nie ma przymiotnika miejscowego — etykieta typu jest pełną
  // nazwą jednostki, więc pusty localityName musi zniknąć z wyniku.
  if (parts.localityName) segments.push(parts.localityName);
  segments.push(typeLabel(parts.type, parts.branch));
  if (parts.properName) segments.push(`„${parts.properName}”`);
  if (parts.patron) segments.push(`im. ${parts.patron}`);
  return segments.join(' ');
}
