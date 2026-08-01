import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { logoutUrl } from '../../../../lib/auth';

/** Wylogowanie: czyści sesję i kończy sesję SSO w Keycloak. */
export async function GET(): Promise<NextResponse> {
  const jar = await cookies();
  const idToken = jar.get('harc_id')?.value;
  for (const c of ['harc_session', 'harc_access', 'harc_id', 'harc_pkce', 'harc_state']) {
    jar.delete(c);
  }
  return NextResponse.redirect(logoutUrl(idToken));
}
