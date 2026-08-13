/**
 * Pulpit — punkt startowy po zalogowaniu.
 *
 * Łączy dwa spojrzenia: stan aktywnej jednostki (kolejka „do zatwierdzenia",
 * kadra, plan pracy) oraz liczby całej struktury (§12.5). Widok zagregowany
 * operuje wyłącznie na licznikach — bez danych osobowych (§17).
 */
import Link from 'next/link';
import { apiSafe } from '../../../lib/api';
import { requireSession } from '../../../lib/session';
import { getActiveUnitId } from '../../../lib/context';
import { Alert, Card, Empty, PageHeader, Stat, StatusBadge } from '../../components/ui';
import { plural, scoutingYear } from '../../../lib/format';

export const dynamic = 'force-dynamic';

interface Overview {
  totalUnits: number;
  unitsByType: Record<string, number>;
  totalPeople: number;
  peopleByCategory: Record<string, number>;
  totalInstructors: number;
  instructorsByRank: Record<string, number>;
  orders: number;
  pendingInvitations: number;
  pendingRequirements: number;
  openDisciplinaryCases: number;
  publicUnits: number;
}

interface UnitContext {
  unit: { id: string; displayName: string; type: string; status: string };
  path: Array<{ id: string; displayName: string }>;
  children: Array<{ id: string; displayName: string; status: string }>;
  leadership: Array<{ personId: string; fullName: string; isActing: boolean; guardianInstructorId: string | null }>;
  stats: {
    members: number;
    participants: number;
    instructors: number;
    seniorScouts: number;
    childUnits: number;
    orders: number;
    pendingRequirements: number;
    averageAge: number | null;
    workPlanStatus: string | null;
    workPlanYear: string | null;
  };
}

export default async function DashboardPage() {
  const session = await requireSession();
  const me = await apiSafe<{ person: { firstName: string } | null; units: Array<{ id: string; displayName: string }>; isSysadmin: boolean }>(
    `/directory/me?sub=${encodeURIComponent(session.sub)}`,
    { person: null, units: [], isSysadmin: false },
  );

  const canSeeAll = session.isRoot || me.isSysadmin;
  const units = canSeeAll
    ? await apiSafe<Array<{ id: string; displayName: string; type: string; branch: string }>>('/directory/units', [])
    : me.units.map((u) => ({ ...u, type: '', branch: '' }));
  const activeUnitId = await getActiveUnitId(units as never);

  const [overview, ctx] = await Promise.all([
    apiSafe<Overview | null>('/directory/overview', null),
    activeUnitId
      ? apiSafe<UnitContext | null>(`/directory/units/${activeUnitId}/context`, null)
      : Promise.resolve(null),
  ]);

  const greeting = me.person?.firstName ? `Czuwaj, ${me.person.firstName}!` : 'Czuwaj!';

  return (
    <>
      <PageHeader
        title={greeting}
        subtitle={`Rok harcerski ${scoutingYear()}${ctx ? ` · ${ctx.unit.displayName}` : ''}`}
        actions={
          ctx && (
            <>
              <Link className="btn" href="/czlonkowie">
                Członkowie
              </Link>
              <Link className="btn btn-primary" href="/rozkazy/nowy">
                Nowy rozkaz
              </Link>
            </>
          )
        }
      />

      {!me.person && (
        <Alert tone="warning" title="Twoje konto nie ma jeszcze profilu w ewidencji">
          Zalogowałeś się poprawnie, ale w bazie HARC nie ma powiązanego profilu osoby.
          Uprawnienia funkcyjne wynikają z rozkazów przypiętych do profilu, więc do czasu
          jego utworzenia widzisz tylko dane ogólne. Administrator zakłada profil poleceniem{' '}
          <code className="mono">pnpm --filter @harc/db run bootstrap</code>.
        </Alert>
      )}

      {ctx ? (
        <>
          <div className="grid grid-4 mb-5">
            <Stat
              label="Członkowie jednostki"
              value={ctx.stats.members}
              hint={`${ctx.stats.participants} ${plural(ctx.stats.participants, 'uczestnik', 'uczestników', 'uczestników')}, ${ctx.stats.instructors} instr.`}
              href="/czlonkowie"
            />
            <Stat
              label="Do zatwierdzenia"
              value={ctx.stats.pendingRequirements}
              hint="zgłoszenia zadań od harcerzy"
              href="/progresja"
            />
            <Stat
              label="Jednostki podległe"
              value={ctx.stats.childUnits}
              hint={ctx.stats.childUnits === 0 ? 'brak jednostek niżej' : 'w strukturze'}
              href="/jednostki"
            />
            <Stat
              label="Średni wiek"
              value={ctx.stats.averageAge ?? '—'}
              hint={ctx.stats.averageAge ? 'lat w jednostce' : 'brak dat urodzenia'}
            />
          </div>

          <div className="grid grid-2 mb-5">
            <Card
              title="Kadra jednostki"
              action={
                <Link className="btn btn-sm" href="/jednostka">
                  Szczegóły jednostki
                </Link>
              }
            >
              {ctx.leadership.length === 0 ? (
                <Empty
                  icon="🎖"
                  title="Jednostka nie ma obsadzonej funkcji komendanta"
                  hint="Komendanta mianuje jednostka nadrzędna rozkazem. Do tego czasu jednostka działa bez kadry, co blokuje akcje wymagające kompetencji funkcyjnego."
                  action={
                    <Link className="btn btn-primary" href="/rozkazy/nowy">
                      Wydaj rozkaz mianowania
                    </Link>
                  }
                />
              ) : (
                <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {ctx.leadership.map((l) => (
                    <li key={l.personId} className="spread">
                      <Link href={`/czlonkowie/${l.personId}`}>{l.fullName}</Link>
                      <span className="row">
                        {l.isActing && <span className="badge badge-warning">p.o.</span>}
                        {l.isActing && !l.guardianInstructorId && (
                          <span className="badge badge-danger">brak opiekuna</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Plan pracy"
              action={
                <Link className="btn btn-sm" href="/plan-pracy">
                  Otwórz
                </Link>
              }
            >
              {ctx.stats.workPlanStatus ? (
                <div className="stack-sm">
                  <div className="spread">
                    <span className="muted">Rok {ctx.stats.workPlanYear}</span>
                    <StatusBadge dictionary="workPlanStatus" value={ctx.stats.workPlanStatus} />
                  </div>
                  <p className="small muted mb-0">
                    Plan pracy drużyny zatwierdza hufcowy. Po zatwierdzeniu powstaje
                    niezmienialna kopia PDF.
                  </p>
                </div>
              ) : (
                <Empty
                  icon="🗓"
                  title="Brak planu pracy na ten rok harcerski"
                  hint="Plan obejmuje cele, kalendarium, planowany obóz i pole służby. Bez złożonego planu jednostka nie może przystąpić do kategoryzacji."
                  action={
                    <Link className="btn btn-primary" href="/plan-pracy">
                      Rozpocznij plan
                    </Link>
                  }
                />
              )}
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <Empty
            icon="⌂"
            title="Nie masz jeszcze kontekstu jednostki"
            hint="Kontekst pojawia się, gdy pełnisz funkcję w jednostce albo jesteś jej członkiem. Administrator systemu widzi wszystkie jednostki po ich utworzeniu."
            action={
              <Link className="btn btn-primary" href="/jednostki/nowa">
                Utwórz jednostkę
              </Link>
            }
          />
        </Card>
      )}

      {overview && (
        <Card title="Cała struktura w liczbach">
          <div className="grid grid-4">
            <Stat label="Jednostki" value={overview.totalUnits} href="/jednostki" />
            <Stat
              label="Osoby w ewidencji"
              value={overview.totalPeople}
              hint={`${overview.peopleByCategory.UCZESTNIK ?? 0} uczestników`}
            />
            <Stat
              label="Instruktorzy"
              value={overview.totalInstructors}
              hint={`${overview.instructorsByRank.HARCMISTRZ ?? 0} hm · ${overview.instructorsByRank.PODHARCMISTRZ ?? 0} phm · ${overview.instructorsByRank.PRZEWODNIK ?? 0} pwd`}
              href="/instruktorzy"
            />
            <Stat label="Rozkazy" value={overview.orders} href="/rozkazy" />
            <Stat
              label="Zaproszenia oczekujące"
              value={overview.pendingInvitations}
              href="/admin/zaproszenia"
            />
            <Stat
              label="Zgłoszenia do oceny"
              value={overview.pendingRequirements}
              href="/progresja"
            />
            <Stat
              label="Sprawy dyscyplinarne"
              value={overview.openDisciplinaryCases}
              hint="w toku"
            />
            <Stat
              label="Jednostki na mapie"
              value={overview.publicUnits}
              hint="widoczne publicznie"
              href="/mapa-jednostek"
            />
          </div>
        </Card>
      )}
    </>
  );
}
