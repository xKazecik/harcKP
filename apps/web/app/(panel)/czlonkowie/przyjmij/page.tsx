/**
 * „Przyjmij do jednostki" (§8.2, krok 1).
 *
 * Formularz ma DOKŁADNIE trzy pola danych osobowych: imię, nazwisko, e-mail.
 * Nic więcej — resztę profilu uzupełnia zapraszany w kreatorze po kliknięciu
 * w link. Jednostka i gałąź wynikają z kontekstu, nie są danymi osoby.
 */
import { apiSafe } from '../../../../lib/api';
import { requireSession } from '../../../../lib/session';
import { getActiveUnitId } from '../../../../lib/context';
import { invitePerson } from '../../../actions';
import { ActionForm, Field, Select } from '../../../components/action-form';
import { Alert, Card, PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

export default async function InvitePage() {
  const session = await requireSession();
  const me = await apiSafe<{ units: Array<{ id: string; displayName: string; branch: string }>; isSysadmin: boolean }>(
    `/directory/me?sub=${encodeURIComponent(session.sub)}`,
    { units: [], isSysadmin: false },
  );
  const canSeeAll = session.isRoot || me.isSysadmin;
  const units = canSeeAll
    ? await apiSafe<Array<{ id: string; displayName: string; branch: string }>>('/directory/units', [])
    : me.units;
  const activeUnitId = await getActiveUnitId(units as never);
  const active = units.find((u) => u.id === activeUnitId);

  return (
    <>
      <PageHeader
        title="Przyjmij do jednostki"
        subtitle="Zaproszenie e-mailem — osoba sama ustawi hasło i uzupełni profil"
        actions={
          <a className="btn" href="/czlonkowie">
            Wróć do listy
          </a>
        }
      />

      <div className="grid grid-2">
        <Card>
          <ActionForm
            action={invitePerson}
            submitLabel="Wyślij zaproszenie"
            extraActions={
              <a className="btn" href="/czlonkowie/bez-konta">
                Osoba nie ma e-maila
              </a>
            }
          >
            <Select
              name="unitId"
              label="Jednostka"
              required
              defaultValue={activeUnitId ?? undefined}
              options={units.map((u) => ({ value: u.id, label: u.displayName }))}
              hint="Osoba trafi do składu tej jednostki."
            />
            <div className="field-row">
              <Field name="firstName" label="Imię" required />
              <Field name="lastName" label="Nazwisko" required />
            </div>
            <Field
              name="email"
              label="Adres e-mail"
              type="email"
              required
              hint="Na ten adres pójdzie link aktywacyjny. Może to być adres rodzica — wtedy rodzic przejdzie kreator i uzupełni zgodę."
            />
            <Select
              name="branch"
              label="Gałąź"
              required
              defaultValue={active?.branch ?? 'HARCERZE'}
              options={[
                { value: 'HARCERZE', label: 'Harcerze (OH-y)' },
                { value: 'HARCERKI', label: 'Harcerki (OH-ek)' },
              ]}
            />
          </ActionForm>
        </Card>

        <div className="stack">
          <Alert tone="info" title="Co się stanie po wysłaniu">
            Powstaje profil ze statusem <strong>Zaproszona</strong> oraz konto w Keycloak bez
            poświadczeń. Osoba dostaje link ważny domyślnie 7 dni i przechodzi kreator: hasło →
            profil → dane opiekuna (gdy poniżej 16 lat) → podsumowanie. Dopiero wtedy profil
            staje się aktywny.
          </Alert>

          <Card title="O adresie e-mail">
            <ul className="small muted" style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li>
                Adres musi być wolny wśród osób zaproszonych i aktywnych. Adres zwolniony przy
                archiwizacji można wykorzystać od razu.
              </li>
              <li>
                Rodzeństwo może dzielić jedną skrzynkę tylko wtedy, gdy poprzedni profil jest już
                archiwalny — inaczej system zwróci konflikt.
              </li>
              <li>
                Jeśli osoba nie ma własnego adresu i nie chcesz używać adresu rodzica, załóż
                profil bez konta — jest pełnoprawny ewidencyjnie, tylko bez logowania.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
