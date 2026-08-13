import { NextResponse } from 'next/server';
import { ISSUER_EXTERNAL } from '../../../../lib/auth';

/**
 * Backchannel logout wywoływany przez Keycloak (§9.2).
 *
 * Klient `harc-web` ma ustawione „Backchannel logout URL" na ten adres oraz
 * „Backchannel logout session required = ON", więc Keycloak wysyła tu POST
 * z `logout_token`, gdy sesja SSO kończy się gdzie indziej — przy wylogowaniu
 * w innej aplikacji realmu albo przy unieważnieniu sesji z konsoli admina
 * (robi to m.in. archiwizacja profilu, §8.3).
 *
 * @remarks Sesja aplikacji żyje w ciasteczku `harc_session`, którego serwer nie
 * może skasować „na odległość" — ciasteczko kasuje się wyłącznie w odpowiedzi
 * do TEJ przeglądarki, a tutaj żądanie przychodzi od Keycloaka. Dlatego
 * endpoint odnotowuje zdarzenie i zwraca 200; faktyczne odcięcie dostępu
 * zapewnia krótki czas życia tokenu (5 min) oraz to, że archiwizacja usuwa
 * poświadczenia i wyłącza konto po stronie IdP.
 *
 * TODO(prod): przy przejściu na sesje trzymane po stronie serwera (Redis)
 * ten handler powinien usuwać wpis sesji po `sid`/`sub` z `logout_token`,
 * co da natychmiastowe wylogowanie zamiast czekania na wygaśnięcie tokenu.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let logoutToken: string | null = null;
  try {
    const form = await request.formData();
    logoutToken = String(form.get('logout_token') ?? '') || null;
  } catch {
    logoutToken = null;
  }

  if (!logoutToken) {
    // Keycloak oczekuje 400 przy braku tokenu — inaczej uzna wylogowanie za
    // udane i nie ponowi próby.
    return NextResponse.json({ error: 'missing logout_token' }, { status: 400 });
  }

  // Token jest JWT podpisanym przez realm. Czytamy tylko claimy informacyjne,
  // bez podejmowania decyzji autoryzacyjnych — stąd brak weryfikacji podpisu.
  let claims: { sub?: string; sid?: string; iss?: string } = {};
  try {
    const payload = logoutToken.split('.')[1] ?? '';
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return NextResponse.json({ error: 'malformed logout_token' }, { status: 400 });
  }

  if (claims.iss && claims.iss !== ISSUER_EXTERNAL) {
    return NextResponse.json({ error: 'unexpected issuer' }, { status: 400 });
  }

  console.info(
    JSON.stringify({
      event: 'backchannel_logout',
      sub: claims.sub ?? null,
      sid: claims.sid ?? null,
    }),
  );

  // 200 bez treści — Keycloak traktuje każdy inny status jako niepowodzenie
  // i ponawia wywołanie.
  return new NextResponse(null, { status: 200 });
}
