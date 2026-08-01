/**
 * Utworzenie jednostki (§6.2).
 *
 * Nazwa wyświetlana jest GENEROWANA ze składowych — formularz nie ma pola
 * „nazwa". Umocowanie w drzewie waliduje domena (validateUnitParent), więc
 * błędne zagnieżdżenie zwróci 422 z konkretnym kodem naruszenia.
 */
import { apiSafe } from '../../../../lib/api';
import { createUnit } from '../../../actions';
import { ActionForm, Field, Select } from '../../../components/action-form';
import { Alert, Card, PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

export default async function NewUnitPage() {
  const units = await apiSafe<Array<{ id: string; displayName: string }>>('/directory/units', []);

  return (
    <>
      <PageHeader
        title="Nowa jednostka"
        subtitle="Nazwa powstanie automatycznie ze składowych"
        actions={
          <a className="btn" href="/jednostki">
            Wróć do struktury
          </a>
        }
      />

      <div className="grid grid-2">
        <Card>
          <ActionForm action={createUnit} submitLabel="Utwórz jednostkę">
            <Select
              name="type"
              label="Typ jednostki"
              required
              options={[
                { value: 'CHORAGIEW', label: 'Chorągiew' },
                { value: 'NAMIESTNICTWO', label: 'Namiestnictwo (alias chorągwi)' },
                { value: 'HUFIEC', label: 'Hufiec' },
                { value: 'ZWIAZEK_DRUZYN', label: 'Związek drużyn (alias hufca)' },
                { value: 'DRUZYNA', label: 'Drużyna' },
                { value: 'DRUZYNA_WEDROWNICZA', label: 'Drużyna wędrownicza' },
                { value: 'GROMADA', label: 'Gromada' },
                { value: 'SAMODZIELNY_ZASTEP', label: 'Samodzielny zastęp' },
                { value: 'SZCZEP', label: 'Szczep' },
                { value: 'KRAG_HARCERSTWA_STARSZEGO', label: 'Krąg harcerstwa starszego' },
                { value: 'KRAG_INSTRUKTORSKI', label: 'Krąg instruktorski' },
              ]}
            />
            <Select
              name="branch"
              label="Gałąź"
              required
              options={[
                { value: 'HARCERZE', label: 'Harcerze (OH-y)' },
                { value: 'HARCERKI', label: 'Harcerki (OH-ek)' },
              ]}
            />
            <Select
              name="parentId"
              label="Jednostka nadrzędna"
              required
              allowEmpty="— wybierz —"
              options={units.map((u) => ({ value: u.id, label: u.displayName }))}
              hint="Musi być zgodna z hierarchią: drużyna pod hufcem, hufiec pod chorągwią, chorągiew pod organizacją."
            />
            <div className="field-row">
              <Field name="number" label="Numer" placeholder="np. 1" />
              <Field
                name="localityName"
                label="Przymiotnik miejscowy"
                required
                placeholder="np. Sucholeska"
              />
            </div>
            <div className="field-row">
              <Field name="properName" label="Nazwa własna" placeholder="np. Grań" />
              <Field name="patron" label="Patron" placeholder="np. rtm. Witolda Pileckiego" />
            </div>
          </ActionForm>
        </Card>

        <div className="stack">
          <Alert tone="info" title="Jak powstaje nazwa">
            Wzorzec to <code className="mono">{'{numer} {przymiotnik} {typ} „{nazwa}" im. {patron}'}</code>,
            z pominięciem członów pustych. Przykład: <em>1 Sucholeska Drużyna Harcerzy „Grań"
            im. rtm. Witolda Pileckiego</em>. Etykieta typu odmienia się per gałąź —
            „Drużyna Harcerek" zamiast „Drużyna Harcerzy".
          </Alert>
          <Alert tone="warning" title="To nie zastępuje rozkazu">
            Utworzenie jednostki w systemie jest czynnością ewidencyjną. Formalne powołanie
            następuje rozkazem właściwego komendanta: drużyny i gromady powołuje hufcowy,
            hufce — komendant chorągwi. Nowa jednostka startuje ze statusem próbnym.
          </Alert>
        </div>
      </div>
    </>
  );
}
