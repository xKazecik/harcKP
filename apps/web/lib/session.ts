/**
 * Sesja użytkownika po stronie serwera.
 *
 * Ciasteczko `harc_session` zapisuje callback OIDC (lib/auth.ts). Uprawnienie
 * ROOT wynika WYŁĄCZNIE z claimu `groups` porównywanego z KEYCLOAK_ROOT_GROUP
 * (§9.4) — nigdy z adresu e-mail, bo adres jest zmienialny i zwalniany przy
 * archiwizacji, więc byłby wektorem eskalacji.
 *
 * Claim `groups` ma pełne ścieżki (`full.path=true`, §9.3), dlatego wartość
 * konfiguracyjna też musi zaczynać się od ukośnika.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface SessionClaims {
  sub: string;
  person_id?: string;
  name?: string;
  email?: string;
  groups?: string[];
}

export interface Session extends SessionClaims {
  isRoot: boolean;
}

/**
 * Odczytuje sesję z ciasteczka.
 *
 * @returns sesja z wyliczonym `isRoot` albo `null`, gdy użytkownik niezalogowany
 */
export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get('harc_session')?.value;
  if (!raw) return null;
  try {
    const claims = JSON.parse(raw) as SessionClaims;
    const rootGroup = process.env.KEYCLOAK_ROOT_GROUP ?? '/zhr_sysadmins';
    return { ...claims, isRoot: (claims.groups ?? []).includes(rootGroup) };
  } catch {
    return null;
  }
}

/** Identyfikator osoby przekazywany do API jako X-Person-Id (§8.2: username = UUID osoby). */
export function actorPersonId(session: Session | null): string | null {
  return session?.person_id ?? session?.sub ?? null;
}

/**
 * Sesja albo przekierowanie na ekran logowania.
 *
 * Layout grupy `(panel)` też sprawdza sesję, ale w React Server Components
 * layout i strona renderują się RÓWNOLEGLE — bez tej funkcji strona zdążyłaby
 * sięgnąć po `session.sub` na `null`, zanim zadziała przekierowanie z layoutu.
 *
 * @returns sesja zalogowanego użytkownika
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/');
  return session;
}
