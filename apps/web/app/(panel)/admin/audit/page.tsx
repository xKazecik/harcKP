/**
 * Audit log (§18) — pełny, niemodyfikowalny rejestr z filtrowaniem.
 */
import { apiSafe } from '../../../../lib/api';
import { Card, Empty, PageHeader } from '../../../components/ui';
import { dateTime, orDash } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

interface AuditRow {
  id: string;
  occurredAt: string;
  actorPersonId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  payload: Record<string, unknown>;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; resourceType?: string }>;
}) {
  const { action, resourceType } = await searchParams;
  const q = new URLSearchParams();
  if (action) q.set('action', action);
  if (resourceType) q.set('resourceType', resourceType);

  const rows = await apiSafe<AuditRow[]>(
    `/admin/audit-log${q.toString() ? `?${q}` : ''}`,
    [],
  );

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`${rows.length} ostatnich zdarzeń`}
        actions={
          <a className="btn" href="/admin">
            Wróć do panelu
          </a>
        }
      />

      <form method="get" className="row mb-4">
        <input
          name="action"
          defaultValue={action ?? ''}
          placeholder="Akcja, np. PERSON_ARCHIVED"
          aria-label="Filtr akcji"
          style={{ maxWidth: 240 }}
        />
        <input
          name="resourceType"
          defaultValue={resourceType ?? ''}
          placeholder="Typ zasobu, np. Person"
          aria-label="Filtr typu zasobu"
          style={{ maxWidth: 220 }}
        />
        <button className="btn" type="submit">
          Filtruj
        </button>
        {(action || resourceType) && (
          <a className="btn btn-ghost" href="/admin/audit">
            Wyczyść
          </a>
        )}
      </form>

      <Card bodyless>
        {rows.length === 0 ? (
          <Empty
            icon="🧾"
            title={action || resourceType ? 'Brak zdarzeń dla tego filtra' : 'Audit log jest pusty'}
            hint={
              action || resourceType
                ? 'Zmień kryteria filtrowania. Nazwy akcji są zapisywane wielkimi literami, np. PERSON_ARCHIVED.'
                : 'Wpisy powstają automatycznie przy operacjach na danych: archiwizacji, przywracaniu, zmianie adresu, zmianie ustawień i eksportach danych osobowych.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Kiedy</th>
                  <th>Akcja</th>
                  <th>Zasób</th>
                  <th>Wykonawca</th>
                  <th>Szczegóły</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="small nowrap">{dateTime(r.occurredAt)}</td>
                    <td>
                      <code className="mono small">{r.action}</code>
                    </td>
                    <td className="small">
                      {r.resourceType}
                      {r.resourceId && (
                        <div className="xs muted mono">{r.resourceId.slice(0, 8)}…</div>
                      )}
                    </td>
                    <td className="small">
                      {r.actorPersonId ? (
                        <a href={`/czlonkowie/${r.actorPersonId}`}>
                          {r.actorPersonId.slice(0, 8)}…
                        </a>
                      ) : (
                        <span className="muted">system</span>
                      )}
                    </td>
                    <td className="xs muted" style={{ maxWidth: 340 }}>
                      <span className="truncate" style={{ display: 'block' }}>
                        {orDash(JSON.stringify(r.payload))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
