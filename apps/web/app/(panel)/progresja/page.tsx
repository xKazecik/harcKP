/**
 * Progresja — panel „Do zatwierdzenia" drużynowego (§12.5) i otwieranie kart.
 *
 * Kolejka zgłoszeń zbiera wymagania w stanie SUBMITTED z całej jednostki:
 * harcerz zgłasza wykonanie z komentarzem, drużynowy zalicza albo odsyła.
 */
import Link from 'next/link';
import { apiSafe } from '../../../lib/api';
import { requireSession } from '../../../lib/session';
import { getActiveUnitId } from '../../../lib/context';
import { startProgression, verifyRequirement } from '../../actions';
import { ActionForm, InlineAction, Select } from '../../components/action-form';
import { Card, Empty, PageHeader, StatusBadge } from '../../components/ui';
import { dateTime } from '../../../lib/format';
import { labelFor, progressionLabels } from '../../../lib/dictionaries';

export const dynamic = 'force-dynamic';

interface PendingRow {
  id: string;
  code: string;
  description: string;
  status: string;
  submittedAt: string | null;
  isFeat: boolean;
  evidence: { comment?: string } | null;
  instanceId: string;
  instance?: { id: string; personId: string; targetCode: string; kind: string };
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  branch: string;
  rank: string | null;
  openCard: { id: string; targetCode: string; status: string } | null;
}

interface DictEntry {
  id: string;
  code: string;
  labelPl: string;
}

export default async function ProgressionPage() {
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

  if (!activeUnitId) {
    return (
      <>
        <PageHeader title="Progresja" />
        <Card>
          <Empty
            icon="★"
            title="Wybierz jednostkę"
            hint="Kolejka zgłoszeń i karty prób dotyczą konkretnej jednostki. Wybierz ją przełącznikiem kontekstu."
          />
        </Card>
      </>
    );
  }

  const [pending, members, ranksM, ranksF, badges] = await Promise.all([
    apiSafe<PendingRow[]>(`/progression/unit/${activeUnitId}/pending`, []),
    apiSafe<Member[]>(`/directory/units/${activeUnitId}/members`, []),
    apiSafe<DictEntry[]>('/directory/dictionary/ranks_harcerze', []),
    apiSafe<DictEntry[]>('/directory/dictionary/ranks_harcerki', []),
    apiSafe<DictEntry[]>('/directory/dictionary/badges', []),
  ]);

  const labels = await progressionLabels();
  const withCards = members.filter((m) => m.openCard);

  return (
    <>
      <PageHeader
        title="Progresja"
        subtitle={`${pending.length} zgłoszeń czeka na ocenę · ${withCards.length} otwartych kart`}
      />

      <div className="grid grid-2 mb-5">
        <Card title="Do zatwierdzenia">
          {pending.length === 0 ? (
            <Empty
              icon="✅"
              title="Kolejka jest pusta"
              hint="Tu trafiają zadania zgłoszone przez harcerzy wraz z komentarzem i załącznikami. Gdy ktoś zgłosi wykonanie zadania, pojawi się tutaj do zaliczenia."
            />
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pending.map((r) => (
                <li key={r.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-3)' }}>
                  <div className="spread mb-3">
                    <strong className="small">{r.description}</strong>
                    <span className="row" style={{ gap: 4 }}>
                      {r.isFeat && <span className="badge badge-warning">wyczyn</span>}
                      <StatusBadge dictionary="requirementStatus" value={r.status} />
                    </span>
                  </div>
                  {r.evidence?.comment && (
                    <p className="small muted" style={{ marginBottom: 'var(--space-2)' }}>
                      „{r.evidence.comment}”
                    </p>
                  )}
                  <div className="spread">
                    <span className="xs muted">
                      zgłoszone {dateTime(r.submittedAt)} · <code className="mono">{r.code}</code>
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <Link className="btn btn-sm" href={`/progresja/${r.instanceId}`}>
                        Karta
                      </Link>
                      <InlineAction
                        action={verifyRequirement}
                        label="Zalicz"
                        variant="primary"
                        hidden={{ requirementId: r.id, instanceId: r.instanceId }}
                      />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Otwórz nową kartę">
          <p className="small muted">
            Zestaw zadań pobiera się z aktualnej wersji regulaminu i pozostaje z nią związany do
            końca próby — późniejsza zmiana regulaminu nie wpłynie na trwającą kartę.
          </p>
          <ActionForm action={startProgression} submitLabel="Otwórz kartę">
            <input type="hidden" name="unitId" value={activeUnitId} />
            <Select
              name="personId"
              label="Osoba"
              required
              allowEmpty="— wybierz —"
              options={members.map((m) => ({
                value: m.id,
                label: `${m.lastName} ${m.firstName}${m.rank ? ` — ${labelFor(labels, m.rank)}` : ''}`,
              }))}
            />
            <Select
              name="kind"
              label="Rodzaj"
              required
              options={[
                { value: 'RANK', label: 'Stopień harcerski' },
                { value: 'BADGE', label: 'Sprawność' },
                { value: 'ZUCH_STAR', label: 'Gwiazdka zuchowa' },
              ]}
            />
            <Select
              name="targetCode"
              label="Cel"
              required
              allowEmpty="— wybierz —"
              options={[
                ...ranksM.map((r) => ({ value: r.code, label: `Stopień (OH-y): ${r.labelPl}` })),
                ...ranksF.map((r) => ({ value: r.code, label: `Stopień (OH-ek): ${r.labelPl}` })),
                ...badges.map((b) => ({ value: b.code, label: `Sprawność: ${b.labelPl}` })),
              ]}
              hint="Lista pochodzi ze słowników wersjonowanych — nie z kodu aplikacji."
            />
          </ActionForm>
        </Card>
      </div>

      <Card title="Otwarte karty w jednostce" bodyless>
        {withCards.length === 0 ? (
          <Empty
            icon="★"
            title="Nikt nie ma otwartej karty"
            hint="Karta stopnia to narzędzie pracy: harcerz widzi listę zadań, zgłasza wykonanie, drużynowy zalicza. Otwórz pierwszą kartę formularzem obok."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Harcerz</th>
                  <th>Zdobywa</th>
                  <th>Status karty</th>
                  <th>Gałąź</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {withCards.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/czlonkowie/${m.id}`}>
                        {m.lastName} {m.firstName}
                      </Link>
                    </td>
                    <td>
                      <strong>{labelFor(labels, m.openCard!.targetCode)}</strong>
                    </td>
                    <td>
                      <StatusBadge dictionary="progressionStatus" value={m.openCard!.status} />
                    </td>
                    <td>
                      <StatusBadge dictionary="branch" value={m.branch} />
                    </td>
                    <td>
                      <Link className="btn btn-sm" href={`/progresja/${m.openCard!.id}`}>
                        Otwórz kartę
                      </Link>
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
