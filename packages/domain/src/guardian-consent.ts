/**
 * Zgoda opiekuna prawnego na uczestnictwo (§7.2, zmodyfikowane decyzją
 * zamawiającego 2026-07-31).
 *
 * @remarks ODSTĘPSTWO OD SPECYFIKACJI: pierwotna reguła twarda ("przyjęcie
 * osoby poniżej 16 r.ż. wymaga rekordu Guardian z consentGivenAt") została
 * zmieniona na PRZYPOMNIENIE — brak zgody nie blokuje przyjęcia ani
 * aktywacji konta, lecz generuje status MISSING widoczny dla drużynowego
 * na profilu i liście "do uzupełnienia".
 * TODO(regulamin): potwierdzić z GK, czy przypomnienie wystarcza formalnie.
 */

export interface GuardianSnapshot {
  consentGivenAt: Date | null;
}

export type ConsentStatus =
  /** Osoba ma ukończone 16 lat (albo brak daty urodzenia — patrz remarks) */
  | 'NOT_REQUIRED'
  /** Poniżej 16 lat, brak opiekuna z odnotowaną zgodą — POKAŻ PRZYPOMNIENIE */
  | 'MISSING'
  /** Poniżej 16 lat, zgoda odnotowana */
  | 'PRESENT';

/**
 * Wiek osoby w pełnych latach w danym dniu.
 *
 * @param birthDate - data urodzenia
 * @param at - dzień odniesienia
 * @returns wiek w pełnych latach
 */
export function ageAt(birthDate: Date, at: Date): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    at.getMonth() < birthDate.getMonth() ||
    (at.getMonth() === birthDate.getMonth() && at.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Status zgody rodzica dla osoby.
 *
 * @param birthDate - data urodzenia; null (profil przed uzupełnieniem) →
 *   NOT_REQUIRED, bo nie da się stwierdzić małoletniości — przypomnienie
 *   pojawi się po uzupełnieniu daty w kreatorze
 * @param guardians - opiekunowie osoby
 * @param now - dzień odniesienia
 * @returns status zgody sterujący przypomnieniem dla drużynowego
 */
export function guardianConsentStatus(
  birthDate: Date | null,
  guardians: readonly GuardianSnapshot[],
  now: Date,
): ConsentStatus {
  if (!birthDate || ageAt(birthDate, now) >= 16) return 'NOT_REQUIRED';
  const hasConsent = guardians.some((g) => g.consentGivenAt !== null);
  return hasConsent ? 'PRESENT' : 'MISSING';
}
