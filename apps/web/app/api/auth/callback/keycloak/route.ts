import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { APP_URL, exchangeCode } from '../../../../../lib/auth';

/** Callback OIDC: weryfikacja state, wymiana kodu, zapis sesji. */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const expectedState = jar.get('harc_state')?.value;
  const verifier = jar.get('harc_pkce')?.value;

  if (!code || !state || !verifier || state !== expectedState) {
    return NextResponse.redirect(`${APP_URL}/?blad=logowanie`);
  }

  try {
    const { idToken, accessToken, claims } = await exchangeCode(code, verifier);
    const opts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 36_000 };
    jar.delete('harc_pkce');
    jar.delete('harc_state');
    jar.set(
      'harc_session',
      JSON.stringify({
        sub: claims.sub,
        person_id: claims.person_id,
        name: claims.name,
        email: claims.email,
        groups: claims.groups ?? [],
      }),
      opts,
    );
    jar.set('harc_access', accessToken, opts);
    jar.set('harc_id', idToken, opts);
    return NextResponse.redirect(`${APP_URL}/`);
  } catch (err) {
    console.error('OIDC callback:', err);
    return NextResponse.redirect(`${APP_URL}/?blad=logowanie`);
  }
}
