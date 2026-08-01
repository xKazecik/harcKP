/**
 * Struktura organizacyjna — drzewo jednostek obu gałęzi (§6.1).
 *
 * Drzewo buduje się z pola `parentId`; jednostki poziome (szczep, kręgi) nie
 * mają podległości i pojawiają się w gałęzi swojego rodzica.
 */
import { apiSafe } from '../../../lib/api';
import { Card, Empty, PageHeader, StatusBadge } from '../../components/ui';
import { text } from '../../../lib/labels';

export const dynamic = 'force-dynamic';

interface UnitRow {
  id: string;
  type: string;
  branch: string;
  parentId: string | null;
  status: string;
  displayName: string;
  isPubliclyVisible: boolean;
}

/** Rekurencyjne renderowanie poddrzewa. */
function Branch({ units, parentId }: { units: UnitRow[]; parentId: string | null }) {
  const children = units.filter((u) => u.parentId === parentId);
  if (children.length === 0) return null;
  return (
    <ul className={parentId === null ? 'tree' : undefined}>
      {children.map((u) => (
        <li key={u.id}>
          <a className="tree-node" href={`/jednostki/${u.id}`}>
            <span>{u.displayName}</span>
            <StatusBadge dictionary="unitStatus" value={u.status} />
            {u.isPubliclyVisible && (
              <span className="badge badge-info" title="Widoczna na mapie publicznej">
                mapa
              </span>
            )}
          </a>
          <Branch units={units} parentId={u.id} />
        </li>
      ))}
    </ul>
  );
}

export default async function UnitsPage() {
  const units = await apiSafe<UnitRow[]>('/directory/units', []);
  const roots = units.filter((u) => u.parentId === null);

  return (
    <>
      <PageHeader
        title="Struktura organizacyjna"
        subtitle={`${units.length} jednostek w obu organizacjach`}
        actions={
          <a className="btn btn-primary" href="/jednostki/nowa">
            Nowa jednostka
          </a>
        }
      />

      {units.length === 0 ? (
        <Card>
          <Empty
            icon="🌳"
            title="Struktura jest pusta"
            hint="Drzewo zaczyna się od jednostek korzeniowych (Organizacja Harcerek i Organizacja Harcerzy). Tworzy je skrypt bootstrapowy przy instalacji; kolejne poziomy zakłada się rozkazem właściwej jednostki."
            action={
              <a className="btn btn-primary" href="/jednostki/nowa">
                Utwórz jednostkę
              </a>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-2">
          {roots.map((root) => (
            <Card key={root.id} title={root.displayName}>
              <a className="tree-node" href={`/jednostki/${root.id}`}>
                <strong>{root.displayName}</strong>
                <StatusBadge dictionary="unitStatus" value={root.status} />
              </a>
              <Branch units={units} parentId={root.id} />
              {units.filter((u) => u.parentId === root.id).length === 0 && (
                <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
                  Brak jednostek podległych. Chorągiew powołuje Naczelnik(czka), hufce —
                  komendant chorągwi, drużyny i gromady — hufcowy.
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'var(--space-5)' }}>
        <Card title="Wszystkie jednostki" bodyless>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Jednostka</th>
                  <th>Typ</th>
                  <th>Gałąź</th>
                  <th>Status</th>
                  <th>Mapa</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <a href={`/jednostki/${u.id}`}>{u.displayName}</a>
                    </td>
                    <td className="small">{text('unitType', u.type)}</td>
                    <td>
                      <StatusBadge dictionary="branch" value={u.branch} />
                    </td>
                    <td>
                      <StatusBadge dictionary="unitStatus" value={u.status} />
                    </td>
                    <td className="small muted">{u.isPubliclyVisible ? 'widoczna' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
