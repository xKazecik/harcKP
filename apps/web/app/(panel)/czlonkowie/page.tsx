/**
 * Lista członków jednostki — główny widok drużynowego (§12.5).
 *
 * Kolumny: wiek liczony, szkoła, stopień, sprawności, status karty, data
 * Przyrzeczenia, numer Krzyża, zastęp. Data urodzenia jest widoczna tylko tutaj
 * (widok funkcyjnego własnej jednostki, §17); widoki wyższych szczebli
 * pokazują wyłącznie wiek.
 */
import Link from 'next/link';
import { apiSafe } from '../../../lib/api';
import { requireSession } from '../../../lib/session';
import { getActiveUnitId } from '../../../lib/context';
import { Card, Empty, PageHeader, StatusBadge } from '../../components/ui';
import { date, orDash, plural } from '../../../lib/format';
import { labelFor, progressionLabels } from '../../../lib/dictionaries';

export const dynamic = 'force-dynamic';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  membershipCategory: string;
  age: number | null;
  birthDate: string | null;
  school: string | null;
  crossNumber: string | null;
  promiseDate: string | null;
  rank: string | null;
  instructorRank: string | null;
  openCard: { id: string; targetCode: string; status: string } | null;
  badges: number;
  zastep: string | null;
  guardianConsent: 'NOT_REQUIRED' | 'MISSING' | 'PRESENT';
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await requireSession();
  const me = await apiSafe<{ units: Array<{ id: string; displayName: string }>; isSysadmin: boolean }>(
    `/directory/me?sub=${encodeURIComponent(session.sub)}`,
    { units: [], isSysadmin: false },
  );
  const canSeeAll = session.isRoot || me.isSysadmin;
  const units = canSeeAll
    ? await apiSafe<Array<{ id: string; displayName: string }>>('/directory/units', [])
    : me.units;
  const activeUnitId = await getActiveUnitId(units as never);
  const unitName = units.find((u) => u.id === activeUnitId)?.displayName ?? '';

  const labels = await progressionLabels();

  const members = activeUnitId
    ? await apiSafe<Member[]>(
        `/directory/units/${activeUnitId}/members${q ? `?q=${encodeURIComponent(q)}` : ''}`,
        [],
      )
    : [];

  const missingConsent = members.filter((m) => m.guardianConsent === 'MISSING');

  if (!activeUnitId) {
    return (
      <>
        <PageHeader title="Członkowie" />
        <Card>
          <Empty
            icon="👥"
            title="Wybierz jednostkę"
            hint="Lista członków dotyczy konkretnej jednostki. Wybierz ją przełącznikiem kontekstu w lewym panelu."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Członkowie"
        subtitle={`${unitName} · ${members.length} ${plural(members.length, 'osoba', 'osoby', 'osób')}`}
        actions={
          <>
            <Link className="btn" href="/czlonkowie/bez-konta">
              Profil bez konta
            </Link>
            <Link className="btn btn-primary" href="/czlonkowie/przyjmij">
              Przyjmij do jednostki
            </Link>
          </>
        }
      />

      {missingConsent.length > 0 && (
        <div className="alert alert-warning">
          <div>
            <div className="alert-title">
              Brak zgody rodzica: {missingConsent.length}{' '}
              {plural(missingConsent.length, 'osoba', 'osoby', 'osób')}
            </div>
            <div className="small">
              {missingConsent.map((m) => `${m.firstName} ${m.lastName}`).join(', ')} — poniżej 16 lat
              bez odnotowanej zgody opiekuna. To przypomnienie, nie blokada: osoba pozostaje
              pełnoprawnym członkiem, ale warto uzupełnić dokumentację.
            </div>
          </div>
        </div>
      )}

      <form method="get" className="row mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Szukaj po nazwisku…"
          aria-label="Filtruj listę członków"
          style={{ maxWidth: 280 }}
        />
        <button className="btn" type="submit">
          Filtruj
        </button>
        {q && (
          <Link className="btn btn-ghost" href="/czlonkowie">
            Wyczyść
          </Link>
        )}
      </form>

      <Card bodyless>
        {members.length === 0 ? (
          <Empty
            icon="👥"
            title={q ? 'Nikt nie pasuje do filtra' : 'Jednostka nie ma jeszcze członków'}
            hint={
              q
                ? 'Zmień frazę wyszukiwania albo wyczyść filtr, żeby zobaczyć całą listę.'
                : 'Przyjęcie do jednostki wymaga trzech danych: imienia, nazwiska i adresu e-mail. Osoba dostanie zaproszenie i sama uzupełni resztę profilu. Jeśli nie ma własnego e-maila, załóż profil bez konta.'
            }
            action={
              !q && (
                <Link className="btn btn-primary" href="/czlonkowie/przyjmij">
                  Przyjmij pierwszą osobę
                </Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Osoba</th>
                  <th className="num">Wiek</th>
                  <th>Kategoria</th>
                  <th>Stopień</th>
                  <th>Karta w toku</th>
                  <th className="num">Spr.</th>
                  <th>Zastęp</th>
                  <th>Przyrzeczenie</th>
                  <th>Krzyż</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/czlonkowie/${m.id}`}>
                        {m.lastName} {m.firstName}
                      </Link>
                      {m.school && <div className="xs muted">{m.school}</div>}
                    </td>
                    <td className="num">{orDash(m.age)}</td>
                    <td>
                      <StatusBadge dictionary="membershipCategory" value={m.membershipCategory} />
                    </td>
                    <td>
                      {m.instructorRank ? (
                        <StatusBadge dictionary="instructorRank" value={m.instructorRank} />
                      ) : (
                        <span className="small">{labelFor(labels, m.rank)}</span>
                      )}
                    </td>
                    <td>
                      {m.openCard ? (
                        <Link className="small" href={`/progresja/${m.openCard.id}`}>
                          {labelFor(labels, m.openCard.targetCode)}
                        </Link>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                    <td className="num">{m.badges}</td>
                    <td className="small">{orDash(m.zastep)}</td>
                    <td className="small">{date(m.promiseDate)}</td>
                    <td className="small mono">{orDash(m.crossNumber)}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <StatusBadge dictionary="personStatus" value={m.status} />
                        {m.guardianConsent === 'MISSING' && (
                          <span className="badge badge-warning" title="Brak zgody rodzica">
                            zgoda
                          </span>
                        )}
                      </div>
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
