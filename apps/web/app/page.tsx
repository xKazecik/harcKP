/**
 * Ekran startowy: niezalogowany widzi logowanie, zalogowany trafia na pulpit.
 *
 * Rejestracja własna jest wyłączona (§8.1) — konto zakłada komendant, dlatego
 * na tym ekranie nie ma i nie może być odnośnika „załóż konto".
 */
import { redirect } from 'next/navigation';
import { getSession } from '../lib/session';
import { ThemeToggle } from './components/theme-toggle';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ blad?: string }>;
}) {
  const session = await getSession();
  if (session) redirect('/pulpit');

  const { blad } = await searchParams;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-5)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden>
            ⚜
          </div>
          <h1 style={{ fontSize: 36, marginTop: 'var(--space-3)' }}>HARC</h1>
          <p className="muted" style={{ marginTop: 'var(--space-2)' }}>
            System wsparcia metodycznego pionu wychowawczego ZHR
          </p>
        </div>

        {blad === 'logowanie' && (
          <div className="alert alert-danger" role="alert">
            <div>
              <div className="alert-title">Logowanie nie powiodło się</div>
              <div>Spróbuj ponownie. Jeśli problem się powtarza, zgłoś się do administratora.</div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <a href="/api/auth/login" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Zaloguj się przez Keycloak
            </a>
            <p className="small muted" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
              Konto w systemie zakłada komendant jednostki — nie ma samodzielnej
              rejestracji. Jeśli czekasz na dostęp, sprawdź skrzynkę: zaproszenie
              przychodzi e-mailem z linkiem aktywacyjnym.
            </p>
          </div>
          <div className="card-footer">
            <div className="spread">
              <a href="/mapa-jednostek">Mapa jednostek ZHR</a>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
