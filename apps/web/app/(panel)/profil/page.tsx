/**
 * Profil zalogowanego użytkownika — dane, funkcje i preferencja motywu.
 */
import { apiSafe } from '../../../lib/api';
import { requireSession } from '../../../lib/session';
import { Alert, Card, DefinitionList, Empty, PageHeader, StatusBadge } from '../../components/ui';
import { ThemeToggle } from '../../components/theme-toggle';

export const dynamic = 'force-dynamic';

interface Me {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    branch: string;
    status: string;
    membershipCategory: string;
    instructorRank: string | null;
  } | null;
  isSysadmin: boolean;
  units: Array<{ id: string; displayName: string; isLeader: boolean; isActing: boolean }>;
}

export default async function ProfilePage() {
  const session = await requireSession();
  const me = await apiSafe<Me>(`/directory/me?sub=${encodeURIComponent(session.sub)}`, {
    person: null,
    isSysadmin: false,
    units: [],
  });

  return (
    <>
      <PageHeader
        title="Mój profil"
        subtitle={me.person ? `${me.person.firstName} ${me.person.lastName}` : 'Konto bez profilu'}
        actions={
          me.person && (
            <a className="btn" href={`/czlonkowie/${me.person.id}`}>
              Pełna karta osoby
            </a>
          )
        }
      />

      <div className="grid grid-2">
        <Card title="Konto">
          <DefinitionList
            items={[
              ['Zalogowany jako', session.email ?? session.name ?? '—'],
              ['Identyfikator konta', <code key="s" className="mono xs">{session.sub}</code>],
              [
                'Uprawnienia systemowe',
                <span key="r" className="row" style={{ gap: 4 }}>
                  {session.isRoot && <span className="badge badge-danger">ROOT</span>}
                  {me.isSysadmin && <span className="badge badge-accent">SYSADMIN</span>}
                  {!session.isRoot && !me.isSysadmin && <span className="muted">brak</span>}
                </span>,
              ],
              ...(me.person
                ? ([
                    [
                      'Status profilu',
                      <StatusBadge key="st" dictionary="personStatus" value={me.person.status} />,
                    ],
                    [
                      'Kategoria',
                      <StatusBadge
                        key="c"
                        dictionary="membershipCategory"
                        value={me.person.membershipCategory}
                      />,
                    ],
                    ['Gałąź', <StatusBadge key="b" dictionary="branch" value={me.person.branch} />],
                    ...(me.person.instructorRank
                      ? [
                          [
                            'Stopień instruktorski',
                            <StatusBadge
                              key="ir"
                              dictionary="instructorRank"
                              value={me.person.instructorRank}
                            />,
                          ],
                        ]
                      : []),
                  ] as Array<[string, React.ReactNode]>)
                : []),
            ]}
          />
          {session.isRoot && (
            <p className="xs muted" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
              Uprawnienie ROOT pochodzi z przynależności do grupy Keycloak, sprawdzanej przy
              każdym logowaniu — nie jest zapisane w bazie aplikacji ani powiązane z adresem
              e-mail.
            </p>
          )}
        </Card>

        <div className="stack">
          <Card title="Wygląd">
            <p className="small muted">
              Wybór obowiązuje natychmiast na tym urządzeniu. Tryb systemowy podąża za
              ustawieniem systemu operacyjnego i reaguje na jego zmianę bez przeładowania strony.
            </p>
            <ThemeToggle />
            <p className="xs muted" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
              Wydruki i generowane PDF-y zawsze używają jasnej palety, niezależnie od wybranego
              motywu.
            </p>
          </Card>

          <Card title="Moje jednostki">
            {me.units.length === 0 ? (
              <Empty
                icon="⌂"
                title="Brak przypisania do jednostki"
                hint="Przydział i funkcje nadaje się rozkazem. Do tego czasu nie masz kontekstu jednostki w panelu."
              />
            ) : (
              <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {me.units.map((u) => (
                  <li key={u.id} className="spread">
                    <a href={`/jednostki/${u.id}`}>{u.displayName}</a>
                    <span className="row" style={{ gap: 4 }}>
                      {u.isLeader && <span className="badge badge-accent">funkcja</span>}
                      {u.isActing && <span className="badge badge-warning">p.o.</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {!me.person && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <Alert tone="warning" title="Konto bez profilu w ewidencji">
            Logowanie działa, ale konto nie ma powiązanego rekordu osoby, więc nie ma przydziału,
            funkcji ani historii. Profil zakłada administrator — dla kont bootstrapowych robi to
            skrypt <code className="mono">pnpm --filter @harc/db run bootstrap</code>.
          </Alert>
        </div>
      )}
    </>
  );
}
