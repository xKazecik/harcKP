/**
 * Lista instruktorów — panel komendanta chorągwi (§12.5).
 *
 * Filtry: lista czynnych/wspierających, stopień, urlop, status weryfikacji
 * ochrony małoletnich. Osobne listy harcerzy starszych i wędrowników są
 * świadomie oddzielne — wędrownik to poziom metodyczny uczestnika, harcerz
 * starszy to kategoria członkostwa osoby pełnoletniej (§7.1). Nie mieszamy ich.
 */
import Link from 'next/link';
import { apiSafe } from '../../../lib/api';
import { Card, Empty, PageHeader, Stat, StatusBadge } from '../../components/ui';
import { date, orDash } from '../../../lib/format';

export const dynamic = 'force-dynamic';

interface Instructor {
  personId: string;
  firstName: string;
  lastName: string;
  branch: string;
  email: string | null;
  rank: string;
  rankAwardedAt: string;
  listType: string;
  onLeaveUntil: string | null;
  minorProtectionValidUntil: string | null;
  minorProtectionValid: boolean;
  instructorPledgeDate: string | null;
}

export default async function InstructorsPage({
  searchParams,
}: {
  searchParams: Promise<{ listType?: string; rank?: string }>;
}) {
  const { listType, rank } = await searchParams;
  const query = new URLSearchParams();
  if (listType) query.set('listType', listType);
  if (rank) query.set('rank', rank);

  const rows = await apiSafe<Instructor[]>(
    `/directory/instructors${query.toString() ? `?${query}` : ''}`,
    [],
  );

  const expiring = rows.filter((r) => !r.minorProtectionValid);
  const onLeave = rows.filter((r) => r.onLeaveUntil && new Date(r.onLeaveUntil) > new Date());

  return (
    <>
      <PageHeader
        title="Instruktorzy"
        subtitle={`${rows.length} osób w wykazie`}
        actions={
          <Link className="btn btn-primary" href="/instruktorzy/nowy">
            Przyjmij instruktora
          </Link>
        }
      />

      <div className="grid grid-4 mb-5">
        <Stat label="Wszyscy" value={rows.length} />
        <Stat
          label="Lista czynnych"
          value={rows.filter((r) => r.listType === 'CZYNNY').length}
        />
        <Stat label="Na urlopie" value={onLeave.length} hint="urlop instruktorski" />
        <Stat
          label="Weryfikacja wygasła"
          value={expiring.length}
          hint="ochrona małoletnich"
        />
      </div>

      {expiring.length > 0 && (
        <div className="alert alert-warning">
          <div>
            <div className="alert-title">
              {expiring.length} instruktorów bez ważnej weryfikacji ochrony małoletnich
            </div>
            <div className="small">
              Mianowanie na funkcję wychowawczą jest dla nich zablokowane do czasu odnowienia
              weryfikacji i potwierdzenia standardów. System przypomina 60, 30 i 7 dni przed
              wygaśnięciem — instruktorowi i jego zwierzchnikowi.
            </div>
          </div>
        </div>
      )}

      <form method="get" className="row mb-4">
        <select name="listType" defaultValue={listType ?? ''} aria-label="Filtr listy">
          <option value="">Wszystkie listy</option>
          <option value="CZYNNY">Lista czynnych</option>
          <option value="WSPIERAJACY">Lista wspierających</option>
        </select>
        <select name="rank" defaultValue={rank ?? ''} aria-label="Filtr stopnia">
          <option value="">Wszystkie stopnie</option>
          <option value="PRZEWODNIK">przewodnik</option>
          <option value="PODHARCMISTRZ">podharcmistrz</option>
          <option value="HARCMISTRZ">harcmistrz</option>
        </select>
        <button className="btn" type="submit">
          Filtruj
        </button>
        {(listType || rank) && (
          <Link className="btn btn-ghost" href="/instruktorzy">
            Wyczyść
          </Link>
        )}
      </form>

      <Card bodyless>
        {rows.length === 0 ? (
          <Empty
            icon="⚜"
            title="Brak instruktorów w wykazie"
            hint="Profil instruktorski powstaje po przyznaniu stopnia instruktorskiego i wpisaniu na listę przez zwierzchnika. Stopnie instruktorskie są zastrzeżone dla poziomu chorągwi i wyżej — drużynowy ani hufcowy ich nie przyznaje."
            action={
              <Link className="btn btn-primary" href="/instruktorzy/nowy">
                Przyjmij pierwszego instruktora
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Instruktor</th>
                  <th>Stopień</th>
                  <th>Lista</th>
                  <th>Gałąź</th>
                  <th>Zobowiązanie</th>
                  <th>Ochrona małoletnich</th>
                  <th>Urlop do</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.personId}>
                    <td>
                      <Link href={`/czlonkowie/${r.personId}`}>
                        {r.lastName} {r.firstName}
                      </Link>
                      {r.email && <div className="xs muted">{r.email}</div>}
                    </td>
                    <td>
                      <StatusBadge dictionary="instructorRank" value={r.rank} />
                      <div className="xs muted">od {date(r.rankAwardedAt)}</div>
                    </td>
                    <td>
                      <StatusBadge dictionary="listType" value={r.listType} />
                    </td>
                    <td>
                      <StatusBadge dictionary="branch" value={r.branch} />
                    </td>
                    <td className="small">{date(r.instructorPledgeDate)}</td>
                    <td>
                      {r.minorProtectionValid ? (
                        <span className="badge badge-success">
                          do {date(r.minorProtectionValidUntil)}
                        </span>
                      ) : (
                        <span className="badge badge-danger">brak / wygasła</span>
                      )}
                    </td>
                    <td className="small">{orDash(r.onLeaveUntil ? date(r.onLeaveUntil) : null)}</td>
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
