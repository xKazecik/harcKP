/**
 * Tryb roota (§10.1) — zmiany poza normalnym trybem pracy systemu.
 *
 * Strona renderuje się WYŁĄCZNIE dla roota i jest celowo odróżniona wizualnie
 * (ton `danger`), bo prowadzi obok całej machiny rozkazów i kompetencji.
 * Uprawnienie i tak egzekwuje `RootOnlyGuard` po stronie API — ukrycie strony
 * jest wygodą, nie zabezpieczeniem.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiSafe } from '../../../../lib/api';
import { requireSession } from '../../../../lib/session';
import { dateTime } from '../../../../lib/format';
import {
  rootAppointFunction,
  rootEndFunction,
  rootPatchPerson,
  rootPatchUnit,
} from '../../../actions';
import { ActionForm, Checkbox, Field, InlineAction, Select, TextArea } from '../../../components/action-form';
import { Alert, Card, Empty, PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

interface UnitRef {
  id: string;
  displayName: string;
}

interface Leadership {
  id: string;
  unitId: string;
  personId: string;
  roleKey: string;
  isActing: boolean;
  appointedByOrderId: string | null;
  validFrom: string;
  validTo: string | null;
}

interface Override {
  id: string;
  occurredAt: string;
  actorPersonId: string | null;
  resourceType: string;
  resourceId: string | null;
  payload: {
    operation?: string;
    reason?: string;
    forced?: boolean;
  };
}

const ROLE_OPTIONS = [
  { value: 'LEADER', label: 'Komendant jednostki (LEADER)' },
  { value: 'DEPUTY', label: 'Zastępca / przyboczny (DEPUTY)' },
  { value: 'QUARTERMASTER', label: 'Kwatermistrz (QUARTERMASTER)' },
  { value: 'SECRETARY', label: 'Sekretarz (SECRETARY)' },
  { value: 'BOARD_MEMBER', label: 'Członek komendy (BOARD_MEMBER)' },
];

export default async function RootModePage() {
  const session = await requireSession();
  // Root wynika z claimu `groups` (§9.4). Bez niego strona nie istnieje.
  if (!session.isRoot) notFound();

  const [units, leadership, overrides] = await Promise.all([
    apiSafe<UnitRef[]>('/directory/units', []),
    apiSafe<Leadership[]>('/root/leadership', []),
    apiSafe<Override[]>('/root/overrides?limit=50', []),
  ]);

  const unitName = (id: string): string =>
    units.find((u) => u.id === id)?.displayName ?? id;
  const active = leadership.filter((l) => !l.validTo);

  return (
    <>
      <PageHeader
        title="Tryb roota"
        subtitle="Zmiany wprowadzane bezpośrednio, z pominięciem rozkazów i macierzy kompetencji"
        actions={
          <Link className="btn" href="/admin">
            Wróć do panelu
          </Link>
        }
      />

      <Alert tone="danger" title="Te operacje omijają normalny tryb pracy">
        Zmiany wchodzą natychmiast, bez rozkazu i bez sprawdzania kompetencji.
        Każda z nich wymaga podania powodu i trafia do audit logu jako
        <code className="mono"> ROOT_OVERRIDE</code>. Zaznaczenie „pomiń walidacje”
        wyłącza dodatkowo kontrolę wieku, ochrony małoletnich i wymogu opiekuna
        przy p.o. — używaj tylko wtedy, gdy wiesz, dlaczego.
      </Alert>

      <Alert tone="info" title="Czego tu nie ma">
        Opublikowanych rozkazów nie da się edytować także w tym trybie. Rozkaz
        jest dokumentem organizacji — sprostowanie następuje osobnym rozkazem,
        przez zwykły moduł rozkazów.
      </Alert>

      <div className="grid grid-2 mb-5">
        <Card title="Nadaj funkcję bez rozkazu">
          <p className="small muted">
            Powstanie wpis bez powiązania z rozkazem. W historii funkcji będzie
            widać, że umocowania w dokumencie nie ma — i to jest zamierzone.
          </p>
          <ActionForm action={rootAppointFunction} submitLabel="Nadaj funkcję" variant="danger">
            <Select
              name="unitId"
              label="Jednostka"
              required
              allowEmpty="— wybierz —"
              options={units.map((u) => ({ value: u.id, label: u.displayName }))}
            />
            <Field name="personId" label="Identyfikator osoby" required />
            <Select name="roleKey" label="Funkcja" required options={ROLE_OPTIONS} />
            <Field
              name="guardianInstructorId"
              label="Opiekun (wymagany przy p.o.)"
              hint="UUID instruktora kontrasygnującego decyzje p.o."
            />
            <Checkbox name="isActing" label="Pełniący obowiązki (p.o.)" />
            <Field name="reason" label="Powód" required hint="Trafia do audit logu." />
            <Checkbox
              name="force"
              label="Pomiń walidacje domenowe"
              hint="Wiek, ochrona małoletnich, wymóg opiekuna przy p.o."
            />
          </ActionForm>
        </Card>

        <div className="stack">
          <Card title="Zmień jednostkę">
            <p className="small muted">
              Pola podaj jako JSON, np.{' '}
              <code className="mono">{'{"status":"ACTIVE","categoryId":"POLOWA"}'}</code>.
            </p>
            <ActionForm action={rootPatchUnit} submitLabel="Zapisz zmiany" variant="danger">
              <Select
                name="unitId"
                label="Jednostka"
                required
                allowEmpty="— wybierz —"
                options={units.map((u) => ({ value: u.id, label: u.displayName }))}
              />
              <TextArea name="data" label="Zmiany (JSON)" rows={3} hint="Puste = brak zmian." />
              <Field name="reason" label="Powód" required />
              <Checkbox name="force" label="Pomiń walidacje domenowe" />
            </ActionForm>
          </Card>

          <Card title="Zmień profil osoby">
            <p className="small muted">
              Adresu e-mail nie zmienia się tędy — musi przejść przez weryfikację
              i synchronizację z Keycloak, inaczej rozjedzie się logowanie.
            </p>
            <ActionForm action={rootPatchPerson} submitLabel="Zapisz zmiany" variant="danger">
              <Field name="personId" label="Identyfikator osoby" required />
              <TextArea name="data" label="Zmiany (JSON)" rows={3} hint="Puste = brak zmian." />
              <Field name="reason" label="Powód" required />
              <Checkbox name="force" label="Pomiń walidacje domenowe" />
            </ActionForm>
          </Card>
        </div>
      </div>

      <Card title={`Pełnione funkcje (${active.length})`} bodyless>
        {active.length === 0 ? (
          <Empty
            icon="⚜"
            title="Nikt nie pełni funkcji"
            hint="Funkcje nadaje się rozkazem albo — wyjątkowo — formularzem powyżej."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Jednostka</th>
                  <th>Osoba</th>
                  <th>Funkcja</th>
                  <th>Umocowanie</th>
                  <th>Od</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {active.map((l) => (
                  <tr key={l.id}>
                    <td className="small">{unitName(l.unitId)}</td>
                    <td>
                      <Link href={`/czlonkowie/${l.personId}`}>
                        <code className="mono small">{l.personId.slice(0, 8)}…</code>
                      </Link>
                    </td>
                    <td className="small">
                      {l.roleKey}
                      {l.isActing && <span className="badge badge-warning"> p.o.</span>}
                    </td>
                    <td className="xs">
                      {l.appointedByOrderId ? (
                        <span className="muted">rozkaz</span>
                      ) : (
                        <span className="badge badge-danger">bez rozkazu</span>
                      )}
                    </td>
                    <td className="xs muted">{dateTime(l.validFrom)}</td>
                    <td>
                      <InlineAction
                        action={rootEndFunction}
                        label="Zakończ"
                        variant="danger"
                        hidden={{ leadershipId: l.id, reason: 'Zwolnienie w trybie roota' }}
                        confirm="Zakończyć pełnienie tej funkcji bez rozkazu?"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Historia interwencji (${overrides.length})`} bodyless>
        {overrides.length === 0 ? (
          <Empty
            icon="🧾"
            title="Brak interwencji"
            hint="Tu pojawi się każda zmiana wprowadzona w tym trybie, wraz z powodem i informacją, czy pominięto walidacje."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Kiedy</th>
                  <th>Operacja</th>
                  <th>Zasób</th>
                  <th>Powód</th>
                  <th>Walidacje</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.id}>
                    <td className="xs muted">{dateTime(o.occurredAt)}</td>
                    <td>
                      <code className="mono small">{o.payload.operation ?? '—'}</code>
                    </td>
                    <td className="xs muted">
                      {o.resourceType}
                      {o.resourceId ? ` ${o.resourceId.slice(0, 8)}…` : ''}
                    </td>
                    <td className="small">{o.payload.reason ?? '—'}</td>
                    <td className="xs">
                      {o.payload.forced ? (
                        <span className="badge badge-danger">pominięte</span>
                      ) : (
                        <span className="muted">zachowane</span>
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
