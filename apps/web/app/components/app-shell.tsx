'use client';

/**
 * Układ aplikacji (§16.3): lewy sidebar z przełącznikiem kontekstu jednostki,
 * górny pasek z breadcrumbem pełnej ścieżki hierarchii i przełącznikiem motywu.
 * Mobile: sidebar jako drawer.
 */
import { useState, type ReactNode } from 'react';
import { ThemeToggle } from './theme-toggle';

const SECTIONS = [
  { label: 'Jednostka', href: '/jednostka' },
  { label: 'Członkowie', href: '/czlonkowie' },
  { label: 'Progresja', href: '/progresja' },
  { label: 'Rozkazy', href: '/rozkazy' },
  { label: 'Plan pracy', href: '/plan-pracy' },
  { label: 'Dokumenty', href: '/dokumenty' },
  { label: 'Kalendarz', href: '/kalendarz' },
];

export function AppShell({
  children,
  breadcrumb = [],
  units = [],
  activeUnitId,
  onUnitChange,
}: {
  children: ReactNode;
  breadcrumb?: string[];
  units?: Array<{ id: string; displayName: string }>;
  activeUnitId?: string;
  onUnitChange?: (unitId: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sidebar = (
    <nav aria-label="Nawigacja główna" style={{ width: 240, background: 'var(--surface-raised)', borderRight: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Aktywna jednostka
        <select
          value={activeUnitId}
          onChange={(e) => onUnitChange?.(e.target.value)}
          style={{ width: '100%', marginTop: 4, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 6 }}
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName}</option>
          ))}
        </select>
      </label>
      {SECTIONS.map((s) => (
        <a key={s.href} href={s.href} style={{ color: 'var(--text)', textDecoration: 'none', padding: '8px 10px', borderRadius: 8, fontSize: 14 }}>
          {s.label}
        </a>
      ))}
    </nav>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface)', color: 'var(--text)' }}>
      <div className="harc-sidebar-desktop">{sidebar}</div>
      {drawerOpen && (
        <div role="dialog" aria-modal style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          {sidebar}
          <div onClick={() => setDrawerOpen(false)} style={{ flex: 1, background: 'rgba(0,0,0,.4)' }} />
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <button className="harc-drawer-btn" onClick={() => setDrawerOpen(true)} aria-label="Otwórz menu" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 10px', cursor: 'pointer' }}>☰</button>
          <nav aria-label="Ścieżka" style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>
            {breadcrumb.join(' → ')}
          </nav>
          <input type="search" placeholder="Szukaj…" aria-label="Wyszukiwanie globalne" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text)' }} />
          <ThemeToggle />
        </header>
        <main style={{ flex: 1, padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}
