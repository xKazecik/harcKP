/**
 * Formatowanie wartości w interfejsie — polska lokalizacja, jedno miejsce.
 */

const DATE = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Data w formacie dd.mm.rrrr; „—" dla braku wartości. */
export function date(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d);
}

/** Data z godziną — audit log, oś czasu. */
export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : DATE_TIME.format(d);
}

/** Wartość albo znak braku — żeby tabele nie miały pustych komórek. */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/**
 * Odmiana rzeczownika przez liczbę (polski: 1 / 2–4 / 5+).
 *
 * @example plural(3, 'harcerz', 'harcerzy', 'harcerzy') → 'harcerzy'
 */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Rok harcerski dla podanej daty (1.09–31.08, §13.3). */
export function scoutingYear(at: Date = new Date()): string {
  const y = at.getFullYear();
  return at.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

/** Inicjały do awatara zastępczego. */
export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
