/**
 * Strona startowa — placeholder etapu 1. Logowanie przez Keycloak (OIDC,
 * confidential + PKCE) zostanie wpięte w etapie 3 razem z kreatorem zaproszeń.
 */
export default function HomePage() {
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
      <div style={{ textAlign: 'center' }}>
        <h1>HARC</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          System wsparcia metodycznego pionu wychowawczego ZHR — etap 1 (fundament)
        </p>
      </div>
    </main>
  );
}
