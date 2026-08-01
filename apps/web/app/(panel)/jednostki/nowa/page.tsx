/**
 * Utworzenie jednostki (§6.2).
 *
 * Nazwa wyświetlana jest GENEROWANA ze składowych — formularz nie ma pola
 * „nazwa". Wybór jednostki nadrzędnej jest zawężany do umocowań dozwolonych
 * przez regułę hierarchii, a ostateczną walidację i tak wykonuje API.
 */
import { apiSafe } from '../../../../lib/api';
import { NewUnitForm, type ParentOption } from '../../../components/unit-form';
import { Alert, Card, PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

export default async function NewUnitPage() {
  const units = await apiSafe<ParentOption[]>('/directory/units', []);

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
          <NewUnitForm units={units} />
        </Card>

        <div className="stack">
          <Alert tone="info" title="Jak powstaje nazwa">
            Wzorzec to{' '}
            <code className="mono">{'{numer} {przymiotnik} {typ} „{nazwa}" im. {patron}'}</code>,
            z pominięciem członów pustych. Przykład: <em>1 Sucholeska Drużyna Harcerzy „Grań"
            im. rtm. Witolda Pileckiego</em>. Etykieta typu odmienia się per gałąź —
            „Drużyna Harcerek" zamiast „Drużyna Harcerzy".
          </Alert>

          <Alert tone="info" title="Gdzie co można umocować">
            Chorągiew podlega organizacji, hufiec chorągwi, a drużyny i gromady hufcowi.
            Aliasy statutowe działają tak samo jak nazwy podstawowe: Namiestnictwo jest
            traktowane jak Chorągiew, a Związek Drużyn jak Hufiec — także przy wyborze
            jednostki nadrzędnej.
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
