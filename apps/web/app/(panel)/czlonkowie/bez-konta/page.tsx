/**
 * Profil bez konta (§8.2) — dla osoby bez własnego adresu e-mail.
 *
 * Profil jest pełnoprawny ewidencyjnie: można przyznawać stopnie i sprawności,
 * wpisywać do rozkazów i liczyć w spisie. Jedyne ograniczenie to brak
 * logowania. W dowolnym momencie da się go „podnieść" do konta zaproszeniem.
 */
import { apiSafe } from '../../../../lib/api';
import { requireSession } from '../../../../lib/session';
import { getActiveUnitId } from '../../../../lib/context';
import { createPersonWithoutAccount } from '../../../actions';
import { ActionForm, Field, Select } from '../../../components/action-form';
import { Alert, Card, PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

export default async function WithoutAccountPage() {
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
        title="Profil bez konta"
        subtitle="Dla osoby, która nie ma własnego adresu e-mail"
        actions={
          <a className="btn" href="/czlonkowie">
            Wróć do listy
          </a>
        }
      />

      <div className="grid grid-2">
        <Card>
          <ActionForm action={createPersonWithoutAccount} submitLabel="Załóż profil">
            <Select
              name="unitId"
              label="Jednostka"
              required
              defaultValue={activeUnitId ?? undefined}
              options={units.map((u) => ({ value: u.id, label: u.displayName }))}
            />
            <div className="field-row">
              <Field name="firstName" label="Imię" required />
              <Field name="lastName" label="Nazwisko" required />
            </div>
            <Field
              name="birthDate"
              label="Data urodzenia"
              type="date"
              hint="Potrzebna do liczenia wieku i sprawdzania przedziałów wiekowych stopni. Poniżej 16 lat pojawi się przypomnienie o zgodzie opiekuna."
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

        <Alert tone="info" title="Profil bez konta a konto z logowaniem">
          Profil bez konta nie ma powiązanego użytkownika w Keycloak, więc nie da się na niego
          zalogować. Wszystko inne działa tak samo: karty stopni, sprawności, rozkazy, spis.
          Gdy osoba będzie miała własny adres, wyślij jej zaproszenie z profilu — konto zostanie
          dołączone do istniejącej historii, bez zakładania drugiego profilu.
        </Alert>
      </div>
    </>
  );
}
