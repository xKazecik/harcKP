/**
 * Nieaktywne profile (§8.3) i przywracanie (§8.5).
 *
 * Przywrócenie WYMAGA świadomie wpisanego, wolnego adresu — nie ma trybu
 * „przywróć z poprzednim adresem" jednym kliknięciem. Jeśli podany adres jest
 * identyczny z historycznym i nadal wolny, wymagane jest jawne potwierdzenie.
 */
import { apiSafe } from '../../../../lib/api';
import { restorePerson } from '../../../actions';
import { ActionForm, Checkbox, Field } from '../../../components/action-form';
import { Alert, Card, Empty, PageHeader } from '../../../components/ui';
import { date, orDash } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

interface Archived {
  id: string;
  firstName: string;
  lastName: string;
  historicalEmail: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  lastUnitId: string | null;
}

export default async function ArchivedPage() {
  const rows = await apiSafe<Archived[]>('/persons', []);

  return (
    <>
      <PageHeader
        title="Nieaktywne profile"
        subtitle={`${rows.length} profili archiwalnych`}
        actions={
          <a className="btn" href="/admin">
            Wróć do panelu
          </a>
        }
      />

      <Alert tone="info" title="Archiwizacja nie kasuje danych">
        Osoba znika ze składów jednostek, list wyboru i statystyk, ale pozostaje w rozkazach,
        dziennikach jednostek, audit logu i historii funkcji. Adres e-mail zostaje zwolniony
        i może być natychmiast użyty dla innej osoby — także z tej samej skrzynki rodzinnej.
      </Alert>

      <Card bodyless>
        {rows.length === 0 ? (
          <Empty
            icon="🗄"
            title="Brak profili archiwalnych"
            hint="Profile trafiają tutaj po archiwizacji z karty osoby. To operacja odwracalna — przywrócenie wymaga podania nowego, wolnego adresu e-mail."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Osoba</th>
                  <th>Adres historyczny</th>
                  <th>Zarchiwizowano</th>
                  <th>Powód</th>
                  <th>Przywrócenie</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={`/czlonkowie/${p.id}`}>
                        {p.lastName} {p.firstName}
                      </a>
                    </td>
                    <td className="small mono">{orDash(p.historicalEmail)}</td>
                    <td className="small">{date(p.archivedAt)}</td>
                    <td className="small">{orDash(p.archiveReason)}</td>
                    <td style={{ minWidth: 320 }}>
                      <details>
                        <summary className="btn btn-sm" style={{ cursor: 'pointer' }}>
                          Przywróć
                        </summary>
                        <div style={{ marginTop: 'var(--space-3)' }}>
                          <ActionForm action={restorePerson} submitLabel="Przywróć profil">
                            <input type="hidden" name="personId" value={p.id} />
                            <Field
                              name="newEmail"
                              label="Nowy adres e-mail"
                              type="email"
                              required
                              hint="Adres musi być wolny wśród osób zaproszonych i aktywnych."
                            />
                            <Checkbox
                              name="confirmHistoricalEmail"
                              label="Potwierdzam użycie poprzedniego adresu tego profilu"
                              hint="Zaznacz tylko, gdy wpisujesz ten sam adres, który profil miał przed archiwizacją."
                            />
                          </ActionForm>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 'var(--space-5)' }}>
        <Alert tone="warning" title="Co przywrócenie robi, a czego nie">
          Konto zostaje włączone z nowym adresem i wychodzi nowe zaproszenie — stare hasło nigdy
          nie wraca. Przywrócenie <strong>nie</strong> odtwarza funkcji, przydziału ani wpisu na
          listę instruktorów; każde z nich wymaga osobnego rozkazu. Operacja trafia do audit logu
          wraz z poprzednim i nowym adresem.
        </Alert>
      </div>
    </>
  );
}
