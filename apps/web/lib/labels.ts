/**
 * Etykiety UI dla stanów technicznych aplikacji.
 *
 * WAŻNE (§6.4): to NIE jest nomenklatura ZHR. Nazwy funkcyjnych („Drużynowy",
 * „Komendantka Chorągwi") pochodzą wyłącznie z tabeli `Nomenclature`, a nazwy
 * stopni i sprawności ze słowników wersjonowanych (§2). Tutaj są wyłącznie
 * etykiety stanów aplikacji (status rekordu, kategoria członkostwa), których
 * regulaminy nie definiują.
 *
 * Mapy zamiast łańcuchów `if` — komponent nigdy nie buduje etykiety warunkiem.
 */

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface LabelDef {
  label: string;
  tone: Tone;
}

const PERSON_STATUS: Record<string, LabelDef> = {
  INVITED: { label: 'Zaproszona', tone: 'info' },
  ACTIVE: { label: 'Aktywna', tone: 'success' },
  ARCHIVED: { label: 'Archiwalna', tone: 'neutral' },
};

const UNIT_STATUS: Record<string, LabelDef> = {
  PROBATIONARY: { label: 'Próbna', tone: 'warning' },
  ACTIVE: { label: 'Działająca', tone: 'success' },
  SUSPENDED: { label: 'Zawieszona', tone: 'danger' },
  DISSOLVED: { label: 'Rozwiązana', tone: 'neutral' },
};

const MEMBERSHIP_CATEGORY: Record<string, LabelDef> = {
  UCZESTNIK: { label: 'Uczestnik', tone: 'neutral' },
  HARCERZ_STARSZY: { label: 'Harcerz starszy', tone: 'info' },
  INSTRUKTOR: { label: 'Instruktor', tone: 'accent' },
  CZLONEK_WSPOLDZIALAJACY: { label: 'Członek współdziałający', tone: 'neutral' },
};

const INSTRUCTOR_RANK: Record<string, LabelDef> = {
  PRZEWODNIK: { label: 'przewodnik', tone: 'neutral' },
  PODHARCMISTRZ: { label: 'podharcmistrz', tone: 'info' },
  HARCMISTRZ: { label: 'harcmistrz', tone: 'accent' },
};

const LIST_TYPE: Record<string, LabelDef> = {
  CZYNNY: { label: 'Lista czynnych', tone: 'success' },
  WSPIERAJACY: { label: 'Lista wspierających', tone: 'neutral' },
};

const PROGRESSION_STATUS: Record<string, LabelDef> = {
  DRAFT: { label: 'Szkic karty', tone: 'neutral' },
  OPEN: { label: 'Próba otwarta', tone: 'info' },
  CLOSED_POSITIVE: { label: 'Zamknięta pozytywnie', tone: 'success' },
  CLOSED_NEGATIVE: { label: 'Zamknięta negatywnie', tone: 'danger' },
  DISCONTINUED: { label: 'Umorzona', tone: 'neutral' },
  AWARDED: { label: 'Przyznany rozkazem', tone: 'success' },
  ABANDONED: { label: 'Porzucona', tone: 'neutral' },
};

const REQUIREMENT_STATUS: Record<string, LabelDef> = {
  PENDING: { label: 'Do zrobienia', tone: 'neutral' },
  SUBMITTED: { label: 'Zgłoszone', tone: 'warning' },
  VERIFIED: { label: 'Zaliczone', tone: 'success' },
  REPLACED: { label: 'Zamienione', tone: 'neutral' },
};

const ORDER_STATUS: Record<string, LabelDef> = {
  DRAFT: { label: 'Szkic', tone: 'neutral' },
  PUBLISHED: { label: 'Opublikowany', tone: 'success' },
  CORRECTED: { label: 'Sprostowany', tone: 'warning' },
  REVOKED: { label: 'Odwołany', tone: 'danger' },
};

const WORK_PLAN_STATUS: Record<string, LabelDef> = {
  DRAFT: { label: 'Szkic', tone: 'neutral' },
  SUBMITTED: { label: 'Złożony', tone: 'info' },
  RETURNED_FOR_CORRECTION: { label: 'Zwrócony do poprawy', tone: 'warning' },
  APPROVED: { label: 'Zatwierdzony', tone: 'success' },
  REJECTED: { label: 'Odrzucony', tone: 'danger' },
};

const PROGRESSION_KIND: Record<string, LabelDef> = {
  RANK: { label: 'Stopień', tone: 'accent' },
  BADGE: { label: 'Sprawność', tone: 'info' },
  ZUCH_STAR: { label: 'Gwiazdka zuchowa', tone: 'info' },
  INSTRUCTOR_RANK: { label: 'Stopień instruktorski', tone: 'accent' },
};

const BRANCH: Record<string, LabelDef> = {
  HARCERZE: { label: 'Harcerze', tone: 'info' },
  HARCERKI: { label: 'Harcerki', tone: 'accent' },
};

const GUARDIAN_CONSENT: Record<string, LabelDef> = {
  NOT_REQUIRED: { label: 'Niewymagana', tone: 'neutral' },
  MISSING: { label: 'Brak zgody rodzica', tone: 'warning' },
  PRESENT: { label: 'Zgoda odnotowana', tone: 'success' },
};

const UNIT_TYPE: Record<string, LabelDef> = {
  ORGANIZACJA: { label: 'Organizacja', tone: 'neutral' },
  CHORAGIEW: { label: 'Chorągiew', tone: 'neutral' },
  NAMIESTNICTWO: { label: 'Namiestnictwo', tone: 'neutral' },
  HUFIEC: { label: 'Hufiec', tone: 'neutral' },
  ZWIAZEK_DRUZYN: { label: 'Związek drużyn', tone: 'neutral' },
  GROMADA: { label: 'Gromada', tone: 'neutral' },
  DRUZYNA: { label: 'Drużyna', tone: 'neutral' },
  DRUZYNA_WEDROWNICZA: { label: 'Drużyna wędrownicza', tone: 'neutral' },
  SAMODZIELNY_ZASTEP: { label: 'Samodzielny zastęp', tone: 'neutral' },
  SZCZEP: { label: 'Szczep', tone: 'neutral' },
  KRAG_HARCERSTWA_STARSZEGO: { label: 'Krąg harcerstwa starszego', tone: 'neutral' },
  KRAG_INSTRUKTORSKI: { label: 'Krąg instruktorski', tone: 'neutral' },
};

const DICTIONARIES = {
  personStatus: PERSON_STATUS,
  unitStatus: UNIT_STATUS,
  membershipCategory: MEMBERSHIP_CATEGORY,
  instructorRank: INSTRUCTOR_RANK,
  listType: LIST_TYPE,
  progressionStatus: PROGRESSION_STATUS,
  requirementStatus: REQUIREMENT_STATUS,
  orderStatus: ORDER_STATUS,
  workPlanStatus: WORK_PLAN_STATUS,
  progressionKind: PROGRESSION_KIND,
  branch: BRANCH,
  guardianConsent: GUARDIAN_CONSENT,
  unitType: UNIT_TYPE,
} as const;

export type DictionaryName = keyof typeof DICTIONARIES;

/**
 * Etykieta i ton dla wartości enuma.
 *
 * @param dictionary - nazwa słownika etykiet
 * @param value - wartość techniczna (kod enuma)
 * @returns etykieta z tonem; dla nieznanej wartości zwraca sam kod
 */
export function labelOf(dictionary: DictionaryName, value: string | null | undefined): LabelDef {
  if (!value) return { label: '—', tone: 'neutral' };
  return DICTIONARIES[dictionary][value] ?? { label: value, tone: 'neutral' };
}

/** Sama etykieta tekstowa, bez tonu. */
export function text(dictionary: DictionaryName, value: string | null | undefined): string {
  return labelOf(dictionary, value).label;
}
