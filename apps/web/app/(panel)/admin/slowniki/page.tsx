/**
 * Słowniki wersjonowane (§2, §18).
 *
 * Reguły ZHR nie są zakodowane w logice — każdy katalog jest wersjonowanym
 * słownikiem z datami obowiązywania i odwołaniem do konkretnego przepisu.
 * Zmiana regulaminu dodaje NOWĄ wersję; istniejąca nigdy nie jest nadpisywana,
 * bo trwające karty prób rozliczane są według wersji, pod którą powstały.
 */
import Link from 'next/link';
import { apiSafe } from '../../../../lib/api';
import { Alert, Card, Empty, PageHeader } from '../../../components/ui';
import { date } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

interface Entry {
  id: string;
  code: string;
  version: number;
  labelPl: string;
  validFrom: string;
  validTo: string | null;
  sourceDocument: string;
  sourceClause: string | null;
  payload: Record<string, unknown>;
}

interface Dictionary {
  key: string;
  description: string;
  entries: Entry[];
}

export default async function DictionariesPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const dictionaries = await apiSafe<Dictionary[]>('/admin/dictionaries', []);
  const selected = dictionaries.find((d) => d.key === key) ?? dictionaries[0];

  return (
    <>
      <PageHeader
        title="Słowniki"
        subtitle={`${dictionaries.length} katalogów wersjonowanych`}
        actions={
          <Link className="btn" href="/admin">
            Wróć do panelu
          </Link>
        }
      />

      <Alert tone="info" title="Dlaczego wersje są niezmienne">
        Karta stopnia rozpoczęta pod regulaminem w wersji X musi być rozliczona według wersji X,
        nawet gdy obowiązuje już wersja Y. Dlatego każdy wpis ma własny numer wersji, daty
        obowiązywania i odwołanie do źródłowego przepisu, a poprawki dodaje się jako nowe wersje.
      </Alert>

      {dictionaries.length === 0 ? (
        <Card>
          <Empty
            icon="📖"
            title="Słowniki nie zostały załadowane"
            hint="Katalogi wczytuje idempotentny seed z plików w packages/db/seeds. Uruchom: pnpm --filter @harc/db run seed."
          />
        </Card>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 280px) 1fr' }}>
          <Card title="Katalogi" bodyless>
            <div className="sidebar-nav" style={{ padding: 'var(--space-2)' }}>
              {dictionaries.map((d) => (
                <Link
                  key={d.key}
                  className="nav-item"
                  href={`/admin/slowniki?key=${encodeURIComponent(d.key)}`}
                  aria-current={selected?.key === d.key ? 'page' : undefined}
                >
                  <span className="grow truncate">{d.key}</span>
                  <span className="badge">{d.entries.length}</span>
                </Link>
              ))}
            </div>
          </Card>

          {selected && (
            <Card title={selected.key} bodyless>
              <div className="card-body tight">
                <p className="small muted mb-0">{selected.description}</p>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Etykieta</th>
                      <th className="num">Wersja</th>
                      <th>Obowiązuje od</th>
                      <th>Do</th>
                      <th>Podstawa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.entries.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <code className="mono small">{e.code}</code>
                        </td>
                        <td className="small">{e.labelPl}</td>
                        <td className="num">{e.version}</td>
                        <td className="small">{date(e.validFrom)}</td>
                        <td className="small">{e.validTo ? date(e.validTo) : '—'}</td>
                        <td className="xs muted">
                          {e.sourceDocument}
                          {e.sourceClause ? `, ${e.sourceClause}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
