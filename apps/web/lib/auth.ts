/**
 * Logowanie OIDC przez Keycloak (§9.2): Authorization Code + PKCE (S256),
 * klient confidential — sekret używany wyłącznie server-side.
 *
 * Dwa adresy issuera: zewnętrzny (przeglądarka → localhost:8080) i wewnętrzny
 * (kontener web → keycloak:8080) — token exchange idzie kanałem wewnętrznym.
 *
 * @remarks Dev-grade: sesja w cookies httpOnly bez podpisu, claims z id_tokenu
 * odbieranego bezpośrednim kanałem backchannel (TLS/direct → zaufany).
 * TODO(prod): weryfikacja podpisu JWT (JWKS) i szyfrowanie sesji.
 */
import { createHash, randomBytes } from 'node:crypto';

export const ISSUER_EXTERNAL =
  process.env.KEYCLOAK_ISSUER_URL || 'http://localhost:8080/realms/harc';
// `||`, nie `??`: poza Dockerem zmienna bywa obecna, ale pusta.
export const ISSUER_INTERNAL = process.env.KEYCLOAK_ISSUER_INTERNAL_URL || ISSUER_EXTERNAL;
export const CLIENT_ID = process.env.KEYCLOAK_WEB_CLIENT_ID ?? 'harc-web';
export const CLIENT_SECRET = process.env.KEYCLOAK_WEB_CLIENT_SECRET ?? '';
export const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
export const REDIRECT_URI = `${APP_URL}/api/auth/callback/keycloak`;

export interface SessionClaims {
  sub: string;
  person_id?: string;
  name?: string;
  email?: string;
  groups?: string[];
}

export function generatePkce(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, state: randomBytes(16).toString('base64url') };
}

export function authorizationUrl(challenge: string, state: string): string {
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid profile email harc',
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });
  return `${ISSUER_EXTERNAL}/protocol/openid-connect/auth?${q}`;
}

export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<{ idToken: string; accessToken: string; claims: SessionClaims }> {
  const res = await fetch(`${ISSUER_INTERNAL}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id_token: string; access_token: string };
  const payload = data.id_token.split('.')[1] ?? '';
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionClaims;
  return { idToken: data.id_token, accessToken: data.access_token, claims };
}

export function logoutUrl(idToken: string | undefined): string {
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    post_logout_redirect_uri: `${APP_URL}/`,
    ...(idToken && { id_token_hint: idToken }),
  });
  return `${ISSUER_EXTERNAL}/protocol/openid-connect/logout?${q}`;
}
