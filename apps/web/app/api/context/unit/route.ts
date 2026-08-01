/**
 * Przełącznik kontekstu jednostki (§16.3) — zapisuje wybór w ciasteczku
 * i wraca na stronę, z której przyszło żądanie.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACTIVE_UNIT_COOKIE } from '../../../../lib/context';
import { APP_URL } from '../../../../lib/auth';

export async function POST(req: Request): Promise<NextResponse> {
  const form = await req.formData();
  const unitId = String(form.get('unitId') ?? '');
  const returnTo = String(form.get('returnTo') ?? '/pulpit');

  if (unitId) {
    (await cookies()).set(ACTIVE_UNIT_COOKIE, unitId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    });
  }
  // Tylko ścieżki względne — zapobiega open redirectowi na obcy host.
  const safePath = returnTo.startsWith('/') ? returnTo : '/pulpit';
  return NextResponse.redirect(`${APP_URL}${safePath}`, { status: 303 });
}
