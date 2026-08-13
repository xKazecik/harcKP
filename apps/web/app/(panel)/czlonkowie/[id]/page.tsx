/**
 * Profil osoby (§12.5): dane, opiekunowie, funkcje, karty progresji i oś czasu
 * osobistego dziennika zdarzeń.
 *
 * Dla profilu archiwalnego widok pokazuje PEŁNĄ, nieokrojoną historię (§8.3) —
 * archiwizacja nie kasuje danych, tylko wyprowadza osobę z widoków operacyjnych.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiSafe } from '../../../../lib/api';
import { addGuardian, archivePerson } from '../../../actions';
import { ActionForm, Field, Select, TextArea } from '../../../components/action-form';
import {
  Alert,
  Card,
  DefinitionList,
  Empty,
  PageHeader,
  Progress,
  StatusBadge,
} from '../../../components/ui';
import { date, dateTime, orDash } from '../../../../lib/format';
import { text } from '../../../../lib/labels';
import { labelFor, progressionLabels } from '../../../../lib/dictionaries';

export const dynamic = 'force-dynamic';

interface Profile {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    historicalEmail: string | null;
    status: string;
    branch: string;
    membershipCategory: string;
    age: number | null;
    birthDate: string | null;
    school: string | null;
    phone: string | null;
    crossNumber: string | null;
    promiseDate: string | null;
    instructorPledgeDate: string | null;
    archivedAt: string | null;
    archiveReason: string | null;
    archiveReasonText: string | null;
    guardianConsent: 'NOT_REQUIRED' | 'MISSING' | 'PRESENT';
    guardians: Array<{ id: string; fullName: string; phone: string; email: string | null; address: string; consentGivenAt: string | null }>;
    instructorProfile: {
      rank: string;
      listType: string;
      rankAwardedAt: string;
      onLeaveUntil: string | null;
      minorProtectionValidUntil: string | null;
      standardsAcknowledgedAt: string | null;
    } | null;
  };
  memberships: Array<{ unitId: string; unitName: string; validFrom: string; validTo: string | null }>;
  leaderships: Array<{ unitId: string; unitName: string; isActing: boolean; validFrom: string; validTo: string | null }>;
  progression: Array<{
    id: string;
    kind: string;
    targetCode: string;
    status: string;
    startedAt: string;
    total: number;
    verified: number;
    submitted: number;
  }>;
  events: Array<{ id: string; eventType: string; occurredAt: string; payload: Record<string, unknown> }>;
  pendingInvitation: { id: string; expiresAt: string; lastSentAt: string } | null;
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await apiSafe<Profile | null>(`/directory/persons/${id}`, null);
  if (!data) notFound();

  const labels = await progressionLabels();
  const p = data.person;
  const isArchived = p.status === 'ARCHIVED';

  return (
    <>
      <PageHeader
        title={`${p.firstName} ${p.lastName}`}
        subtitle={[
          text('membershipCategory', p.membershipCategory),
          text('branch', p.branch),
          p.age != null ? `${p.age} lat` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Link className="btn" href="/czlonkowie">
              Wróć do listy
            </Link>
            {!isArchived && (
              <Link className="btn" href={`/progresja?person=${p.id}`}>
                Karty progresji
              </Link>
            )}
          </>
        }
      />

      {isArchived && (
        <Alert tone="warning" title="Profil archiwalny">
          Zarchiwizowany {date(p.archivedAt)} — powód: {orDash(p.archiveReason)}
          {p.archiveReasonText ? ` (${p.archiveReasonText})` : ''}. Dane nie zostały skasowane;
          poniżej widoczna jest pełna historia. Adres e-mail został zwolniony
          {p.historicalEmail ? ` (historycznie: ${p.historicalEmail})` : ''} i może być użyty
          dla innej osoby. Przywrócenie profilu wymaga świadomego podania nowego, wolnego adresu.
        </Alert>
      )}

      {p.guardianConsent === 'MISSING' && (
        <Alert tone="warning" title="Brak odnotowanej zgody rodzica">
          Osoba nie ukończyła 16 lat, a w systemie nie ma opiekuna z odnotowaną zgodą. To
          przypomnienie, nie blokada — członkostwo i progresja działają normalnie. Uzupełnij dane
          opiekuna w sekcji poniżej.
        </Alert>
      )}

      {data.pendingInvitation && (
        <Alert tone="info" title="Zaproszenie oczekuje na wykorzystanie">
          Link jest ważny do {dateTime(data.pendingInvitation.expiresAt)}, ostatnio wysłany{' '}
          {dateTime(data.pendingInvitation.lastSentAt)}. Ponowną wysyłkę i unieważnienie znajdziesz
          w <Link href="/admin/zaproszenia">panelu zaproszeń</Link>.
        </Alert>
      )}

      <div className="grid grid-2 mb-5">
        <Card title="Dane osobowe">
          <DefinitionList
            items={[
              ['Status', <StatusBadge key="s" dictionary="personStatus" value={p.status} />],
              ['E-mail', orDash(p.email)],
              ['Telefon', orDash(p.phone)],
              ['Data urodzenia', date(p.birthDate)],
              ['Szkoła', orDash(p.school)],
              ['Numer Krzyża', orDash(p.crossNumber)],
              ['Przyrzeczenie', date(p.promiseDate)],
              ...(p.instructorPledgeDate
                ? ([['Zobowiązanie Instruktorskie', date(p.instructorPledgeDate)]] as Array<[string, React.ReactNode]>)
                : []),
            ]}
          />
        </Card>

        {p.instructorProfile ? (
          <Card title="Służba instruktorska">
            <DefinitionList
              items={[
                [
                  'Stopień',
                  <StatusBadge key="r" dictionary="instructorRank" value={p.instructorProfile.rank} />,
                ],
                ['Przyznany', date(p.instructorProfile.rankAwardedAt)],
                [
                  'Lista',
                  <StatusBadge key="l" dictionary="listType" value={p.instructorProfile.listType} />,
                ],
                ['Urlop do', date(p.instructorProfile.onLeaveUntil)],
                [
                  'Ochrona małoletnich',
                  p.instructorProfile.minorProtectionValidUntil ? (
                    <span key="m">
                      ważna do {date(p.instructorProfile.minorProtectionValidUntil)}
                    </span>
                  ) : (
                    <span key="m" className="badge badge-danger">
                      brak weryfikacji
                    </span>
                  ),
                ],
                ['Standardy potwierdzone', date(p.instructorProfile.standardsAcknowledgedAt)],
              ]}
            />
            <p className="xs muted" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
              System przechowuje wyłącznie daty weryfikacji — nigdy treści zaświadczeń.
            </p>
          </Card>
        ) : (
          <Card title="Funkcje i przydział">
            {data.leaderships.length === 0 && data.memberships.length === 0 ? (
              <Empty
                icon="⚜"
                title="Brak funkcji i przydziału"
                hint="Funkcje nadaje się rozkazem właściwej jednostki. Sama nazwa funkcji nie daje uprawnień technicznych — te są nadawane osobno."
              />
            ) : (
              <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {data.leaderships.map((l) => (
                  <li key={`${l.unitId}-${l.validFrom}`} className="spread">
                    <Link href={`/jednostki/${l.unitId}`}>{l.unitName}</Link>
                    <span className="row">
                      {l.isActing && <span className="badge badge-warning">p.o.</span>}
                      <span className="badge badge-accent">funkcja</span>
                      {l.validTo && <span className="xs muted">do {date(l.validTo)}</span>}
                    </span>
                  </li>
                ))}
                {data.memberships.map((m) => (
                  <li key={`${m.unitId}-${m.validFrom}`} className="spread">
                    <Link href={`/jednostki/${m.unitId}`}>{m.unitName}</Link>
                    <span className="xs muted">
                      członkostwo od {date(m.validFrom)}
                      {m.validTo ? ` do ${date(m.validTo)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <div className="grid grid-2 mb-5">
        <Card title="Karty stopni i sprawności">
          {data.progression.length === 0 ? (
            <Empty
              icon="★"
              title="Brak otwartych i zamkniętych kart"
              hint="Kartę otwiera się z profilu harcerza przyciskiem „rozpocznij zdobywanie stopnia”. Zestaw zadań pobiera się z aktualnej wersji regulaminu i pozostaje z nią związany do końca próby."
              action={
                !isArchived && (
                  <Link className="btn btn-primary" href={`/progresja?person=${p.id}`}>
                    Otwórz kartę
                  </Link>
                )
              }
            />
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.progression.map((g) => (
                <li key={g.id}>
                  <div className="spread mb-3">
                    <Link href={`/progresja/${g.id}`}>
                      <strong>{labelFor(labels, g.targetCode)}</strong>
                    </Link>
                    <span className="row" style={{ gap: 4 }}>
                      <StatusBadge dictionary="progressionKind" value={g.kind} />
                      <StatusBadge dictionary="progressionStatus" value={g.status} />
                    </span>
                  </div>
                  <Progress value={g.verified} max={g.total} />
                  <div className="xs muted" style={{ marginTop: 4 }}>
                    {g.verified} z {g.total} zaliczonych
                    {g.submitted > 0 ? ` · ${g.submitted} czeka na ocenę` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Opiekunowie prawni">
          {p.guardians.length > 0 && (
            <ul className="stack-sm mb-4" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {p.guardians.map((g) => (
                <li key={g.id} className="spread">
                  <span>
                    {g.fullName}
                    <span className="xs muted"> · {g.phone}</span>
                  </span>
                  {g.consentGivenAt ? (
                    <span className="badge badge-success">zgoda {date(g.consentGivenAt)}</span>
                  ) : (
                    <span className="badge badge-warning">bez zgody</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!isArchived && (
            <details>
              <summary className="btn btn-sm" style={{ cursor: 'pointer' }}>
                Dodaj opiekuna
              </summary>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <ActionForm action={addGuardian} submitLabel="Zapisz opiekuna">
                  <input type="hidden" name="personId" value={p.id} />
                  <Field name="fullName" label="Imię i nazwisko" required />
                  <div className="field-row">
                    <Field name="phone" label="Telefon" required />
                    <Field name="email" label="E-mail" type="email" />
                  </div>
                  <Field name="address" label="Adres" required />
                  <Field
                    name="consentGivenAt"
                    label="Data zgody"
                    type="date"
                    hint="Zostaw puste, jeśli zgoda nie została jeszcze odebrana — przypomnienie pozostanie aktywne."
                  />
                </ActionForm>
              </div>
            </details>
          )}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Osobisty dziennik zdarzeń">
          {data.events.length === 0 ? (
            <Empty
              icon="🕘"
              title="Dziennik jest pusty"
              hint="Wpisy powstają automatycznie z pozycji rozkazów: przyjęcia, mianowania, stopnie, sprawności, pochwały i kary. Nie da się ich dodać ręcznie."
            />
          ) : (
            <ul className="timeline">
              {data.events.map((e) => (
                <li key={e.id}>
                  <time>{dateTime(e.occurredAt)}</time>
                  <strong>{e.eventType}</strong>
                  {typeof e.payload?.note === 'string' && (
                    <div className="small muted">{e.payload.note}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {!isArchived && (
          <Card title="Archiwizacja profilu">
            <p className="small muted">
              Archiwizacja nie kasuje danych. Osoba znika ze składów jednostek, list wyboru i
              statystyk, ale pozostaje w rozkazach, dziennikach i audit logu. Adres e-mail zostaje
              zwolniony i może być natychmiast użyty przez kogoś innego.
            </p>
            <ActionForm action={archivePerson} submitLabel="Archiwizuj profil" variant="danger">
              <input type="hidden" name="personId" value={p.id} />
              <Select
                name="reason"
                label="Powód"
                required
                options={[
                  { value: 'WYSTAPIENIE', label: 'Wystąpienie' },
                  { value: 'ZWOLNIENIE', label: 'Zwolnienie' },
                  { value: 'WYKLUCZENIE', label: 'Wykluczenie' },
                  { value: 'SMIERC', label: 'Śmierć' },
                  { value: 'BLAD_DANYCH', label: 'Błąd danych' },
                  { value: 'INNY', label: 'Inny' },
                ]}
              />
              <TextArea name="reasonText" label="Uzasadnienie" rows={2} />
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
