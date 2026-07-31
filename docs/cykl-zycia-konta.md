# Cykl życia konta (§8)

Konto zakłada komendant — rejestracja własna jest wyłączona w aplikacji
(`ALLOW_REGISTRATION=false`) i w realmie Keycloak.

## Stany profilu

```
INVITED ──(kreator ukończony)──> ACTIVE ──(archivePerson)──> ARCHIVED
   │                                ▲                            │
   └──(wygaśnięcie/unieważnienie:   └───────(restorePerson ──────┘
       profil pozostaje INVITED,            z NOWYM adresem)
       możliwa ponowna wysyłka)
```

## Zaproszenie

1. Komendant wypełnia **trzy pola**: imię, nazwisko, e-mail.
2. Powstają: `Person(INVITED)`, użytkownik Keycloak (`username = person.id`,
   bez poświadczeń), `Invitation` (token 32 B, w bazie wyłącznie SHA-256).
3. E-mail z linkiem `{APP_URL}/zaproszenie/{token}` (TTL: `INVITATION_TTL_HOURS`).
4. Kreator: hasło (Keycloak `execute-actions-email` z `UPDATE_PASSWORD`; tryb
   awaryjny `reset-password`) → profil → opiekun → aktywacja.
5. Każdy niepoprawny token (zużyty/unieważniony/wygasły/nieistniejący) daje
   ten sam neutralny komunikat.

**Zgoda rodzica (<16 lat).** Decyzją zamawiającego (2026-07-31) krok opiekuna
jest NIEBLOKUJĄCY: pominięcie skutkuje statusem `MISSING` widocznym na profilu
i przypomnieniem dla drużynowego („dołącz pozwolenie od rodzica do profilu"),
wysyłanym też w powiadomieniu o aktywacji. `TODO(regulamin)`: potwierdzić w GK.

**Profil bez konta.** `Person` bez `keycloakUserId`, status `ACTIVE` —
pełnoprawny ewidencyjnie (stopnie, sprawności), bez logowania. „Podniesienie"
do konta = wysłanie zaproszenia.

## Archiwizacja

`archivePerson(personId, reason)` nigdy nie kasuje danych:

1. `status=ARCHIVED` + metadane (kto, kiedy, powód).
2. `email` → `historicalEmail`, `email = NULL` — **adres natychmiast wolny**.
3. Keycloak: `enabled=false`, e-mail → tombstone
   `{personId}@{ACCOUNT_ARCHIVE_TOMBSTONE_DOMAIN}`, sesje unieważnione,
   poświadczenia usunięte. `username` (UUID) nigdy się nie zmienia.
4. Karty progresji w toku → `ABANDONED`; rozkazy, dzienniki i audit log
   pozostają nietknięte.

## Unikalność adresu (§8.4)

Egzekwowana częściowym indeksem PostgreSQL (nie w kodzie):

```sql
CREATE UNIQUE INDEX person_active_email_unique
  ON "Person" (lower(email))
  WHERE status IN ('INVITED', 'ACTIVE') AND email IS NOT NULL;
```

`historicalEmail` nie ma ograniczeń — ten sam adres może wystąpić w wielu
archiwalnych profilach (rodzeństwo ze wspólną skrzynką).

## Przywrócenie

`restorePerson(personId, newEmail)`: adres wpisywany świadomie; zajęty →
`409 EMAIL_ALREADY_IN_USE` (bez ujawniania czyj); identyczny z
`historicalEmail` → wymagane jawne potwierdzenie (`CONFIRM_HISTORICAL_EMAIL`).
Po przywróceniu wychodzi NOWE zaproszenie — stare poświadczenia nigdy nie
wracają. Funkcje i przydziały nie wracają automatycznie (osobne rozkazy).

## Trwałe usunięcie (RODO)

Wyłącznie root, z uzasadnieniem. Anonimizacja (pseudonim `Osoba #{skrót}`),
nie kasowanie rekordów. PDF-y rozkazów pozostają nienaruszone — rozkaz jest
dokumentem organizacji.
