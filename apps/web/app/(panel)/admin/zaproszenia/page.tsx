/**
 * Zaproszenia (§8.2) — oczekujące i wygasłe, ponowna wysyłka, unieważnienie.
 */
import { apiSafe } from '../../../../lib/api';
import { resendInvitation, revokeInvitation } from '../../../actions';
import { InlineAction } from '../../../components/action-form';
import { Alert, Card, Empty, PageHeader } from '../../../components/ui';
import { dateTime } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

interface Invitation {
  id: string;
  personId: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  lastSentAt: string;
}

export default async function InvitationsPage() {
  const invitations = await apiSafe<Invitation[]>('/invitations', []);
  const now = Date.now();
  const pending = invitations.filter(
    (i) => !i.usedAt && !i.revokedAt && new Date(i.expiresAt).getTime() > now,
  );
  const expired = invitations.filter(
    (i) => !i.usedAt && !i.revokedAt && new Date(i.expiresAt).getTime() <= now,
  );

  return (
    <>
      <PageHeader
        title="Zaproszenia"
        subtitle={`${pending.length} oczekujących · ${expired.length} wygasłych`}
        actions={
          <a className="btn" href="/admin">
            Wróć do panelu
          </a>
        }
      />

      <Alert tone="info" title="Bezpieczeństwo tokenów">
        Token zaproszenia istnieje w postaci jawnej wyłącznie w linku wysłanym e-mailem —
        w bazie przechowywany jest tylko jego skrót. Próba użycia tokenu już zużytego kończy się
        neutralnym komunikatem, który nie zdradza, czy konto istnieje.
      </Alert>

      <Card bodyless>
        {invitations.length === 0 ? (
          <Empty
            icon="✉"
            title="Brak zaproszeń"
            hint="Zaproszenie powstaje przy przyjmowaniu osoby do jednostki. Wejdź w Członkowie → Przyjmij do jednostki, podaj imię, nazwisko i adres e-mail."
            action={
              <a className="btn btn-primary" href="/czlonkowie/przyjmij">
                Przyjmij do jednostki
              </a>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Osoba</th>
                  <th>Utworzone</th>
                  <th>Ostatnia wysyłka</th>
                  <th>Wygasa</th>
                  <th>Stan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invitations.map((i) => {
                  const isExpired = new Date(i.expiresAt).getTime() <= now;
                  const state = i.usedAt
                    ? { label: 'Wykorzystane', cls: 'badge badge-success' }
                    : i.revokedAt
                      ? { label: 'Unieważnione', cls: 'badge' }
                      : isExpired
                        ? { label: 'Wygasłe', cls: 'badge badge-warning' }
                        : { label: 'Oczekuje', cls: 'badge badge-info' };
                  const actionable = !i.usedAt && !i.revokedAt;
                  return (
                    <tr key={i.id}>
                      <td>
                        <a href={`/czlonkowie/${i.personId}`}>Profil osoby</a>
                      </td>
                      <td className="small">{dateTime(i.createdAt)}</td>
                      <td className="small">{dateTime(i.lastSentAt)}</td>
                      <td className="small">{dateTime(i.expiresAt)}</td>
                      <td>
                        <span className={state.cls}>{state.label}</span>
                      </td>
                      <td>
                        {actionable && (
                          <span className="row" style={{ gap: 6 }}>
                            <InlineAction
                              action={resendInvitation}
                              label="Wyślij ponownie"
                              hidden={{ invitationId: i.id }}
                            />
                            <InlineAction
                              action={revokeInvitation}
                              label="Unieważnij"
                              variant="danger"
                              hidden={{ invitationId: i.id }}
                              confirm="Unieważnione zaproszenie przestaje działać natychmiast. Kontynuować?"
                            />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
