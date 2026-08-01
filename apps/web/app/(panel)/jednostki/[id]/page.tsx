/**
 * Podgląd dowolnej jednostki w strukturze — także spoza aktywnego kontekstu.
 */
import { notFound } from 'next/navigation';
import { apiSafe } from '../../../../lib/api';
import { Card, DefinitionList, Empty, PageHeader, Stat, StatusBadge } from '../../../components/ui';
import { text } from '../../../../lib/labels';

export const dynamic = 'force-dynamic';

interface UnitContext {
  unit: { id: string; type: string; branch: string; status: string; displayName: string; description: string | null; isPubliclyVisible: boolean };
  path: Array<{ id: string; displayName: string }>;
  children: Array<{ id: string; displayName: string; status: string; type: string }>;
  leadership: Array<{ personId: string; fullName: string; isActing: boolean }>;
  stats: {
    members: number;
    participants: number;
    instructors: number;
    childUnits: number;
    orders: number;
    averageAge: number | null;
    workPlanStatus: string | null;
    workPlanYear: string | null;
  };
}

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await apiSafe<UnitContext | null>(`/directory/units/${id}/context`, null);
  if (!ctx) notFound();

  return (
    <>
      <PageHeader
        title={ctx.unit.displayName}
        subtitle={[
          text('unitType', ctx.unit.type),
          text('branch', ctx.unit.branch),
          ctx.path.map((p) => p.displayName).join(' › '),
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <a className="btn" href="/jednostki">
            Wróć do struktury
          </a>
        }
      />

      <div className="grid grid-4 mb-5">
        <Stat label="Członkowie" value={ctx.stats.members} />
        <Stat label="Instruktorzy" value={ctx.stats.instructors} />
        <Stat label="Jednostki podległe" value={ctx.stats.childUnits} />
        <Stat label="Rozkazy" value={ctx.stats.orders} />
      </div>

      <div className="grid grid-2">
        <Card title="Informacje">
          <DefinitionList
            items={[
              ['Status', <StatusBadge key="s" dictionary="unitStatus" value={ctx.unit.status} />],
              ['Typ', text('unitType', ctx.unit.type)],
              ['Gałąź', <StatusBadge key="b" dictionary="branch" value={ctx.unit.branch} />],
              [
                'Plan pracy',
                ctx.stats.workPlanStatus ? (
                  <span key="w" className="row">
                    <StatusBadge dictionary="workPlanStatus" value={ctx.stats.workPlanStatus} />
                    <span className="xs muted">{ctx.stats.workPlanYear}</span>
                  </span>
                ) : (
                  '—'
                ),
              ],
              ['Na mapie publicznej', ctx.unit.isPubliclyVisible ? 'tak' : 'nie'],
              ['Opis', ctx.unit.description ?? '—'],
            ]}
          />
        </Card>

        <Card title="Kadra">
          {ctx.leadership.length === 0 ? (
            <Empty
              icon="🎖"
              title="Brak obsadzonej funkcji"
              hint="Funkcję komendanta obsadza jednostka nadrzędna rozkazem."
            />
          ) : (
            <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ctx.leadership.map((l) => (
                <li key={l.personId} className="spread">
                  <a href={`/czlonkowie/${l.personId}`}>{l.fullName}</a>
                  {l.isActing && <span className="badge badge-warning">p.o.</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {ctx.children.length > 0 && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <Card title="Jednostki podległe" bodyless>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Jednostka</th>
                    <th>Typ</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ctx.children.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <a href={`/jednostki/${c.id}`}>{c.displayName}</a>
                      </td>
                      <td className="small">{text('unitType', c.type)}</td>
                      <td>
                        <StatusBadge dictionary="unitStatus" value={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
