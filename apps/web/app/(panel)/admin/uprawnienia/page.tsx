/**
 * Uprawnienia efektywne (§18) — pokazują, SKĄD wynika każde uprawnienie.
 *
 * Widok jest narzędziem diagnostycznym dla najczęstszego nieporozumienia
 * (§10.2): zasięg władzy NIE jest funkcją odległości w drzewie. Komendant
 * chorągwi ma hufce w poddrzewie, a mimo to standardowo nie powołuje drużyn.
 */
import { apiSafe } from '../../../../lib/api';
import { Alert, Card, Empty, PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

interface Permission {
  action: string;
  allowed: boolean;
  via?: string;
  basis?: string;
  reason?: string;
  pendingApproval?: boolean;
}

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string; unitId?: string }>;
}) {
  const { personId, unitId } = await searchParams;
  const units = await apiSafe<Array<{ id: string; displayName: string }>>('/directory/units', []);

  const permissions =
    personId && unitId
      ? await apiSafe<Permission[]>(
          `/admin/effective-permissions?personId=${encodeURIComponent(personId)}&unitId=${encodeURIComponent(unitId)}`,
          [],
        )
      : [];

  const allowed = permissions.filter((p) => p.allowed);
  const denied = permissions.filter((p) => !p.allowed);

  return (
    <>
      <PageHeader
        title="Uprawnienia efektywne"
        subtitle="Co dana osoba może zrobić w danej jednostce i dlaczego"
        actions={
          <a className="btn" href="/admin">
            Wróć do panelu
          </a>
        }
      />

      <Alert tone="info" title="Zasięg zależy od akcji, nie od poziomu w drzewie">
        Każda akcja ma własny zasięg wynikający z konkretnego przepisu. Hufcowy mianuje
        drużynowych, ale nie przybocznych — to kompetencja drużynowego. Komendant chorągwi ma
        hufce w poddrzewie, ale standardowo nie powołuje drużyn. Dlatego lista poniżej jest
        wyliczana akcja po akcji, a nie z jednej reguły „o poziom niżej”.
      </Alert>

      <Card title="Wybierz kontekst">
        <form method="get" className="field-row">
          <div className="field">
            <label htmlFor="personId">Identyfikator osoby</label>
            <input
              id="personId"
              name="personId"
              defaultValue={personId ?? ''}
              placeholder="UUID osoby"
            />
            <span className="hint">Skopiuj z adresu karty osoby (/czlonkowie/&lt;id&gt;).</span>
          </div>
          <div className="field">
            <label htmlFor="unitId">Jednostka</label>
            <select id="unitId" name="unitId" defaultValue={unitId ?? ''}>
              <option value="">— wybierz —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" type="submit">
              Pokaż uprawnienia
            </button>
          </div>
        </form>
      </Card>

      {personId && unitId && (
        <div className="grid grid-2" style={{ marginTop: 'var(--space-5)' }}>
          <Card title={`Dozwolone (${allowed.length})`} bodyless>
            {allowed.length === 0 ? (
              <Empty
                icon="🔒"
                title="Brak dozwolonych akcji"
                hint="Osoba nie ma w tej jednostce żadnej kompetencji — ani z urzędu, ani z delegacji, ani z podstawienia. Sprawdź, czy pełni tam funkcję nadaną rozkazem."
              />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Akcja</th>
                      <th>Skąd</th>
                      <th>Podstawa prawna</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowed.map((p) => (
                      <tr key={p.action}>
                        <td>
                          <code className="mono small">{p.action}</code>
                          {p.pendingApproval && (
                            <div>
                              <span className="badge badge-warning">wymaga kontrasygnaty</span>
                            </div>
                          )}
                        </td>
                        <td className="small">{p.via ?? '—'}</td>
                        <td className="xs muted">{p.basis ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={`Zabronione (${denied.length})`} bodyless>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Akcja</th>
                    <th>Powód odmowy</th>
                  </tr>
                </thead>
                <tbody>
                  {denied.map((p) => (
                    <tr key={p.action}>
                      <td>
                        <code className="mono small">{p.action}</code>
                      </td>
                      <td className="xs muted">{p.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
