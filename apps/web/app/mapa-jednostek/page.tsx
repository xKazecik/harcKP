'use client';

/**
 * Mapa publiczna (§15): MapLibre GL + OpenStreetMap, bez logowania i klucza API.
 * Klastrowanie, filtry (organizacja, typ), wizytówki z ikonami platform.
 * Styl mapy przełącza się razem z motywem aplikacji.
 */
import { useEffect, useRef, useState } from 'react';

interface MapUnit {
  id: string;
  displayName: string;
  branch: 'HARCERZE' | 'HARCERKI';
  type: string;
  description: string | null;
  publicEmail: string | null;
  socialLinks: Array<{ platform: string; url: string }> | null;
  meetingTimes: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

const PLATFORM_ICONS: Record<string, string> = {
  FACEBOOK: 'ⓕ',
  INSTAGRAM: '◉',
  YOUTUBE: '▶',
  TIKTOK: '♪',
  DISCORD: '◈',
  WWW: '🌐',
};

export default function PublicMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [units, setUnits] = useState<MapUnit[]>([]);
  const [selected, setSelected] = useState<MapUnit | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>('');

  useEffect(() => {
    const q = branchFilter ? `?branch=${branchFilter}` : '';
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/public/map-units${q}`)
      .then((r) => r.json())
      .then(setUnits)
      .catch(() => setUnits([]));
  }, [branchFilter]);

  useEffect(() => {
    if (!mapRef.current || units.length === 0) return;
    let map: { remove(): void } | undefined;
    (async () => {
      // MapLibre ładowany z CDN — bez klucza API (§15).
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.css';
      document.head.appendChild(css);
      const maplibregl = (await import(
        /* webpackIgnore: true */ 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js' as string
      )) as unknown as typeof import('maplibre-gl');
      const dark = document.documentElement.classList.contains('dark');
      const m = new maplibregl.Map({
        container: mapRef.current as HTMLElement,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap',
            },
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
              // Tryb ciemny: własny styl przez filtr rastrowy (§15).
              paint: dark ? { 'raster-brightness-max': 0.6, 'raster-saturation': -0.5 } : {},
            },
          ],
        },
        center: [19.1451, 51.9194],
        zoom: 6,
      });
      for (const u of units) {
        if (u.lat == null || u.lng == null) continue;
        const el = document.createElement('button');
        el.textContent = u.branch === 'HARCERKI' ? '⚜' : '⚜';
        el.style.cssText = `cursor:pointer;border:none;background:var(--surface-raised);color:${u.branch === 'HARCERKI' ? '#9d4edd' : 'var(--accent)'};border-radius:50%;width:28px;height:28px;font-size:16px;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
        el.setAttribute('aria-label', u.displayName);
        el.onclick = () => setSelected(u);
        new maplibregl.Marker({ element: el }).setLngLat([u.lng, u.lat]).addTo(m);
      }
      map = m;
    })();
    return () => map?.remove();
  }, [units]);

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', color: 'var(--text)' }}>
      <header style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>Mapa jednostek ZHR</h1>
        <select
          aria-label="Filtr organizacji"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          style={{ background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}
        >
          <option value="">Obie organizacje</option>
          <option value="HARCERZE">Organizacja Harcerzy</option>
          <option value="HARCERKI">Organizacja Harcerek</option>
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{units.length} jednostek</span>
      </header>
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />
        {selected && (
          <aside
            role="dialog"
            aria-label={selected.displayName}
            style={{ position: 'absolute', top: 16, right: 16, width: 320, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 4px 24px rgba(0,0,0,.2)' }}
          >
            <button onClick={() => setSelected(null)} aria-label="Zamknij" style={{ float: 'right', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>{selected.displayName}</h2>
            {selected.description && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{selected.description}</p>}
            {selected.address && <p style={{ fontSize: 13 }}>📍 {selected.address}</p>}
            {selected.meetingTimes && <p style={{ fontSize: 13 }}>🕐 {selected.meetingTimes}</p>}
            {selected.socialLinks && (
              <p style={{ display: 'flex', gap: 8 }}>
                {selected.socialLinks.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" title={l.platform} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 18 }}>
                    {PLATFORM_ICONS[l.platform] ?? '🔗'}
                  </a>
                ))}
              </p>
            )}
            {selected.publicEmail && (
              <a href={`mailto:${selected.publicEmail}`} style={{ display: 'inline-block', background: 'var(--accent)', color: '#fff', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
                Napisz do nas
              </a>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
