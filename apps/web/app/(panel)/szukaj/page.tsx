/**
 * Wyszukiwanie globalne (§16.3) — osoby w aktywnej jednostce i jednostki.
 */
import Link from 'next/link';
import { apiSafe } from '../../../lib/api';
import { requireSession } from '../../../lib/session';
import { getActiveUnitId } from '../../../lib/context';
import { Card, Empty, PageHeader, StatusBadge } from '../../components/ui';
import { text } from '../../../lib/labels';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const needle = (q ?? '').trim().toLowerCase();

  const session = await requireSession();
  const me = await apiSafe<{ units: Array<{ id: string; displayName: string }>; isSysadmin: boolean }>(
    `/directory/me?sub=${encodeURIComponent(session.sub)}`,
    { units: [], isSysadmin: false },
  );
  const canSeeAll = session.isRoot || me.isSysadmin;
  const units = canSeeAll
    ? await apiSafe<Array<{ id: string; displayName: string; type: string; branch: string; status: string }>>(
        '/directory/units',
        [],
      )
    : (me.units as never[]);
  const activeUnitId = await getActiveUnitId(units as never);

  const members = needle && activeUnitId
    ? await apiSafe<Array<{ id: string; firstName: string; lastName: string; membershipCategory: string }>>(
        `/directory/units/${activeUnitId}/members?q=${encodeURIComponent(needle)}`,
        [],
      )
    : [];

  const matchedUnits = needle
    ? units.filter((u) => u.displayName.toLowerCase().includes(needle))
    : [];

  const nothing = needle && members.length === 0 && matchedUnits.length === 0;

  return (
    <>
      <PageHeader
        title="Wyszukiwanie"
        subtitle={needle ? `Wyniki dla „${q}”` : 'Wpisz frazę w pasku u góry'}
      />

      {!needle ? (
        <Card>
          <Empty
            icon="🔍"
            title="Podaj czego szukasz"
            hint="Wyszukiwanie obejmuje osoby z aktywnej jednostki oraz nazwy jednostek w całej strukturze. Wpisz nazwisko albo fragment nazwy jednostki."
          />
        </Card>
      ) : nothing ? (
        <Card>
          <Empty
            icon="🔍"
            title="Brak wyników"
            hint="Sprawdź pisownię albo przełącz kontekst jednostki — lista osób jest przeszukiwana w obrębie aktywnej jednostki, nie całej struktury."
          />
        </Card>
      ) : (
        <div className="grid grid-2">
          {members.length > 0 && (
            <Card title={`Osoby (${members.length})`} bodyless>
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <Link href={`/czlonkowie/${m.id}`}>
                            {m.lastName} {m.firstName}
                          </Link>
                        </td>
                        <td>
                          <StatusBadge
                            dictionary="membershipCategory"
                            value={m.membershipCategory}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {matchedUnits.length > 0 && (
            <Card title={`Jednostki (${matchedUnits.length})`} bodyless>
              <div className="table-wrap">
                <table className="data">
                  <tbody>
                    {matchedUnits.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <Link href={`/jednostki/${u.id}`}>{u.displayName}</Link>
                        </td>
                        <td className="small muted">{text('unitType', u.type)}</td>
                        <td>
                          <StatusBadge dictionary="unitStatus" value={u.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
