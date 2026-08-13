/**
 * Reguły nadawania uprawnień administracyjnych (§10.1, §10.4) — czyste funkcje.
 *
 * Ten plik istnieje osobno od `authorization.ts`, bo rządzi się inną logiką:
 * `authorize()` odpowiada na pytanie „czy aktor może działać NA JEDNOSTCE",
 * a tutaj pytanie brzmi „czy aktor może zmienić UPRAWNIENIA innej osoby".
 * Drugie nie wynika z macierzy kompetencji i nie ma zasięgu w drzewie jednostek.
 */

/** Role administracyjne nadawane wewnątrz aplikacji (§10.1). */
export type AdminRole = 'SYSADMIN' | 'UNIT_ADMIN';

/** Kto próbuje zmienić uprawnienia. */
export interface GrantActor {
  personId: string;
  isRoot: boolean;
  isSysadmin: boolean;
  /** Jednostki, w których aktor jest UNIT_ADMIN-em. */
  unitAdminOf: readonly string[];
}

/** Czego dotyczy zmiana. */
export interface GrantTarget {
  role: AdminRole;
  personId: string;
  /** Wymagane dla `UNIT_ADMIN`; ignorowane dla `SYSADMIN`. */
  unitId?: string | null;
  /** Ścieżka przodków jednostki docelowej — od rodzica do korzenia. */
  unitAncestorIds?: readonly string[];
}

export type GrantDecision =
  | { allowed: true; basis: string }
  | { allowed: false; reason: GrantDenialReason };

export type GrantDenialReason =
  | 'SYSADMIN_CANNOT_MANAGE_SYSADMIN'
  | 'CANNOT_MANAGE_OWN_GRANTS'
  | 'UNIT_REQUIRED_FOR_UNIT_ADMIN'
  | 'OUTSIDE_ADMIN_SCOPE'
  | 'NO_ADMIN_AUTHORITY';

/**
 * Czy aktor może nadać albo odebrać wskazane uprawnienie administracyjne.
 *
 * @param actor - osoba wykonująca operację
 * @param target - rola, osoba i (dla UNIT_ADMIN) jednostka
 * @returns decyzja z podstawą albo powodem odmowy
 * @throws nigdy — funkcja czysta, błędy sygnalizuje przez `GrantDecision`
 *
 * @remarks §10.1 stanowi, że SYSADMIN „nie może zarządzać innymi sysadminami
 * ani zmieniać własnych uprawnień", i wymaga wymuszenia tego **w domenie, nie
 * w UI**. Stąd dwie reguły sprawdzane przed czymkolwiek innym:
 *
 * - sysadmin nie dotyka roli `SYSADMIN` w żadną stronę — ani nadania, ani
 *   odebrania; podniesienie kogoś do własnego poziomu jest równie groźne jak
 *   zdegradowanie kolegi, bo w obu wypadkach sysadmini mogliby przejąć
 *   kontrolę nad składem tej grupy z pominięciem ROOT-a;
 * - nikt poza ROOT-em nie zmienia uprawnień samemu sobie, co odcina ścieżkę
 *   „nadaj sobie szerszy zakres, potem z niego skorzystaj".
 *
 * ROOT nie podlega tym ograniczeniom (§10.1: „Wszystko. Nadaje SYSADMIN.").
 */
export function canManageAdminGrant(actor: GrantActor, target: GrantTarget): GrantDecision {
  if (actor.isRoot) {
    return { allowed: true, basis: 'ROOT — pełnia uprawnień (§10.1)' };
  }

  if (actor.personId === target.personId) {
    return { allowed: false, reason: 'CANNOT_MANAGE_OWN_GRANTS' };
  }

  if (target.role === 'SYSADMIN') {
    // Nadawać i odbierać SYSADMIN-a może wyłącznie ROOT (§10.1).
    return { allowed: false, reason: 'SYSADMIN_CANNOT_MANAGE_SYSADMIN' };
  }

  if (!target.unitId) {
    return { allowed: false, reason: 'UNIT_REQUIRED_FOR_UNIT_ADMIN' };
  }

  if (actor.isSysadmin) {
    return { allowed: true, basis: 'SYSADMIN zarządza jednostkami i użytkownikami (§10.1)' };
  }

  // UNIT_ADMIN: wyłącznie własna jednostka i jednostki jej podległe.
  const inScope = actor.unitAdminOf.some(
    (adminUnitId) =>
      adminUnitId === target.unitId || (target.unitAncestorIds ?? []).includes(adminUnitId),
  );
  if (inScope) {
    return { allowed: true, basis: 'UNIT_ADMIN w obrębie własnej jednostki i podległych (§10.1)' };
  }

  return {
    allowed: false,
    reason: actor.unitAdminOf.length > 0 ? 'OUTSIDE_ADMIN_SCOPE' : 'NO_ADMIN_AUTHORITY',
  };
}

/** Czego potrzeba, żeby ocenić delegację kompetencji (§10.4). */
export interface DelegationRequest {
  action: string;
  /** Czy akcja jest oznaczona `delegable` w macierzy kompetencji. */
  isDelegable: boolean;
  /** Czy delegujący sam posiada tę kompetencję w tym kontekście jednostki. */
  delegatorHasCompetence: boolean;
  /**
   * Skąd delegujący ma tę kompetencję. Delegować wolno wyłącznie władzę
   * własną — z urzędu, z podstawienia albo z uprawnień administracyjnych.
   */
  delegatorCompetenceVia: 'COMPETENCE' | 'DELEGATION' | 'SUBSTITUTION' | 'ADMIN' | null;
  /** Data wygaśnięcia — delegacja bezterminowa jest niedopuszczalna. */
  expiresAt: Date | null;
}

export type DelegationDenialReason =
  | 'ACTION_NOT_DELEGABLE'
  | 'DELEGATOR_LACKS_COMPETENCE'
  | 'SUBDELEGATION_NOT_ALLOWED'
  | 'EXPIRY_REQUIRED'
  | 'EXPIRY_IN_PAST';

/**
 * Czy delegację kompetencji można nadać.
 *
 * @param req - akcja, jej delegowalność, kompetencja delegującego i termin
 * @param now - moment odniesienia dla sprawdzenia terminu
 * @returns decyzja z podstawą albo powodem odmowy
 *
 * @remarks §10.4: komendant może nadać wyłącznie kompetencje, które **sam
 * posiada** i które mają `delegable: true`; nie może rozszerzyć zasięgu poza
 * własny. Zasięg pilnuje warstwa aplikacyjna, przekazując tu wynik
 * `authorize()` dla delegującego w kontekście tej samej jednostki.
 * Delegacja ma datę wygaśnięcia — bezterminowa byłaby cichym awansem.
 *
 * Subdelegacja jest zabroniona: kto sam ma kompetencję z delegacji, nie może
 * przekazać jej dalej. Inaczej łańcuch rósłby bez wiedzy komendanta, który
 * delegację zapoczątkował, i mógłby przeżyć wyznaczony przez niego termin —
 * a §10.4 mówi o powierzeniu władzy WŁASNEJ, nie cudzej.
 */
export function canDelegate(
  req: DelegationRequest,
  now: Date,
): { allowed: true } | { allowed: false; reason: DelegationDenialReason } {
  if (!req.isDelegable) return { allowed: false, reason: 'ACTION_NOT_DELEGABLE' };
  if (!req.delegatorHasCompetence) {
    return { allowed: false, reason: 'DELEGATOR_LACKS_COMPETENCE' };
  }
  if (req.delegatorCompetenceVia === 'DELEGATION') {
    return { allowed: false, reason: 'SUBDELEGATION_NOT_ALLOWED' };
  }
  if (!req.expiresAt) return { allowed: false, reason: 'EXPIRY_REQUIRED' };
  if (req.expiresAt <= now) return { allowed: false, reason: 'EXPIRY_IN_PAST' };
  return { allowed: true };
}
