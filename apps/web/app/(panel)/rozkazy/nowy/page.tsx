/**
 * Kreator rozkazu — krok 1: nagłówek (§11.1).
 *
 * Numeracja jest per jednostka i rok, wg konfigurowalnego wzorca `L. {n}/{rok}`.
 * Po utworzeniu szkicu przechodzi się do mapowania pozycji.
 */
import Link from 'next/link';
import { apiSafe } from '../../../../lib/api';
import { requireSession } from '../../../../lib/session';
import { getActiveUnitId } from '../../../../lib/context';
import { createOrder } from '../../../actions';
import { ActionForm, Field, Select, TextArea } from '../../../components/action-form';
import { Alert, Card, PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
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

  const orders = activeUnitId
    ? await apiSafe<Array<{ number: string }>>(`/orders?unitId=${activeUnitId}`, [])
    : [];
  const year = new Date().getFullYear();
  const nextNumber = `L. ${orders.length + 1}/${year}`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Nowy rozkaz"
        subtitle="Krok 1 z 2 — nagłówek rozkazu"
        actions={
          <Link className="btn" href="/rozkazy">
            Wróć do listy
          </Link>
        }
      />

      <div className="grid grid-2">
        <Card>
          <ActionForm action={createOrder} submitLabel="Utwórz szkic i przejdź do pozycji">
            <Select
              name="unitId"
              label="Jednostka wydająca"
              required
              defaultValue={activeUnitId ?? undefined}
              options={units.map((u) => ({ value: u.id, label: u.displayName }))}
            />
            <div className="field-row">
              <Field
                name="number"
                label="Numer rozkazu"
                required
                defaultValue={nextNumber}
                hint="Licznik jest prowadzony osobno dla każdej jednostki i roku."
              />
              <Field name="issuedAt" label="Data wydania" type="date" required defaultValue={today} />
            </div>
            <Field name="place" label="Miejsce" required placeholder="np. Bydgoszcz" />
            <TextArea
              name="contentText"
              label="Treść wstępna"
              rows={4}
              hint="Opcjonalne. Możesz też wgrać gotowy PDF rozkazu i zmapować z niego pozycje."
            />
          </ActionForm>
        </Card>

        <div className="stack">
          <Alert tone="info" title="Szkic nie wywołuje skutków">
            Dopóki rozkaz jest szkicem, jego pozycje nic nie zmieniają w ewidencji. Skutki —
            wpisy w dzienniku osobistym i dzienniku jednostki, zmiany funkcji, przyznane stopnie —
            powstają dopiero przy publikacji.
          </Alert>
          <Alert tone="warning" title="Kto co może">
            Kreator sprawdza kompetencje przy każdej pozycji osobno. Hufcowy mianuje drużynowych,
            ale nie przybocznych ani zastępowych — to wyłączna kompetencja drużynowego. Stopnie
            instruktorskie są zastrzeżone dla poziomu chorągwi i wyżej.
          </Alert>
        </div>
      </div>
    </>
  );
}
