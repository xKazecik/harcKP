'use client';

/**
 * Układ aplikacji (§16.3): lewy sidebar z przełącznikiem kontekstu jednostki,
 * górny pasek z breadcrumbem pełnej ścieżki hierarchii, wyszukiwaniem,
 * przełącznikiem motywu i menu profilu. Mobile: sidebar jako drawer.
 *
 * Komponent kliencki obsługuje wyłącznie interakcje (drawer, podświetlenie
 * aktywnej pozycji). Dane przychodzą z serwerowego layoutu — nie ma tu
 * żadnego fetcha ani decyzji o uprawnieniach.
 */
import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface Crumb {
  label: string;
  href?: string;
}

export function AppShell({
  children,
  groups,
  units,
  activeUnitId,
  breadcrumb = [],
  userName,
  isRoot = false,
}: {
  children: ReactNode;
  groups: NavGroup[];
  units: Array<{ id: string; displayName: string }>;
  activeUnitId: string | null;
  breadcrumb?: Crumb[];
  userName: string;
  isRoot?: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  /** Pozycja aktywna, gdy ścieżka jest nią albo leży poniżej niej. */
  const isActive = (href: string): boolean =>
    pathname === href || (href !== '/pulpit' && pathname.startsWith(`${href}/`));

  return (
    <div className="app">
      <nav
        className={`sidebar${drawerOpen ? ' open' : ''}`}
        aria-label="Nawigacja główna"
        id="nawigacja"
      >
        <a className="sidebar-brand" href="/pulpit">
          <span aria-hidden>⚜</span>
          <span>
            HARC
            <br />
            <small>pion wychowawczy ZHR</small>
          </span>
        </a>

        {units.length > 0 && (
          <form method="post" action="/api/context/unit" style={{ padding: 'var(--space-3)' }}>
            <input type="hidden" name="returnTo" value={pathname} />
            <label className="label xs" htmlFor="unit-switch" style={{ color: 'var(--text-subtle)' }}>
              AKTYWNA JEDNOSTKA
            </label>
            <select
              id="unit-switch"
              name="unitId"
              defaultValue={activeUnitId ?? undefined}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              style={{ marginTop: 4, fontSize: 'var(--text-sm)' }}
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
            <noscript>
              <button type="submit" className="btn btn-sm" style={{ marginTop: 6 }}>
                Przełącz
              </button>
            </noscript>
          </form>
        )}

        {groups.map((group) => (
          <div key={group.title}>
            <div className="sidebar-section">{group.title}</div>
            <div className="sidebar-nav">
              {group.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="nav-item"
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="nav-icon" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 'auto', padding: 'var(--space-3)' }}>
          <button
            className="btn btn-ghost btn-sm sidebar-close"
            onClick={() => setDrawerOpen(false)}
            style={{ width: '100%' }}
          >
            Zamknij menu
          </button>
        </div>
      </nav>

      {drawerOpen && (
        <div className="scrim" onClick={() => setDrawerOpen(false)} aria-hidden />
      )}

      <div className="main">
        <header className="topbar">
          <button
            className="btn btn-ghost btn-sm drawer-toggle"
            onClick={() => setDrawerOpen(true)}
            aria-label="Otwórz menu nawigacji"
            aria-expanded={drawerOpen}
            aria-controls="nawigacja"
          >
            ☰
          </button>

          <nav className="breadcrumb" aria-label="Ścieżka w hierarchii">
            {breadcrumb.map((c, i) => (
              <span key={`${c.label}-${i}`} className="row" style={{ gap: 'var(--space-2)' }}>
                {i > 0 && (
                  <span className="sep" aria-hidden>
                    ›
                  </span>
                )}
                {c.href && i < breadcrumb.length - 1 ? (
                  <a href={c.href}>{c.label}</a>
                ) : (
                  <span className="current">{c.label}</span>
                )}
              </span>
            ))}
          </nav>

          <form action="/szukaj" method="get" role="search">
            <input
              type="search"
              name="q"
              placeholder="Szukaj osoby lub jednostki…"
              aria-label="Wyszukiwanie globalne"
              style={{ width: 220, fontSize: 'var(--text-sm)' }}
            />
          </form>

          <ThemeToggle />

          <details style={{ position: 'relative' }}>
            <summary
              className="btn btn-sm"
              style={{ listStyle: 'none', cursor: 'pointer' }}
              aria-label="Menu profilu"
            >
              {userName}
              {isRoot && (
                <span className="badge badge-danger" style={{ marginLeft: 4 }}>
                  ROOT
                </span>
              )}
            </summary>
            <div
              className="card"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                minWidth: 190,
                zIndex: 30,
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="sidebar-nav" style={{ padding: 'var(--space-2)' }}>
                <a className="nav-item" href="/profil">
                  <span className="nav-icon" aria-hidden>
                    👤
                  </span>
                  Mój profil
                </a>
                <a className="nav-item" href="/dokumenty">
                  <span className="nav-icon" aria-hidden>
                    📚
                  </span>
                  Dokumentacja
                </a>
                <a className="nav-item" href="/api/auth/logout">
                  <span className="nav-icon" aria-hidden>
                    ⏻
                  </span>
                  Wyloguj
                </a>
              </div>
            </div>
          </details>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
