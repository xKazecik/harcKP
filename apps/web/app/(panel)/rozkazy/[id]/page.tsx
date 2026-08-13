/**
 * Rozkaz — kreator pozycji i publikacja (§11.2).
 *
 * Każda pozycja to wybór typu, podmiotu i szczegółów. Katalog typów odpowiada
 * tabeli z §11.2; kompetencję do konkretnego typu sprawdza API przy dodawaniu.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiSafe } from '../../../../lib/api';
import { getActiveUnitId } from '../../../../lib/context';
import { requireSession } from '../../../../lib/session';
import { addOrderItem, publishOrder } from '../../../actions';
import { ActionForm, Field, InlineAction, Select, TextArea } from '../../../components/action-form';
import { Alert, Card, DefinitionList, Empty, PageHeader, StatusBadge } from '../../../components/ui';
import { date } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

interface OrderDetail {
  id: string;
  unitId: string;
  number: string;
  issuedAt: string;
  place: string;
  status: string;
  contentText: string | null;
  items: Array<{
    id: string;
    section: string;
    type: string;
    subjectPersonId: string | null;
    subjectUnitId: string | null;
    payload: Record<string, unknown>;
    effectiveDate: string;
    reverted: boolean;
  }>;
}

/** Katalog typów pozycji rozkazu (§11.2) — etykiety dla kreatora. */
const ITEM_TYPES: Array<{ value: string; label: string }> = [
  { value: 'ADMIT_PARTICIPANT', label: 'Przyjęcie uczestnika' },
  { value: 'RELEASE_PARTICIPANT', label: 'Zwolnienie uczestnika' },
  { value: 'APPOINT_FUNCTION', label: 'Mianowanie na funkcję' },
  { value: 'DISMISS_FUNCTION', label: 'Zwolnienie z funkcji' },
  { value: 'AWARD_RANK', label: 'Przyznanie stopnia harcerskiego' },
  { value: 'AWARD_BADGE', label: 'Przyznanie sprawności' },
  { value: 'AWARD_ZUCH_STAR', label: 'Przyznanie gwiazdki zuchowej' },
  { value: 'OPEN_TRIAL', label: 'Otwarcie próby' },
  { value: 'CLOSE_TRIAL', label: 'Zamknięcie próby' },
  { value: 'EXTEND_TRIAL', label: 'Przedłużenie próby' },
  { value: 'DISCONTINUE_TRIAL', label: 'Umorzenie próby' },
  { value: 'ADMIT_TO_PROMISE', label: 'Dopuszczenie do Przyrzeczenia' },
  { value: 'RECORD_INSTRUCTOR_PLEDGE', label: 'Zobowiązanie Instruktorskie' },
  { value: 'COMMENDATION', label: 'Pochwała' },
  { value: 'DISCIPLINARY_PENALTY', label: 'Kara organizacyjna' },
  { value: 'FOUND_UNIT', label: 'Powołanie jednostki' },
  { value: 'DISSOLVE_UNIT', label: 'Rozwiązanie jednostki' },
  { value: 'RENAME_UNIT', label: 'Zmiana nazwy jednostki' },
  { value: 'OPEN_UNIT_PROBATION', label: 'Otwarcie okresu próbnego jednostki' },
  { value: 'CLOSE_UNIT_PROBATION', label: 'Zamknięcie okresu próbnego jednostki' },
  { value: 'APPOINT_UNIT_GUARDIAN', label: 'Powołanie opiekuna jednostki' },
  { value: 'ENROLL_ON_INSTRUCTOR_LIST', label: 'Wpis na listę instruktorów' },
  { value: 'REMOVE_FROM_INSTRUCTOR_LIST', label: 'Skreślenie z listy instruktorów' },
  { value: 'GRANT_INSTRUCTOR_LEAVE', label: 'Urlop instruktorski' },
  { value: 'AWARD_INSTRUCTOR_RANK', label: 'Przyznanie stopnia instruktorskiego' },
  { value: 'AWARD_CATEGORY', label: 'Przyznanie kategorii jednostce' },
  { value: 'APPOINT_CHAPTER', label: 'Powołanie kapituły' },
];

/** Domyślne sekcje rozkazu — zwyczajowe, edytowalne per jednostka (§11.1). */
const SECTIONS = [
  'Zarządzenia i informacje',
  'Wyjątki z rozkazów władz zwierzchnich',
  'Zmiany organizacyjne',
  'Mianowania i zwolnienia',
  'Stopnie i sprawności',
  'Pochwały i wyróżnienia',
  'Kary',
  'Sprawy różne',
];

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await apiSafe<OrderDetail | null>(`/orders/${id}`, null);
  if (!order) notFound();

  const session = await requireSession();
  const me = await apiSafe<{ units: Array<{ id: string; displayName: string }>; isSysadmin: boolean }>(
    `/directory/me?sub=${encodeURIComponent(session.sub)}`,
    { units: [], isSysadmin: false },
  );
  const canSeeAll = session.isRoot || me.isSysadmin;
  const units = canSeeAll
    ? await apiSafe<Array<{ id: string; displayName: string }>>('/directory/units', [])
    : me.units;
  const activeUnitId = (await getActiveUnitId(units as never)) ?? order.unitId;
  const members = await apiSafe<Array<{ id: string; firstName: string; lastName: string }>>(
    `/directory/units/${activeUnitId}/members`,
    [],
  );

  const isDraft = order.status === 'DRAFT';

  return (
    <>
      <PageHeader
        title={`Rozkaz ${order.number}`}
        subtitle={`${order.place}, ${date(order.issuedAt)}`}
        actions={
          <>
            <Link className="btn" href="/rozkazy">
              Wróć do listy
            </Link>
            {isDraft && (
              <InlineAction
                action={publishOrder}
                label="Opublikuj rozkaz"
                variant="primary"
                hidden={{ orderId: order.id }}
                confirm="Publikacja wywoła skutki ewidencyjne wszystkich pozycji i nie da się jej cofnąć edycją. Kontynuować?"
              />
            )}
          </>
        }
      />

      {!isDraft && (
        <Alert tone="info" title="Rozkaz opublikowany">
          Dokument organizacji nie podlega edycji. Błąd prostuje się osobnym rozkazem
          sprostowującym, który tworzy operacje kompensujące — historia pozostaje nienaruszona.
        </Alert>
      )}

      <div className="grid grid-2 mb-5">
        <Card title="Nagłówek">
          <DefinitionList
            items={[
              ['Numer', order.number],
              ['Data wydania', date(order.issuedAt)],
              ['Miejsce', order.place],
              ['Status', <StatusBadge key="s" dictionary="orderStatus" value={order.status} />],
              ['Pozycji', String(order.items.length)],
            ]}
          />
          {order.contentText && (
            <p className="small muted" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
              {order.contentText}
            </p>
          )}
        </Card>

        {isDraft && (
          <Card title="Dodaj pozycję">
            <ActionForm action={addOrderItem} submitLabel="Dodaj pozycję">
              <input type="hidden" name="orderId" value={order.id} />
              <Select
                name="section"
                label="Sekcja"
                required
                options={SECTIONS.map((s) => ({ value: s, label: s }))}
              />
              <Select name="type" label="Typ pozycji" required options={ITEM_TYPES} />
              <Select
                name="subjectPersonId"
                label="Osoba, której dotyczy"
                allowEmpty="— pozycja nie dotyczy osoby —"
                options={members.map((m) => ({
                  value: m.id,
                  label: `${m.lastName} ${m.firstName}`,
                }))}
              />
              <Field
                name="effectiveDate"
                label="Obowiązuje z dniem"
                type="date"
                required
                defaultValue={order.issuedAt.slice(0, 10)}
                hint="Data skutku może różnić się od daty samego rozkazu."
              />
              <TextArea name="note" label="Treść pozycji" rows={2} />
            </ActionForm>
          </Card>
        )}
      </div>

      <Card title="Pozycje rozkazu" bodyless>
        {order.items.length === 0 ? (
          <Empty
            icon="📋"
            title="Rozkaz nie ma jeszcze pozycji"
            hint="Każda pozycja tworzy wpis w dzienniku osobistym i dzienniku jednostki. Dodaj pozycje formularzem obok, a potem opublikuj rozkaz."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Sekcja</th>
                  <th>Typ</th>
                  <th>Dotyczy</th>
                  <th>Z dniem</th>
                  <th>Stan</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td className="small">{it.section}</td>
                    <td className="small">
                      {ITEM_TYPES.find((t) => t.value === it.type)?.label ?? it.type}
                      {typeof it.payload?.note === 'string' && (
                        <div className="xs muted">{it.payload.note}</div>
                      )}
                    </td>
                    <td className="small">
                      {it.subjectPersonId ? (
                        <Link href={`/czlonkowie/${it.subjectPersonId}`}>
                          {members.find((m) => m.id === it.subjectPersonId)
                            ? `${members.find((m) => m.id === it.subjectPersonId)!.lastName} ${members.find((m) => m.id === it.subjectPersonId)!.firstName}`
                            : 'osoba'}
                        </Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="small">{date(it.effectiveDate)}</td>
                    <td>
                      {it.reverted ? (
                        <span className="badge badge-warning">odwrócona</span>
                      ) : (
                        <span className="badge badge-success">obowiązuje</span>
                      )}
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
