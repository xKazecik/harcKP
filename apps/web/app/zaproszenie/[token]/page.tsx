'use client';

/**
 * Kreator zaproszenia (§8.2): hasło → profil → opiekun (nieblokujący) →
 * podsumowanie. Krok opiekuna pokazuje się przy wieku <16, ale można go
 * pominąć — drużynowy dostanie przypomnienie (decyzja 2026-07-31).
 */
import { use, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Step = 'loading' | 'invalid' | 'password' | 'profile' | 'guardian' | 'done';

export default function InvitationWizard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [step, setStep] = useState<Step>('loading');
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [consentStatus, setConsentStatus] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/public/invitations/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { firstName: string }) => {
        setFirstName(d.firstName);
        setStep('password');
      })
      .catch(() => setStep('invalid'));
  }, [token]);

  const post = async (path: string, body?: unknown): Promise<Response> => {
    const r = await fetch(`${API}/public/invitations/${token}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) setError('Coś poszło nie tak — spróbuj ponownie.');
    return r;
  };

  const box: React.CSSProperties = {
    maxWidth: 480,
    margin: '10vh auto',
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 32,
  };
  const input: React.CSSProperties = {
    width: '100%',
    padding: 10,
    marginTop: 4,
    marginBottom: 12,
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  };
  const btn: React.CSSProperties = {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: 14,
  };

  if (step === 'loading') return <main style={box}>Sprawdzanie zaproszenia…</main>;
  if (step === 'invalid')
    return (
      <main style={box}>
        {/* Komunikat neutralny — bez ujawniania, czy konto istnieje (§8.2). */}
        <h1 style={{ fontSize: 20 }}>Link jest nieprawidłowy albo stracił ważność</h1>
        <p style={{ color: 'var(--text-muted)' }}>Poproś osobę, która Cię zapraszała, o nowy link.</p>
      </main>
    );

  return (
    <main style={box}>
      <h1 style={{ fontSize: 20 }}>Cześć {firstName}! 👋</h1>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

      {step === 'password' && (
        <>
          <p>Krok 1 z 4 — ustaw hasło. Wyślemy Ci e-mail z bezpiecznym linkiem.</p>
          <button
            style={btn}
            onClick={async () => {
              await post('/password-email');
              setStep('profile');
            }}
          >
            Wyślij e-mail i przejdź dalej
          </button>
        </>
      )}

      {step === 'profile' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const bd = String(form.get('birthDate') ?? '');
            setBirthDate(bd);
            await post('/profile', {
              ...(bd && { birthDate: bd }),
              ...(form.get('school') && { school: String(form.get('school')) }),
              ...(form.get('phone') && { phone: String(form.get('phone')) }),
            });
            const age = bd ? (Date.now() - new Date(bd).getTime()) / 3.15576e10 : 99;
            setStep(age < 16 ? 'guardian' : 'done');
            if (age >= 16) await finish();
          }}
        >
          <p>Krok 2 z 4 — uzupełnij profil.</p>
          <label>Data urodzenia<input name="birthDate" type="date" style={input} /></label>
          <label>Szkoła<input name="school" style={input} /></label>
          <label>Telefon<input name="phone" style={input} /></label>
          <button type="submit" style={btn}>Dalej</button>
        </form>
      )}

      {step === 'guardian' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            await post('/guardian', {
              fullName: String(form.get('fullName')),
              phone: String(form.get('phone')),
              address: String(form.get('address')),
              ...(form.get('consent') === 'on' && {
                consentGivenAt: new Date().toISOString().slice(0, 10),
              }),
            });
            await finish();
          }}
        >
          <p>Krok 3 z 4 — dane rodzica/opiekuna.</p>
          <label>Imię i nazwisko<input name="fullName" required style={input} /></label>
          <label>Telefon<input name="phone" required style={input} /></label>
          <label>Adres<input name="address" required style={input} /></label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <input name="consent" type="checkbox" /> Rodzic wyraził zgodę na uczestnictwo
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={btn}>Dalej</button>
            <button type="button" onClick={() => void finish()} style={{ ...btn, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Pomiń — uzupełnimy później
            </button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <>
          <p>✅ Konto aktywne! Możesz się zalogować.</p>
          {consentStatus === 'MISSING' && (
            <p style={{ color: 'var(--warning)', fontSize: 14 }}>
              Pamiętaj: drużynowy poprosi o pozwolenie od rodzica na uczestnictwo w drużynie.
            </p>
          )}
          <a href="/" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>Przejdź do logowania</a>
        </>
      )}
    </main>
  );

  async function finish(): Promise<void> {
    const r = await post('/finish');
    if (r.ok) {
      const d = (await r.json()) as { consentStatus: string };
      setConsentStatus(d.consentStatus);
      setStep('done');
    }
  }
}
