/**
 * Proxy danych mapy publicznej (§15).
 *
 * Mapa jest stroną kliencką, a API nie ma i nie powinno mieć włączonego CORS —
 * dlatego przeglądarka pyta własny serwer Next, a ten po stronie serwera sięga
 * do API siecią wewnętrzną. Dzięki temu mapa działa także wtedy, gdy API nie
 * jest w ogóle wystawione na zewnątrz.
 *
 * Endpoint jest PUBLICZNY — nie wymaga sesji, bo mapa działa bez logowania.
 * Zwraca wyłącznie dane jednostek; API nigdy nie umieszcza tu danych osobowych.
 */
import { NextResponse } from 'next/server';
import { API_URL } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const params = new URLSearchParams();
  // Przepuszczamy tylko znane filtry — bez przekazywania dowolnego query dalej.
  for (const key of ['branch', 'type'] as const) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }

  try {
    const res = await fetch(
      `${API_URL}/public/map-units${params.toString() ? `?${params}` : ''}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json([], { status: 200 });
    return NextResponse.json(await res.json());
  } catch {
    // Mapa ma się wyrenderować nawet przy niedostępnym API — pusta lista
    // pokazuje komunikat, zamiast wywracać całą stronę.
    return NextResponse.json([], { status: 200 });
  }
}
