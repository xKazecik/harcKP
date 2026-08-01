/**
 * Rozkazy jednostki (§11).
 *
 * Rozkaz jest dokumentem organizacji — nie da się go edytować po publikacji.
 * Błędy prostuje się osobnym rozkazem sprostowującym, który generuje operacje
 * kompensujące; historia nigdy nie jest kasowana.
 */
import { apiSafe } from '../../../lib/api';
import { requireSession } from '../../../lib/session';
import { getActiveUnitId } from '../../../lib/context';
import { Card, Empty, PageHeader, StatusBadge } from '../../components/ui';
import { date } from '../../../lib/format';

export const dynamic = 'force-dynamic';

interface Order {
  id: string;
  number: string;
  issuedAt: string;
  place: string;
  status: string;
  contentText: string | null;
  items?: Array<{ id: string }>;
}

export default async function OrdersPage() {
  const session = await requireSession();
  const me = await apiSafe<{ units: Array<{ id: string; displayName: string }>; isSysadmin: boolean }>(
    `/directory/me?sub=${encodeURIComponent(session.sub)}`,
    { units: [], isSysadmin: false },
  );
  const canSeeAll = session.isRoot || me.isSysadmin;
  const units = canSeeAll
    ? await apiSafe<Array<{ id: string; displayName: string }>>('/directory/units', [])
    : me.units;
  const activeUnitId = await getActiveUnitId(units as never);
  const unitName = units.find((u) => u.id === activeUnitId)?.displayName ?? '';

  const orders = activeUnitId
    ? await apiSafe<Order[]>(`/orders?unitId=${activeUnitId}`, [])
    : [];

  return (
    <>
      <PageHeader
        title="Rozkazy"
        subtitle={unitName}
        actions={
          activeUnitId && (
            <a className="btn btn-primary" href="/rozkazy/nowy">
              Nowy rozkaz
            </a>
          )
        }
      />

      <Card bodyless>
        {!activeUnitId ? (
          <Empty
            icon="📜"
            title="Wybierz jednostkę"
            hint="Rozkazy są numerowane per jednostka i rok. Wybierz jednostkę przełącznikiem kontekstu."
          />
        ) : orders.length === 0 ? (
          <Empty
            icon="📜"
            title="Jednostka nie wydała jeszcze rozkazu"
            hint="Rozkaz dokumentuje mianowania, przyjęcia, stopnie, sprawności, pochwały i kary. Utwórz szkic, dodaj do niego pozycje, a potem opublikuj — dopiero publikacja wywołuje skutki ewidencyjne."
            action={
              <a className="btn btn-primary" href="/rozkazy/nowy">
                Utwórz pierwszy rozkaz
              </a>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Numer</th>
                  <th>Data wydania</th>
                  <th>Miejsce</th>
                  <th className="num">Pozycje</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <a href={`/rozkazy/${o.id}`}>
                        <strong>{o.number}</strong>
                      </a>
                    </td>
                    <td className="small">{date(o.issuedAt)}</td>
                    <td className="small">{o.place}</td>
                    <td className="num">{o.items?.length ?? 0}</td>
                    <td>
                      <StatusBadge dictionary="orderStatus" value={o.status} />
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
