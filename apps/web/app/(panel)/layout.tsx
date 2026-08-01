/**
 * Layout części zalogowanej — brama uwierzytelnienia i kontekst jednostki.
 *
 * Każda strona w grupie `(panel)` wymaga sesji. Sprawdzenie jest tutaj, żeby
 * pojedyncza strona nie mogła o nim zapomnieć.
 */
import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session';
import { apiSafe } from '../../lib/api';
import { getActiveUnitId } from '../../lib/context';
import { AppShell, type NavGroup } from '../components/app-shell';

export const dynamic = 'force-dynamic';

interface MeResponse {
  person: { id: string; firstName: string; lastName: string } | null;
  isSysadmin: boolean;
  units: Array<{ id: string; displayName: string; type: string; branch: string }>;
}

interface UnitRow {
  id: string;
  displayName: string;
  type: string;
  branch: string;
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/');

  const me = await apiSafe<MeResponse>(`/directory/me?sub=${encodeURIComponent(session.sub)}`, {
    person: null,
    isSysadmin: false,
    units: [],
  });

  // ROOT i sysadmin pracują w kontekście dowolnej jednostki (§10.1); funkcyjny
  // widzi wyłącznie te, w których pełni funkcję albo jest członkiem.
  const canSeeAll = session.isRoot || me.isSysadmin;
  const allUnits = canSeeAll ? await apiSafe<UnitRow[]>('/directory/units', []) : [];
  const units = canSeeAll ? allUnits : me.units;
  const activeUnitId = await getActiveUnitId(units);

  const groups: NavGroup[] = [
    {
      title: 'Praca bieżąca',
      items: [
        { label: 'Pulpit', href: '/pulpit', icon: '▦' },
        { label: 'Jednostka', href: '/jednostka', icon: '⌂' },
        { label: 'Członkowie', href: '/czlonkowie', icon: '👥' },
        { label: 'Progresja', href: '/progresja', icon: '★' },
        { label: 'Rozkazy', href: '/rozkazy', icon: '📜' },
      ],
    },
    {
      title: 'Planowanie',
      items: [
        { label: 'Plan pracy', href: '/plan-pracy', icon: '🗓' },
        { label: 'Spis', href: '/spis', icon: '📋' },
        { label: 'Kategoryzacja', href: '/kategoryzacja', icon: '🏕' },
      ],
    },
    {
      title: 'Struktura',
      items: [
        { label: 'Jednostki', href: '/jednostki', icon: '🌳' },
        { label: 'Instruktorzy', href: '/instruktorzy', icon: '⚜' },
        { label: 'Mapa publiczna', href: '/mapa-jednostek', icon: '🗺' },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'Panel admina', href: '/admin', icon: '⚙' },
        { label: 'Dokumentacja', href: '/dokumenty', icon: '📚' },
      ],
    },
  ];

  const userName = me.person
    ? `${me.person.firstName} ${me.person.lastName}`
    : (session.name ?? session.email ?? 'Użytkownik');

  // Breadcrumb pokazuje PEŁNĄ ścieżkę aktywnej jednostki w hierarchii (§16.3):
  // Organizacja → Chorągiew → Hufiec → Drużyna.
  const breadcrumb: Array<{ label: string; href?: string }> = [
    { label: 'HARC', href: '/pulpit' },
  ];
  if (activeUnitId) {
    const ctx = await apiSafe<{
      unit: { displayName: string };
      path: Array<{ id: string; displayName: string }>;
    } | null>(`/directory/units/${activeUnitId}/context`, null);
    if (ctx) {
      for (const p of ctx.path) breadcrumb.push({ label: p.displayName, href: `/jednostki/${p.id}` });
      breadcrumb.push({ label: ctx.unit.displayName });
    }
  }

  return (
    <AppShell
      groups={groups}
      units={units.map((u) => ({ id: u.id, displayName: u.displayName }))}
      activeUnitId={activeUnitId}
      userName={userName}
      isRoot={session.isRoot}
      breadcrumb={breadcrumb}
    >
      {children}
    </AppShell>
  );
}
