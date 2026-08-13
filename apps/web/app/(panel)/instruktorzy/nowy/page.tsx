/**
 * Przyjęcie instruktora i wpis na listę (§7.3).
 *
 * Kompetencja `ADMIT_INSTRUCTOR` leży po stronie chorągwi i wyżej (§10.2) —
 * drużynowy i hufcowy nie przyjmują instruktorów. Formularz jest dostępny,
 * ale decyzję podejmuje API: brak kompetencji kończy się odmową.
 */
import Link from 'next/link';
import { apiSafe } from '../../../../lib/api';
import { createInstructor } from '../../../actions';
import { ActionForm, Field, Select } from '../../../components/action-form';
import { Alert, Card, PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

interface UnitRow {
  id: string;
  displayName: string;
  type: string;
  branch: string;
}

export default async function NewInstructorPage() {
  const units = await apiSafe<UnitRow[]>('/directory/units', []);
  // Przynależność instruktorska jest zawsze do chorągwi (§7.3); alias statutowy
  // Namiestnictwo jest tym samym poziomem, więc trafia na tę samą listę.
  const choragwie = units.filter((u) => u.type === 'CHORAGIEW' || u.type === 'NAMIESTNICTWO');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Przyjmij instruktora"
        subtitle="Zakłada profil osoby i wpis na listę instruktorską"
        actions={
          <Link className="btn" href="/instruktorzy">
            Wróć do wykazu
          </Link>
        }
      />

      {choragwie.length === 0 ? (
        <Card>
          <Alert tone="warning" title="Brak chorągwi w strukturze">
            Przynależność instruktorska jest zawsze do konkretnej chorągwi, więc bez niej nie da
            się przyjąć instruktora. Utwórz najpierw chorągiew w sekcji Jednostki.
          </Alert>
          <Link className="btn btn-primary" href="/jednostki/nowa">
            Utwórz chorągiew
          </Link>
        </Card>
      ) : (
        <div className="grid grid-2">
          <Card>
            <ActionForm action={createInstructor} submitLabel="Przyjmij instruktora">
              <div className="field-row">
                <Field name="firstName" label="Imię" required />
                <Field name="lastName" label="Nazwisko" required />
              </div>
              <Field
                name="email"
                label="Adres e-mail"
                type="email"
                hint="Podany adres uruchamia zaproszenie i konto do logowania. Zostaw pusty, aby założyć sam profil ewidencyjny bez konta."
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
                name="homeChoragiewId"
                label="Chorągiew przynależności"
                required
                options={choragwie.map((u) => ({ value: u.id, label: u.displayName }))}
                hint="Wyznacza zwierzchnika: dla przewodnika i podharcmistrza jest nim komendant tej chorągwi."
              />
              <div className="field-row">
                <Select
                  name="rank"
                  label="Stopień instruktorski"
                  required
                  options={[
                    { value: 'PRZEWODNIK', label: 'przewodnik / przewodniczka' },
                    { value: 'PODHARCMISTRZ', label: 'podharcmistrz / podharcmistrzyni' },
                    { value: 'HARCMISTRZ', label: 'harcmistrz / harcmistrzyni' },
                  ]}
                />
                <Field
                  name="rankAwardedAt"
                  label="Stopień przyznany dnia"
                  type="date"
                  required
                  defaultValue={today}
                />
              </div>
              <div className="field-row">
                <Select
                  name="listType"
                  label="Lista"
                  required
                  options={[
                    { value: 'CZYNNY', label: 'Lista czynnych' },
                    { value: 'WSPIERAJACY', label: 'Lista wspierających' },
                  ]}
                />
                <Field
                  name="instructorPledgeDate"
                  label="Zobowiązanie Instruktorskie"
                  type="date"
                  hint="Data złożenia, jeśli znana."
                />
              </div>
              <Select
                name="mainAssignmentLevel"
                label="Poziom przydziału służbowego"
                required
                options={[
                  { value: 'HUFIEC', label: 'Hufiec' },
                  { value: 'CHORAGIEW', label: 'Chorągiew' },
                  { value: 'GK', label: 'Główna Kwatera' },
                  { value: 'WLADZE_NACZELNE', label: 'Władze naczelne' },
                  { value: 'POZA_PIONEM_WYCHOWAWCZYM', label: 'Poza pionem wychowawczym' },
                ]}
              />
              <Select
                name="mainAssignmentUnitId"
                label="Jednostka przydziału"
                allowEmpty="— przydział w chorągwi przynależności —"
                options={units.map((u) => ({ value: u.id, label: u.displayName }))}
                hint="Jednostka, w której instruktor faktycznie pełni służbę."
              />
            </ActionForm>
          </Card>

          <div className="stack">
            <Alert tone="info" title="Kto może przyjmować instruktorów">
              Przyjmowanie i zwalnianie instruktorów, wpisywanie na listy oraz przyznawanie
              stopni instruktorskich to kompetencje poziomu chorągwi i wyżej. Hufcowy ani
              drużynowy ich nie mają — to celowe rozróżnienie, nie ograniczenie interfejsu.
              Administrator systemu może wykonać tę operację dla dowolnej chorągwi.
            </Alert>

            <Alert tone="warning" title="Ewidencja, nie rozkaz">
              Ten formularz odwzorowuje skutek ewidencyjny. Formalne przyjęcie i wpis na listę
              następuje rozkazem zwierzchnika — wprowadź go w module rozkazów, żeby zdarzenie
              trafiło do dziennika osobistego i dziennika jednostki.
            </Alert>

            <Alert tone="info" title="Ochrona małoletnich">
              Nowy profil nie ma jeszcze weryfikacji ochrony małoletnich ani potwierdzenia
              standardów, więc mianowanie go na funkcję wychowawczą będzie zablokowane do czasu
              uzupełnienia tych dat. System przechowuje wyłącznie daty, nigdy treści zaświadczeń.
            </Alert>
          </div>
        </div>
      )}
    </>
  );
}
