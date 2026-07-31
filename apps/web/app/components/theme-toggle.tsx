'use client';

/**
 * Przełącznik motywu (§16.2): trzy stany z etykietami tekstowymi (nie samą
 * ikoną). Zapis dwutorowy: localStorage natychmiast + Person.themePreference
 * po zalogowaniu (synchronizacja w warstwie sesji).
 */
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function apply(theme: Theme): void {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const saved = (localStorage.getItem('harc-theme') as Theme) ?? 'system';
    setTheme(saved);
    // Tryb system: reakcja na zmianę preferencji OS bez przeładowania.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if ((localStorage.getItem('harc-theme') ?? 'system') === 'system') apply('system');
    };
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  const change = (t: Theme): void => {
    setTheme(t);
    localStorage.setItem('harc-theme', t);
    apply(t);
  };

  return (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '2px 6px', display: 'inline-flex', gap: 4 }}>
      <legend style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 4px' }}>Motyw</legend>
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          onClick={() => change(t)}
          aria-pressed={theme === t}
          style={{
            background: theme === t ? 'var(--accent)' : 'transparent',
            color: theme === t ? '#fff' : 'var(--text)',
            border: 'none',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {t === 'light' ? 'Jasny' : t === 'dark' ? 'Ciemny' : 'Systemowy'}
        </button>
      ))}
    </fieldset>
  );
}
