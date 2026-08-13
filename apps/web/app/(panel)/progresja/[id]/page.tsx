/**
 * Karta próby (§12.1) — wspólny UX dla obu organizacji.
 *
 * Różnica między OH-y a OH-ek dotyczy wyłącznie formalnego domknięcia (które
 * przejścia stanów wymagają pozycji w rozkazie), a nie wyglądu karty. Dlatego
 * ten widok jest jeden, a dozwolone akcje wynikają ze stanu zwróconego przez API.
 *
 * Wycofanie się z wyczynu jest akcją dozwoloną i NIEOCENIAJĄCĄ (§12.2) —
 * prezentujemy je neutralnie, bez ostrzeżeń i bez czerwieni.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiSafe } from '../../../../lib/api';
import { approveFeat, submitRequirement, verifyRequirement, withdrawFeat } from '../../../actions';
import { InlineAction } from '../../../components/action-form';
import { Alert, Card, DefinitionList, PageHeader, Progress, StatusBadge } from '../../../components/ui';
import { date, dateTime } from '../../../../lib/format';
import { labelFor, progressionLabels } from '../../../../lib/dictionaries';

export const dynamic = 'force-dynamic';

interface Requirement {
  id: string;
  code: string;
  areaCode: string | null;
  description: string;
  status: string;
  evidence: { comment?: string; attachments?: string[] } | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  isFeat: boolean;
  featApprovedByPersonId: string | null;
}

interface CardData {
  instance: {
    id: string;
    personId: string;
    unitId: string;
    kind: string;
    branch: string;
    targetCode: string;
    status: string;
    startedAt: string;
    deadline: string | null;
    requirementSetVersionId: string;
    requirements: Requirement[];
  };
  person: { id: string; firstName: string; lastName: string } | null;
}

export default async function ProgressionCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await apiSafe<CardData | null>(`/directory/progression/${id}`, null);
  if (!data) notFound();

  const labels = await progressionLabels();
  const i = data.instance;
  const verified = i.requirements.filter((r) => r.status === 'VERIFIED').length;
  const total = i.requirements.filter((r) => r.status !== 'REPLACED').length;

  return (
    <>
      <PageHeader
        title={labelFor(labels, i.targetCode)}
        subtitle={
          data.person ? `${data.person.firstName} ${data.person.lastName}` : 'Karta próby'
        }
        actions={
          <>
            {data.person && (
              <Link className="btn" href={`/czlonkowie/${data.person.id}`}>
                Profil harcerza
              </Link>
            )}
            <Link className="btn" href="/progresja">
              Wróć do progresji
            </Link>
          </>
        }
      />

      <div className="grid grid-2 mb-5">
        <Card title="Stan karty">
          <DefinitionList
            items={[
              ['Rodzaj', <StatusBadge key="k" dictionary="progressionKind" value={i.kind} />],
              ['Status', <StatusBadge key="s" dictionary="progressionStatus" value={i.status} />],
              ['Gałąź', <StatusBadge key="b" dictionary="branch" value={i.branch} />],
              ['Rozpoczęta', date(i.startedAt)],
              ['Termin', date(i.deadline)],
            ]}
          />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Progress value={verified} max={total} />
            <div className="xs muted" style={{ marginTop: 4 }}>
              {verified} z {total} zadań zaliczonych
            </div>
          </div>
        </Card>

        <Alert tone="info" title="Wersja regulaminu">
          Karta jest rozliczana według wersji wymagań obowiązującej w dniu jej otwarcia.
          Późniejsza zmiana regulaminu nie zmienia zadań tej próby — nowa wersja obowiązuje
          dopiero karty otwarte po jej wejściu w życie.
          <div className="xs mono muted" style={{ marginTop: 'var(--space-2)' }}>
            requirementSetVersionId: {i.requirementSetVersionId}
          </div>
        </Alert>
      </div>

      <Card title="Zadania">
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {i.requirements.map((r) => (
            <li
              key={r.id}
              style={{
                borderBottom: '1px solid var(--border)',
                paddingBottom: 'var(--space-4)',
                opacity: r.status === 'REPLACED' ? 0.55 : 1,
              }}
            >
              <div className="spread mb-3">
                <div className="grow">
                  <strong>{r.description}</strong>
                  <div className="xs muted">
                    <code className="mono">{r.code}</code>
                    {r.areaCode && ` · obszar: ${r.areaCode}`}
                  </div>
                </div>
                <span className="row" style={{ gap: 4 }}>
                  {r.isFeat && <span className="badge badge-warning">wyczyn</span>}
                  <StatusBadge dictionary="requirementStatus" value={r.status} />
                </span>
              </div>

              {r.evidence?.comment && (
                <p className="small muted" style={{ marginBottom: 'var(--space-2)' }}>
                  „{r.evidence.comment}”
                  {r.submittedAt && (
                    <span className="xs"> — zgłoszone {dateTime(r.submittedAt)}</span>
                  )}
                </p>
              )}

              {r.isFeat && !r.featApprovedByPersonId && r.status !== 'VERIFIED' && (
                <p className="xs muted" style={{ marginBottom: 'var(--space-2)' }}>
                  Wyczyn wymaga zatwierdzenia warunków bezpieczeństwa przez hufcowego albo
                  komendanta obozu, chyba że drużynowy w stopniu co najmniej podharcmistrza
                  został z tego zwolniony rozkazem.
                </p>
              )}

              <div className="btn-row">
                {r.status === 'PENDING' && (
                  <form
                    action={async (fd: FormData) => {
                      'use server';
                      await submitRequirement({ ok: false }, fd);
                    }}
                    className="row grow"
                  >
                    <input type="hidden" name="requirementId" value={r.id} />
                    <input type="hidden" name="instanceId" value={i.id} />
                    <input
                      type="text"
                      name="comment"
                      placeholder="Jak zadanie zostało wykonane…"
                      aria-label={`Komentarz do zadania ${r.code}`}
                      className="grow"
                      required
                    />
                    <button className="btn btn-sm" type="submit">
                      Zgłoś wykonanie
                    </button>
                  </form>
                )}

                {r.status === 'SUBMITTED' && (
                  <InlineAction
                    action={verifyRequirement}
                    label="Zalicz zadanie"
                    variant="primary"
                    hidden={{ requirementId: r.id, instanceId: i.id }}
                  />
                )}

                {r.isFeat && !r.featApprovedByPersonId && (
                  <InlineAction
                    action={approveFeat}
                    label="Zatwierdź warunki wyczynu"
                    hidden={{ requirementId: r.id, instanceId: i.id }}
                  />
                )}

                {r.isFeat && r.status !== 'VERIFIED' && (
                  <InlineAction
                    action={withdrawFeat}
                    label="Wycofaj się z wyczynu"
                    hidden={{ requirementId: r.id, instanceId: i.id }}
                  />
                )}

                {r.verifiedAt && (
                  <span className="xs muted">zaliczone {dateTime(r.verifiedAt)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
