import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'HARC',
  description: 'System wsparcia metodycznego pionu wychowawczego ZHR',
};

/**
 * Skrypt anty-FOUC (§16.2): ustawia klasę .dark PRZED pierwszym malowaniem.
 * Kolejność: localStorage → prefers-color-scheme (tryb system).
 * Po zalogowaniu wartość z Person.themePreference synchronizuje localStorage.
 */
const themeInitScript = `
(function () {
  try {
    var pref = localStorage.getItem('harc-theme') || 'system';
    var dark =
      pref === 'dark' ||
      (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
