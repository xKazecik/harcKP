/**
 * Aktywny kontekst jednostki (§16.3).
 *
 * Osoba może pełnić funkcje w kilku jednostkach — przełączenie zmienia cały
 * kontekst uprawnień, więc wybór musi być widoczny dla renderowania po stronie
 * serwera. Trzymamy go w ciasteczku, nie w stanie klienta.
 *
 * @remarks Ciasteczko jest wyłącznie preferencją widoku. Nie nadaje żadnych
 * uprawnień — te wylicza AuthorizationService na podstawie funkcji z rozkazów
 * (§10.2). Podstawienie cudzego `unitId` pokaże co najwyżej pustą stronę.
 */
import { cookies } from 'next/headers';

export const ACTIVE_UNIT_COOKIE = 'harc_unit';

export interface UnitOption {
  id: string;
  displayName: string;
  type: string;
  branch: string;
}

/**
 * Wybrana jednostka albo pierwsza dostępna, gdy wybór jest nieaktualny.
 *
 * @param available - jednostki, do których użytkownik ma dostęp
 * @returns identyfikator aktywnej jednostki albo null, gdy brak jakiejkolwiek
 */
export async function getActiveUnitId(available: UnitOption[]): Promise<string | null> {
  if (available.length === 0) return null;
  const saved = (await cookies()).get(ACTIVE_UNIT_COOKIE)?.value;
  if (saved && available.some((u) => u.id === saved)) return saved;
  return available[0]!.id;
}
