/**
 * Role administracyjne i delegacje (§10.1, §10.4).
 *
 * Formularze niczego nie rozstrzygają — reguły („sysadmin nie tyka sysadmina",
 * „delegować można tylko własne i tylko delegowalne") żyją w domenie i są
 * wymuszane przez API. Ta strona co najwyżej pokazuje czytelny komunikat, gdy
 * API odmówi.
 *
 * Nadanie roli to co innego niż nadanie funkcji. Funkcję (Kwatermistrz,
 * Przyboczny) nadaje się rozkazem i sama z siebie NIE daje uprawnień
 * technicznych — te trzeba dołożyć jawną delegacją poniżej.
 */
import Link from 'next/link';
import { apiSafe } from '../../../../lib/api';
import {
  grantAdminRole,
  grantDelegation,
  revokeAdminRole,
  revokeDelegation,
} from '../../../actions';
import { ActionForm, Field, InlineAction, Select } from '../../../components/action-form';
import { Alert, Card, Empty, PageHeader } from '../../../components/ui';
import { date } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

interface Grant {
  id: string;
  personId: string;
  role: string;
  unitId: string | null;
  grantedByPersonId: string | null;
  grantedAt: string;
  revokedAt: string | null;
}

interface Delegation {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  action: string;
  unitId: string;
  expiresAt: string;
  revokedAt: string | null;
}

interface UnitRef {
  id: string;
  displayName: string;
}

export default async function RolesPage() {
  const [units, grants, delegations, competences] = await Promise.all([
    apiSafe<UnitRef[]>('/directory/units', []),
    apiSafe<Grant[]>('/admin/admin-grants', []),
    apiSafe<Delegation[]>('/admin/delegations', []),
    apiSafe<Array<{ action: string; delegable: boolean; legalBasis: string }>>(
      '/admin/competences',
      [],
    ),
  ]);

  const unitName = (id: string | null): string =>
    id ? (units.find((u) => u.id === id)?.displayName ?? id) : '—';

  const activeGrants = grants.filter((g) => !g.revokedAt);
  const activeDelegations = delegations.filter((d) => !d.revokedAt);
  const delegableActions = competences.filter((c) => c.delegable);

  return (
    <>
      <PageHeader
        title="Role i delegacje"
        subtitle="Uprawnienia administracyjne oraz pojedyncze kompetencje nadane funkcyjnym"
        actions={
          <Link className="btn" href="/admin">
            Wróć do panelu
          </Link>
        }
      />

      <Alert tone="info" title="Funkcja to nie to samo co uprawnienie">
        Mianowanie kogoś kwatermistrzem czy v-ce hufcowym jest wpisem
        ewidencyjnym i samo w sobie nie daje nic w systemie. Żeby taka osoba
        mogła coś zrobić, trzeba jej jawnie delegować konkretną kompetencję —
        na czas określony. Kompetencje z urzędu ma wyłącznie komendant jednostki.
      </Alert>

      <div className="grid grid-2 mb-5">
        <Card title="Nadaj rolę administracyjną">
          <p className="small muted">
            Rolę sysadmina nadaje i odbiera wyłącznie root. Administrator jednostki
            działa w swojej jednostce i w jednostkach jej podległych.
          </p>
          <ActionForm action={grantAdminRole} submitLabel="Nadaj rolę">
            <Field
              name="targetPersonId"
              label="Identyfikator osoby"
              required
              hint="UUID z adresu karty osoby (/czlonkowie/<id>)."
            />
            <Select
              name="role"
              label="Rola"
              required
              options={[
                { value: 'UNIT_ADMIN', label: 'Administrator jednostki' },
                { value: 'SYSADMIN', label: 'Sysadmin (tylko root)' },
              ]}
            />
            <Select
              name="unitId"
              label="Jednostka"
              allowEmpty="— dla sysadmina zostaw puste —"
              options={units.map((u) => ({ value: u.id, label: u.displayName }))}
              hint="Wymagane dla administratora jednostki."
            />
          </ActionForm>
        </Card>

        <Card title="Deleguj kompetencję">
          <p className="small muted">
            Delegować można wyłącznie kompetencje oznaczone jako delegowalne
            i tylko takie, które sam posiadasz w tej jednostce. Delegacja zawsze
            ma termin.
          </p>
          {delegableActions.length === 0 ? (
            <Empty
              icon="🔑"
              title="Brak kompetencji delegowalnych"
              hint="Żaden wiersz macierzy nie ma znacznika delegable. Sprawdź słownik kompetencji w panelu administracyjnym."
            />
          ) : (
            <ActionForm action={grantDelegation} submitLabel="Nadaj delegację">
              <Field name="toPersonId" label="Identyfikator osoby" required />
              <Select
                name="action"
                label="Kompetencja"
                required
                allowEmpty="— wybierz —"
                options={delegableActions.map((c) => ({ value: c.action, label: c.action }))}
                hint="Lista pochodzi z macierzy kompetencji, nie z kodu."
              />
              <Select
                name="unitId"
                label="Jednostka"
                required
                allowEmpty="— wybierz —"
                options={units.map((u) => ({ value: u.id, label: u.displayName }))}
              />
              <Field name="expiresAt" label="Wygasa" type="date" required />
            </ActionForm>
          )}
        </Card>
      </div>

      <Card title={`Aktywne role (${activeGrants.length})`} bodyless>
        {activeGrants.length === 0 ? (
          <Empty
            icon="🛡"
            title="Nikt nie ma roli administracyjnej"
            hint="Root wynika z grupy w Keycloak i nie pojawia się na tej liście. Pierwszego sysadmina nadaje root formularzem powyżej."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Osoba</th>
                  <th>Rola</th>
                  <th>Jednostka</th>
                  <th>Nadano</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {activeGrants.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <Link href={`/czlonkowie/${g.personId}`}>
                        <code className="mono small">{g.personId.slice(0, 8)}…</code>
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${g.role === 'SYSADMIN' ? 'badge-warning' : ''}`}>
                        {g.role === 'SYSADMIN' ? 'Sysadmin' : 'Administrator jednostki'}
                      </span>
                    </td>
                    <td className="small">{unitName(g.unitId)}</td>
                    <td className="xs muted">{date(g.grantedAt)}</td>
                    <td>
                      <InlineAction
                        action={revokeAdminRole}
                        label="Odbierz"
                        variant="danger"
                        hidden={{ grantId: g.id }}
                        confirm="Odebrać to uprawnienie? Rekord zostanie w historii jako odebrany."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Aktywne delegacje (${activeDelegations.length})`} bodyless>
        {activeDelegations.length === 0 ? (
          <Empty
            icon="🔑"
            title="Brak delegacji"
            hint="Tu trafiają pojedyncze kompetencje nadane funkcyjnym — na przykład zatwierdzanie planów pracy powierzone członkowi komendy hufca."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Osoba</th>
                  <th>Kompetencja</th>
                  <th>Jednostka</th>
                  <th>Wygasa</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {activeDelegations.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/czlonkowie/${d.toPersonId}`}>
                        <code className="mono small">{d.toPersonId.slice(0, 8)}…</code>
                      </Link>
                    </td>
                    <td>
                      <code className="mono small">{d.action}</code>
                    </td>
                    <td className="small">{unitName(d.unitId)}</td>
                    <td className="xs muted">{date(d.expiresAt)}</td>
                    <td>
                      <InlineAction
                        action={revokeDelegation}
                        label="Odwołaj"
                        variant="danger"
                        hidden={{ delegationId: d.id }}
                      />
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
