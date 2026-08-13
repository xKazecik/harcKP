/**
 * Aktywna jednostka: skład, kadra, jednostki podległe i wizytówka publiczna.
 *
 * Wizytówkę (§15) redaguje komendant w dowolnym momencie — nie tylko przy
 * planie pracy — i sam decyduje o publikacji, bez akceptacji jednostki
 * nadrzędnej. Publikowane są WYŁĄCZNIE dane jednostki, nigdy dane osobowe.
 */
import Link from 'next/link';
import { apiSafe } from '../../../lib/api';
import { requireSession } from '../../../lib/session';
import { getActiveUnitId } from '../../../lib/context';
import { updateUnitCard } from '../../actions';
import { ActionForm, Checkbox, Field, Select, TextArea } from '../../components/action-form';
import { Card, DefinitionList, Empty, PageHeader, Stat, StatusBadge } from '../../components/ui';
import { text } from '../../../lib/labels';

export const dynamic = 'force-dynamic';

interface UnitContext {
  unit: {
    id: string;
    type: string;
    branch: string;
    status: string;
    displayName: string;
    level: string;
    number: string | null;
    localityName: string;
    properName: string | null;
    patron: string | null;
    description: string | null;
    publicEmail: string | null;
    isPubliclyVisible: boolean;
    locationPrecision: string;
    meetingPlace: { lat?: number; lng?: number; address?: string; meetingTimes?: string } | null;
  };
  path: Array<{ id: string; displayName: string }>;
  children: Array<{ id: string; displayName: string; status: string; type: string }>;
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
  };
}

export default async function UnitPage() {
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

  const ctx = activeUnitId
    ? await apiSafe<UnitContext | null>(`/directory/units/${activeUnitId}/context`, null)
    : null;

  if (!ctx) {
    return (
      <>
        <PageHeader title="Jednostka" />
        <Card>
          <Empty
            icon="⌂"
            title="Brak aktywnej jednostki"
            hint="Wybierz jednostkę przełącznikiem w lewym panelu albo utwórz pierwszą jednostkę w strukturze."
            action={
              <Link className="btn btn-primary" href="/jednostki/nowa">
                Utwórz jednostkę
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const u = ctx.unit;
  const place = u.meetingPlace ?? {};

  return (
    <>
      <PageHeader
        title={u.displayName}
        subtitle={`${text('unitType', u.type)} · ${text('branch', u.branch)}`}
        actions={
          <>
            <Link className="btn" href="/czlonkowie">
              Skład jednostki
            </Link>
            <Link className="btn" href="/rozkazy">
              Rozkazy
            </Link>
          </>
        }
      />

      <div className="grid grid-4 mb-5">
        <Stat label="Członkowie" value={ctx.stats.members} href="/czlonkowie" />
        <Stat label="Uczestnicy" value={ctx.stats.participants} />
        <Stat label="Instruktorzy" value={ctx.stats.instructors} href="/instruktorzy" />
        <Stat label="Jednostki podległe" value={ctx.stats.childUnits} href="/jednostki" />
      </div>

      <div className="grid grid-2 mb-5">
        <Card title="Dane jednostki">
          <DefinitionList
            items={[
              ['Status', <StatusBadge key="s" dictionary="unitStatus" value={u.status} />],
              ['Typ', text('unitType', u.type)],
              ['Poziom w regułach', <code key="l" className="mono">{u.level}</code>],
              ['Numer', u.number ?? '—'],
              ['Przymiotnik miejscowy', u.localityName || '—'],
              ['Nazwa własna', u.properName ?? '—'],
              ['Patron', u.patron ?? '—'],
            ]}
          />
          <p className="xs muted" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
            Nazwa wyświetlana jest generowana ze składowych — nie da się jej wpisać ręcznie.
            Aliasy statutowe (Namiestnictwo = Chorągiew, Związek Drużyn = Hufiec) są traktowane
            w regułach identycznie, co widać w polu „poziom w regułach”.
          </p>
        </Card>

        <Card title="Kadra">
          {ctx.leadership.length === 0 ? (
            <Empty
              icon="🎖"
              title="Brak obsadzonej funkcji"
              hint="Komendanta mianuje jednostka nadrzędna rozkazem. Do tego czasu jednostka nie ma kto reprezentować w akcjach wymagających kompetencji funkcyjnego."
            />
          ) : (
            <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ctx.leadership.map((l) => (
                <li key={l.personId} className="spread">
                  <Link href={`/czlonkowie/${l.personId}`}>{l.fullName}</Link>
                  <span className="row" style={{ gap: 4 }}>
                    {l.isActing && <span className="badge badge-warning">p.o.</span>}
                    {l.isActing && !l.guardianInstructorId && (
                      <span className="badge badge-danger">wymaga opiekuna</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {ctx.leadership.some((l) => l.isActing) && (
            <p className="xs muted" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
              Jednostkę prowadzi p.o. — kompetencje wymagające pełnoletności są niedostępne
              i wymagają kontrasygnaty opiekuna jednostki.
            </p>
          )}
        </Card>
      </div>

      {ctx.children.length > 0 && (
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
                      <Link href={`/jednostki/${c.id}`}>{c.displayName}</Link>
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
      )}

      <div style={{ marginTop: 'var(--space-5)' }}>
        <Card title="Wizytówka publiczna">
          <ActionForm
            action={updateUnitCard}
            submitLabel="Zapisz wizytówkę"
            successHint="Zmiany są widoczne na mapie natychmiast."
          >
            <input type="hidden" name="unitId" value={u.id} />
            <TextArea
              name="description"
              label="Opis jednostki"
              rows={3}
              defaultValue={u.description ?? ''}
              hint="Widoczny publicznie. Nie umieszczaj tu danych osobowych — mapa pokazuje wyłącznie dane jednostki."
            />
            <div className="field-row">
              <Field
                name="publicEmail"
                label="Kontaktowy e-mail"
                type="email"
                defaultValue={u.publicEmail ?? ''}
              />
              <Field
                name="meetingTimes"
                label="Terminy zbiórek"
                defaultValue={place.meetingTimes ?? ''}
                placeholder="np. Piątki 18:00–20:00"
              />
            </div>
            <Field
              name="address"
              label="Adres harcówki"
              defaultValue={place.address ?? ''}
              placeholder="ul. Harcerska 4, Bydgoszcz"
            />
            <div className="field-row">
              <Field
                name="lat"
                label="Szerokość geograficzna"
                type="number"
                defaultValue={place.lat ?? ''}
                hint="np. 53.1235"
              />
              <Field
                name="lng"
                label="Długość geograficzna"
                type="number"
                defaultValue={place.lng ?? ''}
                hint="np. 18.0084"
              />
            </div>
            <Select
              name="locationPrecision"
              label="Dokładność lokalizacji"
              defaultValue={u.locationPrecision}
              options={[
                { value: 'EXACT', label: 'Dokładna — pineska w punkcie harcówki' },
                { value: 'APPROXIMATE', label: 'Przybliżona — rozmycie do ~500 m' },
              ]}
              hint="Wybierz przybliżoną, gdy harcówka mieści się w domu prywatnym."
            />
            <Checkbox
              name="isPubliclyVisible"
              label="Pokazuj jednostkę na publicznej mapie"
              defaultChecked={u.isPubliclyVisible}
              hint="O publikacji decydujesz samodzielnie — jednostka nadrzędna nie musi jej akceptować."
            />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
