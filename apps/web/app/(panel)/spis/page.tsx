/**
 * Spis (§13.1, §13.2) — dwa ODRĘBNE procesy o różnych cyklach.
 *
 * Spis instruktorski idzie rokiem kalendarzowym i dotyczy osób; spis jednostek
 * jest na stan 31 grudnia i dotyczy jednostek. Nie łączymy ich w jeden
 * formularz ani z planem pracy (§21).
 */
import { openCensus, submitCensus } from '../../actions';
import { ActionForm, Checkbox, InlineAction, Select } from '../../components/action-form';
import { Alert, Card, PageHeader } from '../../components/ui';

export const dynamic = 'force-dynamic';

export default async function CensusPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  const year = new Date().getFullYear();

  return (
    <>
      <PageHeader
        title="Spis"
        subtitle={`Rok kalendarzowy ${year}`}
      />

      <div className="grid grid-2 mb-5">
        <Card title="Spis instruktorski i członków pełnoletnich">
          <p className="small muted">
            Harmonogram domyślny: ogłoszenie do 31.10, otwarcie 1.11, termin dokonania 30.11,
            wpis na listę przez zwierzchnika do 31.12.
          </p>
          <ul className="small muted" style={{ paddingLeft: '1.1rem' }}>
            <li>
              Brak wniosku w terminie — osoba jest traktowana jak wpisana na listę{' '}
              <strong>wspierających</strong> do czasu decyzji.
            </li>
            <li>
              Brak decyzji zwierzchnika w terminie — osoba jest traktowana jak wpisana{' '}
              <strong>zgodnie z wnioskiem</strong>.
            </li>
          </ul>
          <p className="xs muted">
            Oba automaty to stany wyliczane, nie ręczna interwencja — nikt nie musi niczego
            „odklikiwać”, żeby zadziałały.
          </p>
          <div className="btn-row">
            <InlineAction
              action={openCensus}
              label={`Otwórz kampanię ${year}`}
              variant="primary"
              hidden={{ kind: 'INSTRUCTORS', year: String(year) }}
            />
          </div>
        </Card>

        <Card title="Spis jednostek">
          <p className="small muted">
            Prowadzony na stan <strong>31 grudnia</strong>, przez osobę z uprawnieniem Komisarza
            Spisowego. Zakres: stan liczbowy jednostki, dane wizytówki, potwierdzenie danych
            członków.
          </p>
          <Alert tone="info" title="Integracja, nie duplikacja">
            ZHR prowadzi spis także poza systemem. Przełącznik źródła prawdy decyduje, czy dane
            z HARC są wiodące, czy tylko pomocnicze wobec formularzy zewnętrznych — import CSV
            z raportem rozbieżności i eksport w zgodnym formacie są przewidziane po stronie API.
          </Alert>
          <div className="btn-row">
            <InlineAction
              action={openCensus}
              label={`Otwórz spis jednostek ${year}`}
              hidden={{ kind: 'UNITS', year: String(year) }}
            />
          </div>
        </Card>
      </div>

      <Card title="Moja deklaracja spisowa">
        {campaign ? (
          <ActionForm action={submitCensus} submitLabel="Złóż deklarację">
            <input type="hidden" name="campaignId" value={campaign} />
            <Select
              name="declaredListType"
              label="Deklarowana lista"
              required
              options={[
                { value: 'CZYNNY', label: 'Lista czynnych' },
                { value: 'WSPIERAJACY', label: 'Lista wspierających' },
              ]}
            />
            <Select
              name="requestedAction"
              label="Wniosek"
              required
              options={[
                { value: 'ENROLL', label: 'Wpis na listę' },
                { value: 'LEAVE', label: 'Urlop instruktorski' },
                { value: 'END_SERVICE', label: 'Zakończenie służby' },
              ]}
            />
            <Checkbox
              name="feePaidConfirmed"
              label="Potwierdzam opłacenie składek"
              hint="Wyłącznie deklaracja. System nie prowadzi rozliczeń, nie zna kwot i nie obsługuje płatności."
            />
          </ActionForm>
        ) : (
          <p className="small muted mb-0">
            Deklarację składa się w otwartej kampanii spisowej. Otwórz kampanię przyciskiem
            powyżej, a następnie wróć tutaj z jej identyfikatorem — kampanie są prowadzone
            centralnie, więc zwykle otwiera je Główna Kwatera, nie pojedyncza jednostka.
          </p>
        )}
      </Card>
    </>
  );
}
