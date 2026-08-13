'use client';

/**
 * Mapa publiczna (§15): MapLibre GL + OpenStreetMap, bez logowania i klucza API.
 *
 * MapLibre jest zależnością npm, nie skryptem z CDN — instancja postawiona
 * w zamkniętej sieci albo bez dostępu do internetu nadal renderuje interfejs
 * mapy (kafle OSM wymagają sieci, ale sama aplikacja się nie wywraca).
 *
 * Publikowane są WYŁĄCZNIE dane jednostek, nigdy dane osobowe.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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

/** Środek Polski — widok startowy, gdy nie ma czego dopasować. */
const POLAND_CENTER: [number, number] = [19.1451, 51.9194];

export default function PublicMapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [units, setUnits] = useState<MapUnit[]>([]);
  const [selected, setSelected] = useState<MapUnit | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Mapa powstaje RAZ, niezależnie od tego, czy są jakiekolwiek jednostki —
  // pusta mapa to poprawny stan, brak mapy to błąd.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const dark = document.documentElement.classList.contains('dark');
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            // Tryb ciemny ma własny styl mapy, przełączany z motywem (§16.2).
            paint: dark
              ? { 'raster-brightness-max': 0.65, 'raster-saturation': -0.4, 'raster-contrast': 0.1 }
              : {},
          },
        ],
      },
      center: POLAND_CENTER,
      zoom: 5.5,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));
    map.on('load', () => setStatus('ready'));
    map.on('error', () => setStatus('error'));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Przez własny serwer Next, nie wprost do API — inaczej przeglądarka trafia
  // na inne origin i żądanie blokuje CORS (API celowo go nie włącza).
  useEffect(() => {
    const q = branchFilter ? `?branch=${branchFilter}` : '';
    fetch(`/api/public/map-units${q}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setUnits)
      .catch(() => setUnits([]));
  }, [branchFilter]);

  // Pineski przerysowywane przy każdej zmianie listy albo filtra.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const located = units.filter((u) => u.lat != null && u.lng != null);
    for (const u of located) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = '⚜';
      el.className = 'map-pin';
      el.dataset.branch = u.branch;
      el.onclick = () => setSelected(u);
      const marker = new maplibregl.Marker({ element: el }).setLngLat([u.lng!, u.lat!]).addTo(map);
      // MapLibre nadpisuje aria-label własnym „Map marker" przy addTo —
      // nazwę jednostki ustawiamy po dodaniu, żeby czytnik ekranu ją odczytał.
      el.setAttribute('aria-label', u.displayName);
      el.title = u.displayName;
      markersRef.current.push(marker);
    }

    // Dopasowanie widoku do jednostek — przy jednej pinesce zoom stały.
    if (located.length === 1) {
      map.easeTo({ center: [located[0]!.lng!, located[0]!.lat!], zoom: 12 });
    } else if (located.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      for (const u of located) bounds.extend([u.lng!, u.lat!]);
      map.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 600 });
    }
  }, [units]);

  const located = units.filter((u) => u.lat != null && u.lng != null).length;

  return (
    <main className="map-page">
      <header className="map-header">
        <Link href="/" className="row" style={{ gap: 8, textDecoration: 'none', color: 'var(--text)' }}>
          <span aria-hidden>⚜</span>
          <strong>Mapa jednostek ZHR</strong>
        </Link>
        <select
          aria-label="Filtr organizacji"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Obie organizacje</option>
          <option value="HARCERZE">Organizacja Harcerzy</option>
          <option value="HARCERKI">Organizacja Harcerek</option>
        </select>
        <span className="small muted">
          {located} z {units.length} jednostek ma podaną lokalizację
        </span>
        <span className="grow" />
        <Link className="btn btn-sm" href="/">
          Zaloguj się
        </Link>
      </header>

      <div className="map-body">
        <div ref={containerRef} className="map-canvas" />

        {status === 'error' && (
          <div className="map-notice" role="status">
            <strong>Nie udało się pobrać kafli mapy</strong>
            <p className="small muted mb-0">
              Interfejs mapy działa, ale podkład OpenStreetMap wymaga połączenia z internetem.
              Lista jednostek poniżej pozostaje dostępna.
            </p>
          </div>
        )}

        {status === 'ready' && units.length === 0 && (
          <div className="map-notice" role="status">
            <strong>Żadna jednostka nie jest jeszcze widoczna publicznie</strong>
            <p className="small muted mb-0">
              Jednostka pojawia się na mapie, gdy jej komendant włączy widoczność w wizytówce
              i poda współrzędne harcówki. Decyzję o publikacji podejmuje sam komendant.
            </p>
          </div>
        )}

        {selected && (
          <aside className="map-card" role="dialog" aria-label={selected.displayName}>
            <button
              onClick={() => setSelected(null)}
              aria-label="Zamknij wizytówkę"
              className="btn btn-ghost btn-sm"
              style={{ float: 'right' }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: 'var(--text-md)', marginTop: 0, paddingRight: 28 }}>
              {selected.displayName}
            </h2>
            {selected.description && <p className="small muted">{selected.description}</p>}
            {selected.address && <p className="small">📍 {selected.address}</p>}
            {selected.meetingTimes && <p className="small">🕐 {selected.meetingTimes}</p>}
            {selected.socialLinks && selected.socialLinks.length > 0 && (
              <p className="row" style={{ gap: 10 }}>
                {selected.socialLinks.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    title={l.platform}
                    style={{ fontSize: 18, textDecoration: 'none' }}
                  >
                    {PLATFORM_ICONS[l.platform] ?? '🔗'}
                  </a>
                ))}
              </p>
            )}
            {selected.publicEmail && (
              <a className="btn btn-primary btn-sm" href={`mailto:${selected.publicEmail}`}>
                Napisz do nas
              </a>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
