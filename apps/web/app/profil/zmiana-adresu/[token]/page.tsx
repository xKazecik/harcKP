'use client';

/**
 * Potwierdzenie zmiany adresu e-mail z linku (§9.6).
 *
 * Strona leży POZA grupą `(panel)`, bo link otwiera się w skrzynce — często
 * w przeglądarce bez aktywnej sesji. Autoryzacją jest sam token, a nie
 * ciasteczko: 32 losowe bajty, w bazie tylko jako hash, jednorazowy.
 *
 * Potwierdzenie odpalamy dopiero po kliknięciu przycisku, nie automatycznie
 * przy wejściu — skanery linków w bramkach pocztowych odwiedzają adresy
 * z wiadomości i potrafiłyby zużyć token bez wiedzy użytkownika.
 */
import Link from 'next/link';
import { use, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type State = 'ready' | 'working' | 'done' | 'error';

export default function ConfirmEmailChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, setState] = useState<State>('ready');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const box: React.CSSProperties = {
    maxWidth: 480,
    margin: '10vh auto',
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 32,
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

  async function confirm(): Promise<void> {
    setState('working');
    setError('');
    try {
      const res = await fetch(`${API}/public/email-change/${token}/confirm`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { code?: string } | null;
        setError(
          body?.code === 'EMAIL_ALREADY_IN_USE'
            ? 'Ten adres zdążył zostać zajęty przez inny aktywny profil. Zgłoś zmianę ponownie na inny adres.'
            : body?.code === 'IDENTITY_PROVIDER_UNAVAILABLE'
              ? 'Serwer logowania jest chwilowo niedostępny, więc nic nie zostało zmienione. Twój dotychczasowy adres nadal działa — spróbuj ponownie za chwilę, ten sam link jest wciąż ważny.'
              : 'Link jest nieprawidłowy albo stracił ważność. Zgłoś zmianę ponownie w swoim profilu.',
        );
        setState('error');
        return;
      }
      const data = (await res.json()) as { email: string };
      setEmail(data.email);
      setState('done');
    } catch {
      setError('Nie udało się połączyć z serwerem. Spróbuj ponownie.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <main style={box}>
        <h1 style={{ fontSize: 20 }}>✅ Adres zmieniony</h1>
        <p>
          Od teraz logujesz się adresem <strong>{email}</strong>. Wysłaliśmy na niego jeszcze
          jedną wiadomość z prośbą o weryfikację.
        </p>
        <Link href="/" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
          Przejdź do logowania
        </Link>
      </main>
    );
  }

  return (
    <main style={box}>
      <h1 style={{ fontSize: 20 }}>Potwierdź zmianę adresu e-mail</h1>
      <p style={{ color: 'var(--text-muted)' }}>
        Po potwierdzeniu będziesz logować się nowym adresem. Stary przestanie działać.
      </p>
      {error && (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <button style={btn} onClick={() => void confirm()} disabled={state === 'working'}>
        {state === 'working' ? 'Potwierdzanie…' : 'Potwierdzam zmianę'}
      </button>
    </main>
  );
}
