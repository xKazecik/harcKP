import { cookies } from 'next/headers';

/**
 * Strona startowa: niezalogowany → przycisk logowania Keycloak;
 * zalogowany → powitanie, rola ROOT z claimu groups (§9.4), nawigacja.
 */
export default async function HomePage() {
  const jar = await cookies();
  const raw = jar.get('harc_session')?.value;
  let session: { name?: string; email?: string; groups?: string[] } | null = null;
  if (raw) {
    try {
      session = JSON.parse(raw);
    } catch {
      session = null;
    }
  }
  const rootGroup = process.env.KEYCLOAK_ROOT_GROUP ?? '/zhr_sysadmins';
  const isRoot = session?.groups?.includes(rootGroup) ?? false;

  const btn: React.CSSProperties = {
    display: 'inline-block',
    background: 'var(--accent)',
    color: '#fff',
    padding: '10px 24px',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 15,
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface)',
        color: 'var(--text)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1 style={{ fontSize: 40, marginBottom: 4 }}>HARC</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
          System wsparcia metodycznego pionu wychowawczego ZHR
        </p>

        {!session ? (
          <a href="/api/auth/login" style={btn}>
            Zaloguj się przez Keycloak
          </a>
        ) : (
          <>
            <p style={{ fontSize: 18 }}>
              Czuwaj, <strong>{session.name ?? session.email}</strong>!
              {isRoot && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    background: 'var(--danger)',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '2px 8px',
                    verticalAlign: 'middle',
                  }}
                >
                  ROOT
                </span>
              )}
            </p>
            <nav style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
              <a href="/mapa-jednostek" style={btn}>
                Mapa jednostek
              </a>
              <a
                href="/api/auth/logout"
                style={{ ...btn, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Wyloguj
              </a>
            </nav>
          </>
        )}
      </div>
    </main>
  );
}
