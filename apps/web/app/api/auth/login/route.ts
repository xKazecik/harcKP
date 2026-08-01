import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authorizationUrl, generatePkce } from '../../../../lib/auth';

/** Start logowania: PKCE + state w cookies, redirect do Keycloak. */
export async function GET(): Promise<NextResponse> {
  const { verifier, challenge, state } = generatePkce();
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 600 };
  jar.set('harc_pkce', verifier, opts);
  jar.set('harc_state', state, opts);
  return NextResponse.redirect(authorizationUrl(challenge, state));
}
