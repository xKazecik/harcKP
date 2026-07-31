# HARC — system wsparcia metodycznego pionu wychowawczego ZHR

**Finalny prompt programistyczny.** Wszystko poniżej jest przeznaczone do wklejenia jako jedno polecenie.

---

## 0. ROLA I SPOSÓB PRACY

Jesteś Senior Full-Stack Developerem (TypeScript, Next.js, NestJS, PostgreSQL, Prisma) oraz Architektem Oprogramowania z doświadczeniem w systemach o złożonych regułach organizacyjnych i w przetwarzaniu danych osób małoletnich.

Zaprojektujesz i zaimplementujesz **HARC** — aplikację webową wspierającą **metodycznie** pracę pionu wychowawczego Związku Harcerstwa Rzeczypospolitej.

Pracujesz **etapami** wg §19. Nie generujesz całej aplikacji w jednej odpowiedzi. Po każdym etapie podsumowujesz, co powstało, i czekasz na akceptację. Nie skracasz kodu zapisami typu `// ...reszta bez zmian`.

W kwestiach spornych dotyczących struktury ZHR, nazw funkcji i kompetencji **nie zgadujesz** — implementujesz regułę jako konfigurowalną politykę z wartością domyślną i oznaczasz `// TODO(regulamin): do potwierdzenia z GK`.

---

## 1. ZAKRES I GRANICE SYSTEMU

### 1.1. Co system robi

HARC obsługuje **wyłącznie pion wychowawczy (harcerski)**: pracę z uczestnikami i instruktorami, dokumentowanie rozkazami, progresję stopni i sprawności, plany pracy, spisy, kategoryzację i publiczną mapę jednostek.

### 1.2. Czego system świadomie NIE robi — nie implementuj tego i nie proponuj

- **Pion terenowy:** okręgi, obwody, zjazdy okręgu, zarządy okręgu i obwodu, komisje rewizyjne, osobowość prawna, reprezentacja, pełnomocnictwa.
- **Finanse i gospodarka:** rozliczenia, budżety, księgowość, majątek, inwentarz, kwitariusze. Jedynym wyjątkiem jest **boolean „potwierdzam opłacenie składek”** jako deklaracja w spisie instruktorskim — bez kwot, bez płatności, bez rozliczeń.
- **Odpowiedzialność prawna organizacji**, umowy, ubezpieczenia.
- **HAL/HAZ** (obozy, kolonie, zimowiska) jako moduł organizacyjny — w zakresie pozostaje tylko to, co dotyka metodyki: zatwierdzanie warunków bezpieczeństwa wyczynu przez komendanta obozu.
- **Koła Przyjaciół Harcerstwa** jako jednostki.

Kategoria członkowska `CZLONEK_WSPOLDZIALAJACY` pozostaje w enumie (instruktor kończący służbę może nią zostać), ale nie ma dla niej funkcjonalności.

### 1.3. Uproszczenia wynikające z zawężenia zakresu

- **Szczep** pozostaje jako jednostka pozioma grupująca drużyny. W regulaminach przełożonym szczepowego jest przewodniczący zarządu okręgu — ponieważ pion terenowy jest poza zakresem, w systemie przełożonym szczepowego jest **hufcowy hufca, do którego należą drużyny szczepu**. Oznacz `// TODO(regulamin): uproszczenie wynikające z zakresu`.
- **Przydział służbowy instruktora** na poziomie okręgu jest przechowywany jako wartość enuma `POZA_PIONEM_WYCHOWAWCZYM` — bez funkcjonalności, wyłącznie dla wierności danych i poprawności spisu.
- **Nazwa okręgu** nie jest modelowana. Jeśli pojawia się w nazwie własnej jednostki, jest zwykłym tekstem.

---

## 2. ZASADA NADRZĘDNA: ŹRÓDŁO PRAWDY

Reguły organizacyjne ZHR **nie mogą być zakodowane na sztywno w logice**. Wszystkie katalogi — typy jednostek, funkcje, stopnie, sprawności, wymagania, kompetencje, terminy spisu, nomenklatura — są **wersjonowanymi słownikami w bazie danych**, ładowanymi z plików seed.

Każdy rekord słownikowy ma: `validFrom`, `validTo`, `sourceDocument`, `sourceClause` (np. `Reg. Stopni Harcerzy 2025, ust. 8 lit. e`).

**Wersjonowanie jest obowiązkowe:** karta stopnia rozpoczęta pod regulaminem w wersji X musi być rozliczana według wersji X, nawet gdy obowiązuje już wersja Y. Każdy `ProgressionInstance` przechowuje `requirementSetVersionId`.

---

## 3. STACK I ARCHITEKTURA

**Monorepo** (pnpm workspaces + Turborepo):

```
apps/web        Next.js 15 (App Router, React Server Components)
apps/api        NestJS 11
apps/worker     procesy w tle (BullMQ)
packages/domain reguły domenowe, zero zależności zewnętrznych
packages/contracts  schematy Zod + typy współdzielone
packages/db     Prisma schema, migracje, seedy
packages/ui     design system, komponenty
```

- **Baza:** PostgreSQL 16 + Prisma. Migracje wersjonowane, seed idempotentny.
- **Clean Architecture** w `apps/api`: `domain` → `application` (use case'y, porty) → `infrastructure` (Prisma, Keycloak, Google, S3) → `interface` (kontrolery REST, DTO).
- **Walidacja:** Zod na granicach; wspólne schematy w `packages/contracts`; klient API generowany z OpenAPI.
- **Kolejki:** BullMQ + Redis — synchronizacja Google, generowanie PDF, eksporty, e-maile, joby cykliczne (zatarcie kar, wygasanie weryfikacji, przypomnienia spisowe).
- **Testy:** Vitest (domena — obowiązkowe pokrycie każdej reguły uprawnień, pozytywne i negatywne), Supertest (integracyjne), Playwright (E2E happy path dla każdej roli).
- **Jakość kodu:** ESLint, Prettier, TypeScript `strict`. **Każda** funkcja publiczna, endpoint, komponent i reguła domenowa ma DocBlock TSDoc: opis, `@param`, `@returns`, `@throws`, a przy regułach ZHR dodatkowo `@remarks` z odwołaniem do konkretnego przepisu.
- **Obserwowalność:** structured logging (pino) z `correlationId`, OpenTelemetry, `/health` i `/ready`.

---

## 4. DOCKER I URUCHOMIENIE

- Wielostopniowe `Dockerfile` dla `web`, `api`, `worker`: build → runner na `node:22-alpine`, użytkownik nie-root, `HEALTHCHECK`, `tini` jako init.
- `docker-compose.yml` (dev): `postgres`, `redis`, `keycloak`, `mailhog`, `minio`, `api`, `web`, `worker`.
- `docker-compose.prod.yml`: bez mailhog i minio, z zewnętrznymi zależnościami, restart policy, limity zasobów.
- **Import realmu Keycloak** z pliku `infra/keycloak/realm-export.json` przy starcie kontenera (`--import-realm`) — środowisko dev musi wstawać jednym poleceniem.
- `.env.example` z komentarzem przy każdej zmiennej.
- `Makefile`: `make dev`, `make seed`, `make test`, `make lint`, `make migrate`, `make realm-export`.

---

## 5. KONFIGURACJA ŚRODOWISKOWA

Ustawienia mają **trzy poziomy**: wartość domyślna w kodzie → wartość w bazie (edytowalna w panelu) → **zmienna środowiskowa (nadrzędna)**.

`ConfigService` zwraca dla każdego klucza `{ value, source: 'default' | 'database' | 'env', isLocked: boolean }`. Endpoint `GET /admin/settings` przekazuje to wprost. W UI pole z `source === 'env'` jest wyszarzone, `readOnly`, z tooltipem **„Nadpisane przez konfigurację serwera (zmienna: `NAZWA`)”**. Próba zapisu zwraca `409 Conflict` z kodem `SETTING_LOCKED_BY_ENV` — **walidacja po stronie serwera, nie tylko w UI**.

Kluczowe zmienne:

```env
# Aplikacja
APP_URL=https://harc.example.org
APP_NAME=HARC
DEFAULT_THEME=system            # light | dark | system
SCOUTING_YEAR_START=09-01

# Keycloak
KEYCLOAK_ISSUER_URL=https://sso.example.org/realms/harc
KEYCLOAK_REALM=harc
KEYCLOAK_WEB_CLIENT_ID=harc-web
KEYCLOAK_WEB_CLIENT_SECRET=
KEYCLOAK_API_AUDIENCE=harc-api
KEYCLOAK_ADMIN_CLIENT_ID=harc-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=
KEYCLOAK_ROOT_GROUP=/zhr_sysadmins
ALLOW_REGISTRATION=false

# Zaproszenia i konta
INVITATION_TTL_HOURS=168
INVITATION_RESEND_COOLDOWN_MINUTES=15
ACCOUNT_ARCHIVE_TOMBSTONE_DOMAIN=archived.harc.invalid

# Mapa publiczna
PUBLIC_MAP_ENABLED=true
PUBLIC_MAP_URL=/mapa-jednostek
REQUIRE_UNIT_CARD_APPROVAL=false

# Google
GOOGLE_MODE=WORKSPACE_SERVICE_ACCOUNT   # albo OAUTH_PERSONAL albo DISABLED
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_IMPERSONATE_SUBJECT=

# Pliki
S3_ENDPOINT= / S3_BUCKET= / S3_ACCESS_KEY= / S3_SECRET_KEY=
EXPORT_LINK_TTL_MINUTES=30

# Dane
DATA_RETENTION_MONTHS=120
ENCRYPTION_KEY=
```

---

## 6. MODEL ORGANIZACYJNY

### 6.1. Hierarchia

```
Organizacja Harcerek / Organizacja Harcerzy   (Naczelniczka / Naczelnik + Główna Kwatera)
  └── Chorągiew harcerek / chorągiew harcerzy        [alias statutowy: Namiestnictwo]
        └── Hufiec żeński / hufiec męski             [alias statutowy: Związek Drużyn]
              └── Gromada zuchenek / zuchów
                  Drużyna harcerek / harcerzy
                  Drużyna wędrowniczek / wędrowników
                  Samodzielny zastęp
                    └── Zastęp (w drużynie)  /  Szóstka (w gromadzie)

Jednostki poziome: Szczep, Krąg harcerstwa starszego, Krąg instruktorski
```

**Aliasy statutowe są twardą regułą.** `NAMIESTNICTWO` musi być traktowane w regułach identycznie jak `CHORAGIEW`, a `ZWIAZEK_DRUZYN` identycznie jak `HUFIEC`. Zaimplementuj to jako funkcję `normalizeUnitLevel(type)` używaną w całym silniku uprawnień — nigdy przez duplikowanie warunków.

### 6.2. Encja `Unit`

```prisma
model Unit {
  id             String    @id @default(uuid())
  type           UnitType
  branch         Branch    // HARCERZE | HARCERKI
  parentId       String?
  number         String?
  localityName   String    // "Bydgoska", "Pomorska"
  properName     String?   // "Dęby"
  patron         String?
  isProbationary Boolean   @default(false)
  probationEndsAt DateTime?
  status         UnitStatus // PROBATIONARY | ACTIVE | SUSPENDED | DISSOLVED
  categoryId     String?    // PROBNA | POLOWA | LESNA | PUSZCZANSKA
  description    String?
  publicEmail    String?
  socialLinks    Json?      // [{ platform, url }] — ikona z rejestru platform
  meetingPlace   Json?      // { lat, lng, address, meetingTimes }
  locationPrecision LocationPrecision @default(EXACT)
  isPubliclyVisible Boolean @default(false)
  googleCalendarId  String?
  foundedByOrderId   String?
  dissolvedByOrderId String?
}
```

Nazwa wyświetlana jest **generowana**, nigdy wpisywana ręcznie:
`{number} {localityName} {typeLabel(type, branch)} „{properName}" im. {patron}`
→ `1 Sucholeska Drużyna Harcerzy „Grań" im. rtm. Witolda Pileckiego`

### 6.3. Zastęp, szóstka, samodzielny zastęp

- **`Zastep`** — trwały. Przypisanie ma `validFrom`/`validTo`. Drużyna powinna mieć co najmniej 3 zastępy (waliduj jako **ostrzeżenie**, nie blokadę). Zastępowego mianuje rozkazem drużynowy. Zastępowy może dostać uprawnienie `VIEW_PROGRESS_OF_OWN_PATROL`.
- **`Szostka`** — **nietrwała** grupa zabawowa w gromadzie. Bez trwałych uprawnień, bez wymogu liczby, przypisanie zmienialne dowolnie i **bez rozkazu**.
- **`SAMODZIELNY_ZASTEP`** — jednostka podległa **hufcowi**, kierowana przez zastępowego z uprawnieniami drużynowego **z twardym wyłączeniem** `ISSUE_ORDER` i `MAINTAIN_UNIT_LOGBOOK` na poziomie domeny.

### 6.4. Nomenklatura

Tabela `Nomenclature`: `(unitType, branch, roleKey) → label`.
`(DRUZYNA, HARCERZE, LEADER) → "Drużynowy"`, `(DRUZYNA, HARCERKI, LEADER) → "Drużynowa"`, `(CHORAGIEW, HARCERKI, LEADER) → "Komendantka Chorągwi"`.

Frontend **nigdy** nie buduje etykiet warunkami `if`. Klucze techniczne po angielsku, wszystkie etykiety z tabeli.

---

## 7. CZŁONKOWIE

### 7.1. Kategorie członkostwa (Statut §7)

```prisma
enum MembershipCategory {
  UCZESTNIK                 // zuch, harcerz, wędrownik — w gromadzie lub drużynie
  HARCERZ_STARSZY           // uczestnik po ukończeniu 18 r.ż.
  INSTRUKTOR
  CZLONEK_WSPOLDZIALAJACY   // bez funkcjonalności, patrz §1.2
}
```

**Krytyczne rozróżnienie:** `wędrownik` to *poziom metodyczny uczestnika* w drużynie wędrowniczej; `harcerz starszy` to *kategoria członkostwa* osoby pełnoletniej. Nigdy nie mieszaj ich w filtrach ani raportach. 16-letni wędrownik jest `UCZESTNIK`; 25-latek w kręgu harcerstwa starszego jest `HARCERZ_STARSZY`.

### 7.2. Osoba

```prisma
model Person {
  id            String   @id @default(uuid())
  keycloakUserId String? @unique
  status        PersonStatus  // INVITED | ACTIVE | ARCHIVED
  email         String?       // unikalny wśród INVITED i ACTIVE — patrz §8.4
  firstName     String
  lastName      String
  birthDate     DateTime?
  school        String?
  phone         String?
  branch        Branch
  photoUrl      String?
  crossNumber   String?       // numer Krzyża Harcerskiego
  promiseDate   DateTime?     // Przyrzeczenie Harcerskie
  promiseReceivedByPersonId String?
  instructorPledgeDate DateTime?   // Zobowiązanie Instruktorskie
  membershipCategory  MembershipCategory
  membershipStartedAt DateTime
  membershipEndedAt   DateTime?
  membershipEndReason MembershipEndReason?  // WYSTAPIENIE | ZWOLNIENIE | WYKLUCZENIE | SMIERC
  themePreference     ThemePreference @default(SYSTEM)
}

model Guardian {
  id        String @id @default(uuid())
  personId  String
  fullName  String
  phone     String
  email     String?
  address   String
  consentGivenAt     DateTime
  consentDocumentRef String?   // link do Dysku lub klucz S3, nie skan w bazie
}
```

**Reguła twarda:** przyjęcie osoby poniżej 16. roku życia wymaga co najmniej jednego rekordu `Guardian` z `consentGivenAt`.

### 7.3. Instruktorzy — model z Regulaminu Służby Instruktorskiej

```prisma
model InstructorProfile {
  personId          String @id
  rank              InstructorRank  // PRZEWODNIK | PODHARCMISTRZ | HARCMISTRZ
  rankAwardedAt     DateTime
  listType          ListType        // CZYNNY | WSPIERAJACY
  homeChoragiewId   String          // przynależność do chorągwi
  mainAssignmentLevel AssignmentLevel // HUFIEC | CHORAGIEW | GK | WLADZE_NACZELNE | POZA_PIONEM_WYCHOWAWCZYM
  mainAssignmentUnitId String?
  mainEducationalFunctionId String?
  onLeaveUntil      DateTime?
  minorProtectionVerifiedAt DateTime?
  minorProtectionValidUntil DateTime?
  standardsAcknowledgedAt   DateTime?
}
```

Reguły:

- **`getSupervisor(instructor)` (zwierzchnik):** dla `PRZEWODNIK` i `PODHARCMISTRZ` → komendant(ka) chorągwi przynależności; dla `HARCMISTRZ` → Naczelnik(czka).
- **`getDirectSuperior(instructor)` (przełożony):** z przydziału służbowego — dla drużynowego hufcowy, dla członka komendy hufca hufcowy, dla członka komendy chorągwi komendant chorągwi, dla szczepowego hufcowy (patrz §1.3).
- **Blokada mianowania:** nie można mianować na funkcję wychowawczą osoby bez ważnej `minorProtectionValidUntil` i bez `standardsAcknowledgedAt` → `422 MINOR_PROTECTION_NOT_VERIFIED`.
- **Przeniesienie przynależności** to proces dwustronny `TransferRequest` (akceptacja obu komendantów chorągwi + potwierdzenie rozliczenia z funkcji).
- **Urlop instruktorski** (1 miesiąc – 2 lata) zawiesza wymagalność spisu i deklarację składkową, nie usuwa z list.

### 7.4. p.o. drużynowego i opiekun jednostki

```prisma
model UnitLeadership {
  unitId       String
  personId     String
  isActing     Boolean          // p.o. — starszy harcerz lub wędrownik
  guardianInstructorId String?  // opiekun drużyny, WYMAGANY gdy isActing
  appointedByOrderId   String
  scopeOverrides Json?          // ograniczenia nadane rozkazem hufcowego
}
```

**Reguła bezpieczeństwa:** gdy `isActing === true`, wszystkie kompetencje oznaczone `requiresAdult` są niedostępne i wymagają **kontrasygnaty opiekuna**. Zaimplementuj jako `pendingApproval` — akcja czeka na zatwierdzenie przez `guardianInstructorId`. Dotyczy m.in. zatwierdzania wyczynów, formalnego kontaktu z rodzicami, akceptacji dokumentów.

---

## 8. CYKL ŻYCIA KONTA

To jest jeden z najważniejszych modułów. Zaimplementuj go dokładnie tak, jak opisano.

### 8.1. Zasada: konto zakłada komendant, nie użytkownik

Rejestracja własna jest **wyłączona** (`ALLOW_REGISTRATION=false`, wyłączona także w realmie Keycloak). Konto powstaje wyłącznie w momencie przyjęcia osoby do jednostki przez komendanta.

### 8.2. Zaproszenie

**Krok 1 — komendant.** Formularz „Przyjmij do jednostki" ma **trzy pola**: imię, nazwisko, e-mail. Nic więcej. Po zapisie:

- powstaje `Person` ze statusem `INVITED` i przypisaniem do jednostki komendanta;
- powstaje użytkownik w Keycloak przez Admin API: `username = person.id` (UUID), `email` = podany adres, `enabled = true`, `emailVerified = false`, **bez poświadczeń**;
- powstaje rekord `Invitation { token, personId, createdByPersonId, expiresAt, usedAt, revokedAt }` — token to 32-bajtowy losowy ciąg, w bazie przechowywany **wyłącznie jako hash**;
- wychodzi e-mail z linkiem `{APP_URL}/zaproszenie/{token}`.

**Krok 2 — zaproszony.** Otwiera link. Strona weryfikuje token (ważność, brak `usedAt`, brak `revokedAt`) i prowadzi przez kreator:

1. **Ustawienie hasła.** Aplikacja wywołuje Keycloak Admin API `PUT /users/{id}/execute-actions-email` z akcją `UPDATE_PASSWORD` i `redirect_uri` wracającym do kreatora — hasło ustawiane jest po stronie Keycloak i aplikacja go nigdy nie widzi. Tryb awaryjny, gdy SMTP skonfigurowano tylko po stronie aplikacji: formularz hasła w aplikacji i `PUT /users/{id}/reset-password`, z hasłem trzymanym wyłącznie w pamięci żądania.
2. **Uzupełnienie profilu:** data urodzenia, szkoła, telefon, zdjęcie, numer Krzyża, data Przyrzeczenia, wcześniejsze stopnie i sprawności do weryfikacji przez komendanta.
3. **Dane opiekuna i zgoda** — krok obowiązkowy i blokujący, gdy z daty urodzenia wynika wiek poniżej 16 lat.
4. **Podsumowanie** — konto przechodzi w `ACTIVE`, `Invitation.usedAt` zostaje ustawione, komendant dostaje powiadomienie.

**Obsługa brzegów:** ponowne wysłanie zaproszenia z cooldownem `INVITATION_RESEND_COOLDOWN_MINUTES`; unieważnienie zaproszenia przez komendanta; wygaśnięcie po `INVITATION_TTL_HOURS` z widoczną listą zaproszeń oczekujących i wygasłych; próba użycia zużytego tokenu kończy się neutralnym komunikatem bez ujawniania, czy konto istnieje.

**Osoba bez własnego e-maila.** Komendant ma dwie ścieżki: wpisać adres rodzica (wtedy kreator prowadzi rodzic i uzupełnia zgodę) albo utworzyć **profil bez konta** (`Person` bez `keycloakUserId`, status `ACTIVE`). Profil bez konta jest pełnoprawny ewidencyjnie — można mu przyznawać stopnie i sprawności — tylko nie da się na niego zalogować. W dowolnym momencie można go „podnieść" do konta przez wysłanie zaproszenia.

### 8.3. Archiwizacja (usunięcie użytkownika)

Usunięcie użytkownika **nigdy nie kasuje danych**. Operacja `archivePerson(personId, reason)`:

1. `Person.status = ARCHIVED`, ustawia `archivedAt`, `archivedByPersonId`, `archiveReason` (`WYSTAPIENIE | ZWOLNIENIE | WYKLUCZENIE | SMIERC | BLAD_DANYCH | INNY` + pole tekstowe).
2. **Zwalnia adres e-mail:** wartość z `Person.email` przenosi się do `Person.historicalEmail`, a `Person.email` staje się `NULL`.
3. **Zwalnia adres w Keycloak:** użytkownik zostaje `enabled = false`, jego `email` zmienia się na tombstone `{personId}@{ACCOUNT_ARCHIVE_TOMBSTONE_DOMAIN}`, `emailVerified = false`, wszystkie sesje są unieważnione, poświadczenia usunięte. `username` pozostaje UUID-em i nigdy się nie zmienia. **Ten krok jest obowiązkowy** — Keycloak wymusza unikalność adresu w realmie, więc bez tombstone ponowne użycie adresu nie powiedzie się na poziomie IdP, nawet jeśli baza aplikacji na to pozwala.
4. Osoba znika z: składów jednostek, list wyboru, statystyk, spisów, kart progresji w toku (te przechodzą w stan `ABANDONED` z zachowaniem historii).
5. **Nie znika z:** rozkazów, osobistego dziennika zdarzeń, dzienników jednostek, audit logu, kapituł historycznych, historii funkcji.

**Widok „Nieaktywne profile"** (dostępny dla admina i wyżej): lista archiwalnych osób z kolumnami imię, nazwisko, `historicalEmail`, data archiwizacji, kto zarchiwizował, powód, ostatnia jednostka. Wejście w profil pokazuje **pełną, nieokrojoną historię**: dziennik zdarzeń, stopnie, sprawności, funkcje, rozkazy, kary (z zaznaczeniem zatartych).

### 8.4. Unikalność adresu e-mail

To jest sedno wymagania — zaimplementuj dokładnie:

- Adres e-mail jest unikalny **wyłącznie w obrębie osób o statusie `INVITED` lub `ACTIVE`**.
- Egzekwuj to **częściowym indeksem unikalnym w PostgreSQL**, nie w kodzie aplikacji:

```sql
CREATE UNIQUE INDEX person_active_email_unique
  ON "Person" (lower(email))
  WHERE status IN ('INVITED', 'ACTIVE') AND email IS NOT NULL;
```

- `historicalEmail` **nie ma** ograniczenia unikalności. Ten sam adres może wystąpić w wielu archiwalnych profilach — to normalna sytuacja przy rodzeństwie korzystającym ze wspólnej skrzynki.
- Dzięki temu adres zwolniony przy archiwizacji może być natychmiast użyty do zaproszenia nowej osoby, bez żadnej dodatkowej operacji.

### 8.5. Przywrócenie profilu

Operacja `restorePerson(personId, newEmail)`:

1. **Wymaga podania adresu e-mail.** Nie ma trybu „przywróć z poprzednim adresem" jako akcji jednym kliknięciem — adres trzeba wpisać świadomie.
2. System sprawdza, czy podany adres jest wolny wśród osób `INVITED` i `ACTIVE` oraz w Keycloak. Jeśli jest zajęty → `409 EMAIL_ALREADY_IN_USE` z komunikatem wskazującym, że adres należy do aktywnego profilu, **bez ujawniania czyjego**.
3. Jeśli podany adres jest identyczny z `historicalEmail` i nadal wolny — jest to dozwolone, ale UI wymaga **jawnego potwierdzenia** („Ten adres był wcześniej przypisany do tego profilu i jest nadal wolny. Przywrócić z tym adresem?").
4. `Person.status = ACTIVE`, `email = newEmail`, `archivedAt = NULL`, `historicalEmail` **pozostaje** jako ślad historyczny.
5. Użytkownik Keycloak zostaje `enabled = true`, jego `email` zmienia się z tombstone na nowy adres, `emailVerified = false`.
6. **Nowe zaproszenie zostaje wysłane** — użytkownik ustawia hasło od nowa. Stare poświadczenia nigdy nie wracają.
7. Przywrócenie wymaga uprawnienia `RESTORE_PERSON` (domyślnie: admin jednostki i wyżej) i trafia do audit logu z podaniem poprzedniego i nowego adresu.
8. Przywrócenie **nie przywraca automatycznie** funkcji, przydziału ani wpisu na listę instruktorów — te wymagają osobnych rozkazów.

### 8.6. Trwałe usunięcie (prawo do bycia zapomnianym)

Osobna operacja, wyłącznie dla roota, z obowiązkowym uzasadnieniem. Nie kasuje rekordów — **anonimizuje**: imię i nazwisko zastępowane pseudonimem `Osoba #{skrót}`, e-mail, telefon, szkoła, data urodzenia, zdjęcie i dane opiekunów usuwane trwale. Zachowane pozostają: identyfikatory zdarzeń, daty, powiązania z rozkazami.

**Pliki PDF rozkazów pozostają nienaruszone** — rozkaz jest dokumentem organizacji i nie podlega edycji. Poinformuj o tym użytkownika w interfejsie przed potwierdzeniem operacji.

---

## 9. KEYCLOAK — PEŁNA KONFIGURACJA

Wygeneruj `infra/keycloak/realm-export.json` odtwarzający poniższe ustawienia oraz rozdział `docs/keycloak.md` opisujący je krok po kroku z myślą o administratorze, który stawia instancję od zera.

### 9.1. Ustawienia realmu

| Ustawienie | Wartość | Uzasadnienie |
|---|---|---|
| Realm name | `harc` (z `KEYCLOAK_REALM`) | |
| User registration | **OFF** | Konta zakłada komendant |
| Forgot password | **ON** | |
| Remember me | ON (opcjonalnie) | |
| Verify email | **ON** | |
| Login with email | **ON** | `username` to UUID, ludzie logują się adresem |
| Duplicate emails | **OFF** | Wymagana unikalność adresu |
| Edit username | **OFF** | `username` = UUID, nigdy się nie zmienia |
| Brute force detection | **ON** | 5 prób, blokada 60 s, wykładniczy backoff |
| SSL required | `external` (prod: `all`) | |
| Access token lifespan | 5 min | |
| SSO session idle / max | 30 min / 10 h | |
| Login theme | własny (opcjonalnie) | |

**Password policy:** `length(12) and notUsername and notEmail and passwordHistory(3) and hashAlgorithm(argon2)`.

**Required actions włączone:** `UPDATE_PASSWORD`, `VERIFY_EMAIL`, `UPDATE_PROFILE`, `CONFIGURE_TOTP` (nieobowiązkowa).

**SMTP** musi być skonfigurowany w realmie — bez tego `execute-actions-email` nie zadziała i kreator zaproszenia spadnie do trybu awaryjnego.

**User Profile (declarative):** `email` wymagany, `firstName` i `lastName` wymagane, atrybuty niezarządzane **wyłączone** — wszystkie dodatkowe dane osobowe należą do aplikacji, nie do Keycloak. Keycloak jest wyłącznie dostawcą tożsamości.

### 9.2. Klienci

**`harc-web`** — aplikacja webowa

| Ustawienie | Wartość |
|---|---|
| Client authentication | **ON** (confidential — Next.js trzyma sesję po stronie serwera) |
| Standard flow | ON |
| Direct access grants | **OFF** |
| Service accounts | OFF |
| PKCE | **S256, wymagane** |
| Valid redirect URIs | `{APP_URL}/api/auth/callback/keycloak`, `{APP_URL}/zaproszenie/*` |
| Valid post logout redirect URIs | `{APP_URL}/*` |
| Web origins | `{APP_URL}` |
| Backchannel logout URL | `{APP_URL}/api/auth/backchannel-logout` |
| Backchannel logout session required | ON |

**`harc-api`** — serwer zasobów. Bearer-only: `Standard flow OFF`, `Service accounts OFF`, `Client authentication ON`. Służy wyłącznie jako `audience` weryfikowany przez NestJS.

**`harc-admin`** — klient techniczny do Admin API

| Ustawienie | Wartość |
|---|---|
| Client authentication | ON |
| Standard flow | **OFF** |
| Service accounts roles | **ON** (`client_credentials`) |

**Role konta serwisowego** (z klienta `realm-management`), przypisz dokładnie te i żadnych więcej:

- `manage-users` — tworzenie użytkowników, `reset-password`, `execute-actions-email`, wyłączanie kont, zmiana adresu przy archiwizacji i przywracaniu;
- `view-users` — odczyt profilu i członkostwa w grupach;
- `query-users` — wyszukiwanie przy sprawdzaniu zajętości adresu;
- `query-groups` — odczyt grup przy wykrywaniu roota;
- `view-events` — **opcjonalnie**, tylko jeśli włączysz zaciąganie zdarzeń logowania do audit logu.

**Nie przyznawaj** `realm-admin`, `manage-realm` ani `manage-clients` — konto serwisowe nie ma prawa modyfikować konfiguracji realmu.

### 9.3. Scope'y i claims

**Wymagane scope'y OIDC:** `openid`, `profile`, `email`. Aplikacja nie potrzebuje `offline_access`.

**Własny client scope `harc`** (default dla `harc-web`), z mapperami:

| Mapper | Typ | Konfiguracja |
|---|---|---|
| `groups` | Group Membership | Token Claim Name: `groups`, **Full group path: ON**, Add to ID token: ON, Add to access token: ON |
| `audience-harc-api` | Audience | Included Client Audience: `harc-api`, Add to access token: ON |
| `email` | User Property | Property: `email` → claim `email`, ID + access token |
| `given_name` / `family_name` | User Property | `firstName` / `lastName` |
| `person_id` | User Property | Property: `username` → claim `person_id` (username to UUID osoby) |

**Full group path musi być włączony** — wykrywanie roota porównuje claim `groups` z `KEYCLOAK_ROOT_GROUP` w formacie `/zhr_sysadmins`. Przy wyłączonym full path w tokenie znajdzie się `zhr_sysadmins` bez ukośnika i porównanie zawiedzie.

### 9.4. Grupy i uprawnienia root

- Utwórz grupę o nazwie z `KEYCLOAK_ROOT_GROUP` (domyślnie `/zhr_sysadmins`).
- Każdy użytkownik należący do tej grupy ma w aplikacji uprawnienie `ROOT` **automatycznie, przy każdym logowaniu** — bez zapisu w bazie aplikacji, wyłącznie na podstawie claimu.
- **Root nie jest nadawany przez adres e-mail.** Adres e-mail jest zmienialny i zwalniany przy archiwizacji, więc uzależnienie od niego najwyższych uprawnień byłoby wektorem eskalacji.
- Bootstrap pustej instalacji: `ROOT_BOOTSTRAP_SUBS` (lista UUID-ów) działa **wyłącznie dopóki w bazie nie ma ani jednego użytkownika z rolą `SYSADMIN`**. Po pierwszym nadaniu przestaje być brany pod uwagę, co odnotowywane jest w audit logu.

### 9.5. Ponowne uwierzytelnienie przy operacjach wrażliwych

Operacje: zmiana własnego adresu e-mail, nadanie `SYSADMIN`, przywrócenie profilu, trwałe usunięcie, eksport bazy z danymi osobowymi.

Realizacja: przekierowanie na Keycloak z `max_age=0` (wymusza ponowne podanie hasła niezależnie od aktywnej sesji) i weryfikacja `auth_time` w zwróconym tokenie. Jeśli w realmie skonfigurowano OTP, dodatkowo `acr_values=2` z mapowaniem LoA w przepływie uwierzytelniania.

### 9.6. Synchronizacja zmiany adresu e-mail

Kolejność jest istotna: **najpierw Keycloak, potem baza.**

1. Aplikacja generuje token weryfikacyjny i wysyła wiadomość na **nowy** adres.
2. Po kliknięciu w link: `PUT /users/{id}` w Keycloak z nowym adresem i `emailVerified = false`, następnie `execute-actions-email` z `VERIFY_EMAIL`.
3. Dopiero po sukcesie — zapis w bazie aplikacji w transakcji.
4. Przy niepowodzeniu kroku 2 zmiana nie zostaje zapisana nigdzie, użytkownik dostaje czytelny komunikat, zdarzenie trafia do logu.
5. Wszystko wykonywane przez kolejkę z retry i DLQ. Zmiana adresu zawsze ląduje w audit logu ze starą i nową wartością.

---

## 10. AUTORYZACJA I ZASIĘG WŁADZY

### 10.1. Poziomy

| Poziom | Skąd | Zakres |
|---|---|---|
| `ROOT` | Grupa Keycloak z `KEYCLOAK_ROOT_GROUP` (albo bootstrap wg §9.4) | Wszystko. Nadaje `SYSADMIN`. |
| `SYSADMIN` | Nadawany przez `ROOT` w aplikacji | Zarządza wszystkimi jednostkami i użytkownikami. **Nie może** zarządzać innymi sysadminami ani zmieniać własnych uprawnień — wymuś w domenie, nie w UI. Może nadawać uprawnienia niższe. |
| `UNIT_ADMIN` | Nadawany dla konkretnej jednostki | Zarządza użytkownikami swojej jednostki i jednostek podległych, nadaje funkcje. |
| Funkcyjni | Z rozkazu | Kompetencje wg §10.2. |

### 10.2. Macierz kompetencji — NIE głębokość w drzewie

**To najważniejsza reguła systemu i najczęstsze źródło błędnych implementacji.**

Władza komendanta **nie jest funkcją odległości w drzewie**. Nie wolno zaimplementować ani reguły „własna jednostka + jeden poziom w dół", ani „całe poddrzewo". Zasięg jest **inny dla każdej akcji** i wynika z konkretnego przepisu. Poniższe muszą być spełnione jednocześnie:

- **hufcowy** powołuje i rozwiązuje drużyny, mianuje i zwalnia drużynowych, powołuje opiekunów drużyn, otwiera i zamyka okres próbny drużyny — ale **nie mianuje przybocznych ani zastępowych**, bo to wyłączna kompetencja drużynowego;
- **komendant chorągwi** powołuje i rozwiązuje hufce, przyjmuje i zwalnia instruktorów, wpisuje na listy, zawiesza i skreśla, przyznaje stopnie instruktorskie — ale **standardowo nie powołuje drużyn**, mimo że leżą w jego poddrzewie;
- **stopnie instruktorskie** są zastrzeżone dla poziomu chorągwi i wyżej — drużynowy i hufcowy nie mają tej akcji w żadnym wariancie;
- **stopień harcmistrza / harcmistrzyni** przyznaje wyłącznie Naczelnik / Naczelniczka.

```ts
type Competence = {
  action: ActionKey;
  holderLevel: UnitLevel;
  targetScope: 'OWN_UNIT' | 'DIRECT_CHILDREN' | 'SUBTREE' | 'OWN_BRANCH_ORG';
  targetTypes: UnitType[];
  requiresAdult: boolean;
  requiresMinorProtection: boolean;
  minimumInstructorRank?: InstructorRank;
  delegable: boolean;
  legalBasis: string;   // "Reg. Drużyny Harcerzy §11 ust. 2 lit. c"
};
```

Macierz `Competence[]` to **dane w słowniku**, nie kod. `AuthorizationService.can(actor, action, resource)` sprawdza kolejno: kompetencja z urzędu albo nadana → `targetScope` **tej konkretnej akcji** → `targetTypes` → oś przełożony/zwierzchnik → `branch` → pełnoletność → ochrona małoletnich.

### 10.3. Subsydiarność

Jednostka nadrzędna może wykonać akcję zastrzeżoną dla niższej **tylko** gdy: wakat na funkcji komendanta niższej jednostki, jednostkę prowadzi **p.o.**, jednostka jest zawieszona, albo komendant niższej jednostki jest zawieszony w prawach członka.

Zamodeluj jako jawny `SubstitutionGrant` z powodem, datą, zakresem i wpisem do audit logu — **nigdy jako cichy fallback w kodzie**. Każde użycie musi być widoczne w rozkazie i w dzienniku jednostki.

### 10.4. Delegacja uprawnień

Komendant może nadać funkcyjnemu (v-ce hufcowy, członek komendy, kwatermistrz) wyłącznie kompetencje, które **sam posiada** i które mają `delegable: true`. Nie może delegować kompetencji spoza swojego zestawu ani rozszerzyć zasięgu poza własny.

**Sama nazwa funkcji nie daje żadnych uprawnień technicznych** — uprawnienia są nadawane osobno i jawnie. Delegacja ma datę wygaśnięcia i jest audytowana.

### 10.5. Pozostałe wymiary

- **branch** — komendant chorągwi harcerzy nie widzi danych osobowych harcerek i odwrotnie, poza zagregowanymi statystykami. Wymuś na poziomie repozytorium, nie kontrolera.
- **oś przełożony/zwierzchnik** — `DISCIPLINE_INSTRUCTOR`, `ENROLL_ON_LIST`, `GRANT_INSTRUCTOR_LEAVE`, `ADMIT_INSTRUCTOR`, `RELEASE_INSTRUCTOR`, `AWARD_INSTRUCTOR_RANK` sprawdzają `getSupervisor()`, nie hierarchię jednostek.
- **pełnoletność** z kontrasygnatą opiekuna dla p.o.
- **ważność weryfikacji ochrony małoletnich.**

### 10.6. Testy

Każdy wiersz macierzy kompetencji ma test pozytywny i negatywny. Obowiązkowo jawne testy negatywne: „hufcowy NIE może mianować przybocznego", „komendant chorągwi NIE może powołać drużyny bez `SubstitutionGrant`", „hufcowy NIE może przyznać stopnia przewodnika", „sysadmin NIE może odebrać uprawnień innemu sysadminowi", „zastępowy samodzielnego zastępu NIE może wydać rozkazu".

Wygeneruj **macierz uprawnień jako plik Markdown** w dokumentacji, automatycznie ze słownika, z kolumną `legalBasis`.

---

## 11. MODUŁ ROZKAZÓW

### 11.1. Model

```prisma
model Order {
  id             String @id @default(uuid())
  unitId         String
  issuerPersonId String
  number         String        // "L. 3/2026"
  issuedAt       DateTime
  place          String
  status         OrderStatus   // DRAFT | PUBLISHED | CORRECTED | REVOKED
  pdfDriveFileId String?
  pdfStorageKey  String?       // kopia w S3 — obowiązkowa
  contentText    String?
  supersededById String?
}

model OrderItem {
  id        String @id @default(uuid())
  orderId   String
  section   String        // "3.1"
  type      OrderItemType
  subjectPersonId String?
  subjectUnitId   String?
  payload   Json          // walidowany Zod zależnie od typu
  effectiveDate DateTime  // "z dniem ..." — może różnić się od daty rozkazu
  reverted  Boolean @default(false)
}
```

Numeracja: konfigurowalny wzorzec (`L. {n}/{rok}`), licznik per jednostka per rok. Struktura punktów rozkazu w ZHR jest zwyczajowa, nie regulaminowa — zaimplementuj szablon sekcji jako **edytowalny słownik per jednostka**, z domyślnym zestawem: *Zarządzenia i informacje / Wyjątki z rozkazów władz zwierzchnich / Zmiany organizacyjne / Mianowania i zwolnienia / Stopnie i sprawności / Pochwały i wyróżnienia / Kary / Sprawy różne*.

### 11.2. Kreator rozkazu

Komendant wgrywa PDF (albo pisze treść w aplikacji) → otwiera się kreator mapowania zdarzeń. Każda pozycja to wybór typu, podmiotu i szczegółów.

| Typ | Kto może |
|---|---|
| `ADMIT_PARTICIPANT` / `RELEASE_PARTICIPANT` | drużynowy |
| `APPOINT_FUNCTION` / `DISMISS_FUNCTION` | wg macierzy kompetencji |
| `AWARD_RANK` | drużynowy (HR: na wniosek kapituły; gdy drużynowy nie jest HR — hufcowy) |
| `AWARD_BADGE` | drużynowy |
| `AWARD_ZUCH_STAR` | drużynowy gromady |
| `OPEN_TRIAL` / `CLOSE_TRIAL` / `EXTEND_TRIAL` / `DISCONTINUE_TRIAL` | wg gałęzi, patrz §12 |
| `ADMIT_TO_PROMISE` | drużynowy |
| `RECORD_INSTRUCTOR_PLEDGE` | zwierzchnik |
| `COMMENDATION` | przełożony |
| `DISCIPLINARY_PENALTY` | **zwierzchnik** — formularz rozszerzony, patrz §11.3 |
| `FOUND_UNIT` / `DISSOLVE_UNIT` / `RENAME_UNIT` / `SET_UNIT_NUMBER` | wg macierzy |
| `OPEN_UNIT_PROBATION` / `CLOSE_UNIT_PROBATION` / `EXTEND_UNIT_PROBATION` | hufcowy dla drużyny |
| `APPOINT_UNIT_GUARDIAN` | hufcowy |
| `ENROLL_ON_INSTRUCTOR_LIST` / `REMOVE_FROM_INSTRUCTOR_LIST` | zwierzchnik |
| `GRANT_INSTRUCTOR_LEAVE` | zwierzchnik |
| `AWARD_INSTRUCTOR_RANK` | komendant chorągwi / Naczelnik, patrz §12.4 |
| `OPEN_INSTRUCTOR_TRIAL` / `CLOSE_INSTRUCTOR_TRIAL` | komendant chorągwi na wniosek komisji |
| `AWARD_CATEGORY` | hufcowy / komendant chorągwi / Naczelnik wg kategorii |
| `SET_ADDITIONAL_RANK_REQUIREMENTS` | drużynowy |
| `EXEMPT_FROM_FEAT_APPROVAL` | hufcowy wobec drużynowego ≥ podharcmistrz |
| `APPOINT_CHAPTER` (kapituła) | drużynowy / hufcowy / komendant chorągwi |

**Kreator waliduje przed zapisem:** czy wydający ma kompetencję do danego typu; czy podmiot należy do właściwej jednostki i gałęzi; czy stopień mieści się w przedziale wiekowym; czy nie pomija się stopni bez odnotowania; czy funkcja wymaga pełnoletności i ważnej weryfikacji ochrony małoletnich; czy podmiot nie jest profilem archiwalnym.

**Skutek:** każda pozycja tworzy wpis w `PersonalEventLog` **i** `UnitLogbook`, z linkiem do PDF i odwołaniem do numeru punktu. Skutki są **odwracalne** — sprostowanie (`CORRECTED`) generuje operacje kompensujące, nigdy nie kasuje historii.

### 11.3. Kary organizacyjne

W kreatorze tryb „Nagana / kara" stoi obok pozostałych — komendant nie musi wchodzić w osobny moduł. Wybranie go **rozwija rozszerzony formularz** i uruchamia w tle pełny przepływ.

`DisciplinaryCase`:

```
INITIATED → EXPLANATION_REQUESTED → (opcjonalnie SUSPENDED_PENDING)
  → PENALTY_ISSUED → [APPEAL_FILED → …] → FINAL → EXPIRED (zatarcie)
```

Wymagania: postępowanie wyjaśniające z odnotowaniem wezwania do wyjaśnień; rozkaz karzący zawiera opis przewinienia, informację o postępowaniu, wskazaną karę (przy zakazie pełnienia funkcji — **jakich funkcji dotyczy i na jak długo**) oraz pouczenie o odwołaniu; termin apelacji do Sądu Harcerskiego **1 miesiąc**; **w czasie apelacji kara nie podlega wykonaniu** — system nie egzekwuje skutków; **zatarcie automatyczne po roku** od prawomocności (przy zakazie funkcji — rok od zakończenia zakazu), realizowane jobem cyklicznym; kara zatarta lub uchylona znika z widoków operacyjnych, pozostając w archiwum widocznym tylko dla zwierzchnika.

Katalog: `UPOMNIENIE`, `NAGANA`, `ZAKAZ_PELNIENIA_FUNKCJI`, `ODEBRANIE_STOPNIA_INSTRUKTORSKIEGO`, `WYKLUCZENIE`. Osobno `ZAWIESZENIE_W_PRAWACH` jako środek na czas postępowania.

---

## 12. MODUŁ PROGRESJI

### 12.1. Wspólny interfejs, trzy silniki

```ts
interface ProgressionEngine {
  readonly branch: Branch;
  startPath(person, targetRankId): ProgressionInstance;
  proposeTasks(instance, tasks): void;
  submitCompletion(instance, requirementId, evidence): void;
  verify(instance, requirementId, verifierId): void;
  award(instance, orderItemId): void;
}
```

**Karta stopnia — wspólny UX dla obu organizacji.** Harcerz w swoim profilu widzi przycisk „rozpocznij zdobywanie stopnia X", który **pobiera domyślny zestaw wymagań** z aktualnej wersji słownika, uzupełniony o **dodatkowe wymagania obowiązujące w jego drużynie**. Powstaje `ProgressionInstance` z listą pozycji. Drużynowy przed zatwierdzeniem może zadania **edytować i indywidualizować**, a w trakcie — zamienić zadanie, które przestało odpowiadać celom. Identycznie działa karta próby na sprawność.

Różnica między organizacjami dotyczy wyłącznie **formalnego domknięcia**: w OH-ek próba jest jawnie otwierana i zamykana rozkazem, z możliwością umorzenia i limitem czasu; w OH-y liczy się moment przyznania stopnia rozkazem, a karta jest narzędziem pracy. **Nie różnicuj UX-u** — różnicuj tylko dozwolone przejścia stanów i to, które wymagają pozycji w rozkazie.

### 12.2. Silniki

**`HarcerzeRankEngine` (OH-y).** Ścieżka startuje automatycznie przy wstąpieniu lub zdobyciu poprzedniego stopnia. Elementy: zadania indywidualne w 10 obszarach (Bóg i duchowość, siła charakteru, rozum, zdrowie, małe ojczyzny i Polska, rodzina, służba, pasje, kultura, przyroda), wymagane sprawności, wymagana suma gwiazdek ze sprawności dowolnych, aktywny udział w zastępie i drużynie, **próba końcowa** dla młodzika, wywiadowcy i ćwika. Walidacje: przedział wiekowy stopnia; ćwik — próba końcowa dopiero po 14. urodzinach; przy pominięciu stopni wymagane wykazanie wiedzy z pominiętych. Opiekun przy HO i HR. Kapituła: min. 3 osoby z tym stopniem, w tym instruktor; przewodniczący kapituły HR co najmniej podharcmistrz. **Wyczyn** wymaga zatwierdzenia warunków bezpieczeństwa przez hufcowego albo komendanta obozu, chyba że drużynowy ≥ podharcmistrz został zwolniony rozkazem. Harcerz może **wycofać się z wyczynu na każdym etapie** — zamodeluj jako dozwoloną, nieoceniającą akcję.

Stopnie: `MLODZIK` (11–13), `WYWIADOWCA` (12–14), `CWIK` (13–16), `HARCERZ_ORLI` (15–18), `HARCERZ_RZECZYPOSPOLITEJ` (17+).

**`HarcerkiRankEngine` (OH-ek).** Ścieżka próbowa z jawnymi stanami `OTWARTA → ZAMKNIETA_POZYTYWNIE | ZAMKNIETA_NEGATYWNIE | UMORZONA`, kartą próby, opiekunką próby, kapitułą oraz **maksymalnym czasem trwania** per stopień (po przekroczeniu — obowiązkowa weryfikacja). Stopnie: próba harcerki, `OCHOTNICZKA`, `TROPICIELKA`, `STARSZA_TROPICIELKA`, `SAMARYTANKA`, `STARSZA_SAMARYTANKA`, `WEDROWNICZKA`, `STARSZA_WEDROWNICZKA`, `HARCERKA_RZECZYPOSPOLITEJ`, plus ścieżka `STARSZA_OCHOTNICZKA` dla wstępujących w wieku 15+.

**`ZuchyEngine`.** Trzy gwiazdki zuchowe wg **Systemu Tęczy** (pięć kolorów = pięć sfer rozwoju) oraz sprawności zuchowe **zdobywane głównie zespołowo** — przypisanie do gromady lub szóstki, nie tylko do osoby.

Konkretne nazwy, wymagania i progi **zaczytaj z plików seed** generowanych z aktualnych regulaminów — nie wpisuj ich do kodu.

### 12.3. Sprawności

`Badge { code, name, branch, level (1|2|3|MISTRZOWSKA|OKOLICZNOSCIOWA), stars, domain }`.

Próba na sprawność: karta z zadaniami, opcjonalna **komisja sprawności** w drużynie, możliwość **przedłużenia** przez drużynowego, zamknięcie z wynikiem **negatywnym** z blokadą ponownego podejścia przez okres karencji, przyznanie rozkazem + wpis do książeczki służbowej. Sprawność może **zaliczać zadanie na stopień** (relacja N:M `Badge ↔ RankRequirement`) z automatycznym propagowaniem zaliczeń.

### 12.4. Stopnie instruktorskie i Zobowiązanie Instruktorskie

Moduł podstawowy — bez niego rozgraniczenie „drużynowy przyznaje stopnie harcerskie, ale instruktorskich już nie" nie ma czego pilnować.

Stopnie: `PRZEWODNIK/PRZEWODNICZKA` → `PODHARCMISTRZ/PODHARCMISTRZYNI` → `HARCMISTRZ/HARCMISTRZYNI`.

Przebieg próby: wniosek kandydata → rozpatrzenie przez **Komisję Instruktorską** (chorągwianą) albo **Komisję Harcmistrzowską / Komisję Harcmistrzyń** (przy Głównej Kwaterze) → **otwarcie próby rozkazem** → realizacja z **opiekunem próby** → sprawozdanie kandydata, opinia opiekuna, opinia bezpośredniego przełożonego, opinia komendanta kursu → komisja może wyznaczyć **zadania dodatkowe z terminem** → wniosek komisji → **przyznanie stopnia rozkazem**.

Kompetencja przyznania — do macierzy z §10.2, **osobno dla każdej organizacji**:

| Stopień | OH-y | OH-ek |
|---|---|---|
| przewodnik / przewodniczka | komendant chorągwi | komendantka chorągwi |
| podharcmistrz / podharcmistrzyni | komendant chorągwi | **Naczelniczka Harcerek** |
| harcmistrz / harcmistrzyni | **Naczelnik Harcerzy** | **Naczelniczka Harcerek** |

`// TODO(regulamin): asymetria OH-y / OH-ek przy podharcmistrzyni wymaga potwierdzenia w GK Harcerek — dostępny regulamin stopni instruktorskich harcerek pochodzi z 2012 r. Wartość jest konfigurowalna w słowniku, nie zakodowana.`

Dodatkowo: próba na wyższy stopień biegnie **od dnia przyznania niższego**; komisje instruktorskie powołuje rozkazem komendant chorągwi; prawo interpretacji wymagań i modyfikacji programu próby ma komisja, nie przełożony.

**Zobowiązanie Instruktorskie** — osobne zdarzenie ewidencyjne, analogiczne do Przyrzeczenia: data, miejsce, osoba odbierająca, rozkaz. Warunek statusu instruktora obok stopnia i pełnoletności.

**Odebranie stopnia instruktorskiego** jest karą organizacyjną i idzie ścieżką z §11.3, nie zwykłym rozkazem.

### 12.5. Widoki

**Drużynowy.** Lista harcerzy i zastępów: wiek (liczony), data urodzenia, szkoła, aktualny stopień, liczba i suma gwiazdek sprawności, status karty stopnia, data Przyrzeczenia, numer Krzyża, obecności. Grupowanie po zastępach z drag-and-drop, filtry, eksport. Panel „Do zatwierdzenia" z kolejką zgłoszeń od harcerzy.

**Harcerz.** Własny profil; zgłaszanie wykonania zadania z krótkim komentarzem i załącznikami (upload do S3, opcjonalnie kopia na Dysk); oś czasu osobistego dziennika zdarzeń; podgląd wymagań w wersji obowiązującej dla jego karty.

**Zastępowy.** Wyłącznie postępy członków własnego zastępu, tylko przy nadanym `VIEW_PROGRESS_OF_OWN_PATROL`.

**Komendant chorągwi.** Panel agregujący całą strukturę podległą:
- **lista instruktorów** z filtrami: lista czynnych/wspierających, stopień, przydział służbowy, przynależność do chorągwi, urlop, status weryfikacji ochrony małoletnich, status spisu;
- **osobna lista harcerzy starszych**;
- **osobna lista wędrowniczek i wędrowników**;
- dashboard: liczebność jednostek, pokrycie funkcji, luki kadrowe (jednostki bez komendanta, drużyny z p.o. bez opiekuna), stan kategoryzacji, stan planów pracy, zbliżające się wygaśnięcia weryfikacji;
- separacja `branch` respektowana bezwzględnie.

---

## 13. SPIS, PLAN PRACY, KATEGORYZACJA

**Trzy odrębne procesy o różnych cyklach.** Nie łącz ich w jeden formularz.

### 13.1. Spis instruktorski i członków pełnoletnich (rok kalendarzowy)

Harmonogram konfigurowalny, domyślnie: ogłoszenie **do 31.10**, otwarcie **1.11**, termin dokonania **30.11**, wpis na listę przez zwierzchnika **do 31.12**.

Zakres: deklaracja funkcji i głównego przydziału (czynni) albo przydziału i działań wspierających (wspierający); wniosek o wpis, urlop albo zakończenie służby; **boolean „potwierdzam opłacenie składek"** (bez kwot i płatności).

Automaty: brak wniosku w terminie → traktowany jak wpisany na listę **wspierających** do czasu decyzji; brak decyzji zwierzchnika w terminie → traktowany jak wpisany **zgodnie z wnioskiem**. Zaimplementuj jako stany wyliczane, nie ręczną interwencję. Ścieżka odwoławcza: Naczelnik → Przewodniczący → Sąd Harcerski (rejestrowana, nie rozstrzygana w systemie).

### 13.2. Spis jednostek 

Na stan **31 grudnia**, prowadzony w okresie wskazanym przy ogłoszeniu, z rolą **Komisarza Spisowego** (uprawnienie `CENSUS_COMMISSIONER`). Zakres: stan liczbowy jednostki, dane wizytówki, potwierdzenie danych członków.

**Integracja, nie duplikacja:** ZHR prowadzi spis także poza systemem. Zaimplementuj import CSV/Google Sheets z mapowaniem kolumn i raportem rozbieżności oraz eksport w formacie zgodnym z zewnętrznymi formularzami. Przełącznik `CENSUS_SOURCE_OF_TRUTH = INTERNAL | EXTERNAL`.

### 13.3. Plan pracy (rok harcerski 1.09–31.08)

Workflow: `DRAFT → SUBMITTED → RETURNED_FOR_CORRECTION → APPROVED | REJECTED`. Zatwierdzający z hierarchii — dla drużyny **hufcowy**.

Zawartość: cele, kalendarium, planowany obóz, pole służby, deklarowana kategoria, aktualizacja wizytówki jednostki (opis, e-mail, linki społecznościowe, pineska harcówki).

Po zatwierdzeniu: generowanie PDF z datą, numerem i danymi zatwierdzającego, **zapis kopii w S3 (niezmienialny)** oraz upload na Dysk. Jednostki nadrzędne widzą plany wszystkich jednostek podległych; równoległe — nie.

### 13.4. Kategoryzacja drużyn

Cykl roku harcerskiego. Kategorie: `PROBNA`, `POLOWA`, `LESNA`, `PUSZCZANSKA`. Arkusz wymagań (słownik wersjonowany) wypełniany na bieżąco przez drużynowego, wizytacja i opinia przełożonego, przyznanie rozkazem: hufcowy (polowa), komendant chorągwi (leśna), Naczelnik (puszczańska). Powiązanie z planem pracy — zdobycie kategorii jako cel.

---

## 14. INTEGRACJA Z GOOGLE WORKSPACE


### 14.1. Kalendarz

**Nie subskrypcja ICS.** Google Calendar API + kanał `watch` (push notifications) → webhook → aktualizacja lokalnego cache. Jeden kalendarz per jednostka w `Unit.googleCalendarId`. Synchronizacja dwukierunkowa z jawnym rozstrzyganiem konfliktów.

Widoki: kalendarium jednostki, kalendarium zagregowane dla jednostek podległych (warstwy), eksport `.ics` **read-only dla rodziców** — to właściwe miejsce na subskrypcję.

Kalendarium roczne jest **materializowane** przy zatwierdzeniu planu pracy: snapshot do PDF i XLSX w S3 i na Dysku, żeby zatwierdzona wersja była niezmienna niezależnie od późniejszych edycji w Google.

### 14.2. Bezpieczeństwo

Tokeny szyfrowane w bazie (AES-GCM, klucz z `ENCRYPTION_KEY`), rotacja, scope minimalny (`drive.file` zamiast `drive` gdzie to możliwe), rate limiting z backoffem, wszystkie operacje przez kolejkę z retry i DLQ.

---

## 15. MAPA PUBLICZNA I WIZYTÓWKI

Publiczna, bez logowania, pod adresem z `PUBLIC_MAP_URL` (domyślnie `/mapa-jednostek`), włączana `PUBLIC_MAP_ENABLED`. MapLibre GL + OpenStreetMap (bez klucza API), klastrowanie markerów, filtry: organizacja, typ jednostki, chorągiew.

Kliknięcie pineski otwiera wizytówkę: pełna nazwa, opis, e-mail kontaktowy, linki społecznościowe **z ikoną per platforma** (Facebook, Instagram, YouTube, TikTok, Discord, strona WWW — rejestr rozszerzalny w słowniku), lokalizacja harcówki, godziny zbiórek, przycisk kontaktu.

Komendant edytuje wizytówkę w dowolnym momencie, nie tylko przy planie pracy.

**Prywatność:** publikowane są wyłącznie dane jednostki, nigdy dane osobowe. Publikacją steruje `isPubliclyVisible`, którym dysponuje **sam komendant** — bez akceptacji jednostki nadrzędnej. Opcjonalnie może włączyć `locationPrecision: APPROXIMATE` (rozmycie do ~500 m), przydatne gdy harcówka mieści się w domu prywatnym. `REQUIRE_UNIT_CARD_APPROVAL` (domyślnie `false`) pozwala organizacji włączyć moderację, jeśli okaże się potrzebna.

Mapa ma **własny styl dla trybu ciemnego** przełączany razem z motywem aplikacji.

---

## 16. WARSTWA WIZUALNA

### 16.1. Design system

Tailwind CSS + shadcn/ui jako baza, rozszerzone w `packages/ui`. **Żadnych kolorów zapisanych wprost w komponentach** — wyłącznie tokeny CSS.

Tokeny w trzech warstwach: prymitywy (skala szarości, akcenty) → semantyczne (`--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--accent`, `--success`, `--warning`, `--danger`, `--info`) → komponentowe.

Typografia: jeden krój bezszeryfowy o dobrym wsparciu polskich znaków (Inter albo IBM Plex Sans), skala modularna, `font-variant-numeric: tabular-nums` w tabelach.

Gęstość: interfejs jest narzędziem pracy, nie landing page'em — priorytet ma czytelność tabel i list, nie duże odstępy.

### 16.2. Tryb jasny i ciemny

**Wymaganie obowiązkowe.** Implementacja:

- Trzy stany: `light`, `dark`, `system`. Domyślny z `DEFAULT_THEME`.
- Strategia `class` na `<html>` (`.dark`), przełączanie przez `next-themes` albo własny provider o tej samej semantyce.
- **Brak mignięcia złym motywem:** skrypt inline w `<head>` ustawiający klasę przed pierwszym malowaniem, `suppressHydrationWarning` na `<html>`.
- Preferencja zapisywana **dwutorowo**: `localStorage` dla natychmiastowego działania oraz `Person.themePreference` w bazie, żeby ustawienie szło za użytkownikiem między urządzeniami. Przy logowaniu wartość z bazy wygrywa, o ile użytkownik nie zmienił jej lokalnie później.
- Tryb `system` nasłuchuje `prefers-color-scheme` i reaguje na zmianę bez przeładowania.
- Przełącznik w nagłówku i w ustawieniach profilu, z etykietami tekstowymi (nie samą ikoną).
- **Kontrast:** oba motywy spełniają WCAG AA (4.5:1 dla tekstu, 3:1 dla dużego tekstu i elementów interaktywnych). Widoczne obramowanie fokusu w obu motywach. W trybie ciemnym nie używaj czystej czerni (`#000`) ani czystej bieli tekstu — obniż kontrast do wartości komfortowych.
- **Kolory semantyczne** mają osobne wartości per motyw; czerwień ostrzegawcza w trybie ciemnym musi być jaśniejsza i mniej nasycona.
- **Wykresy, mapa i podświetlanie składni** przełączają palety razem z motywem.
- **Wydruki i PDF-y zawsze jasne**, niezależnie od motywu — `@media print` wymusza jasną paletę, a generowanie PDF nie czyta preferencji użytkownika.
- Respektuj `prefers-reduced-motion` — wyłącz animacje przejścia motywu i pozostałe.

### 16.3. Układ i nawigacja

- Lewy sidebar: **przełącznik kontekstu jednostki** (osoba może pełnić funkcje w kilku jednostkach — przełączanie zmienia cały kontekst uprawnień, a aktywna jednostka jest zawsze widoczna), poniżej sekcje: Jednostka, Członkowie, Progresja, Rozkazy, Plan pracy, Dokumenty, Kalendarz.
- Górny pasek: breadcrumb pokazujący **pełną ścieżkę w hierarchii** (Organizacja → Chorągiew → Hufiec → Drużyna), globalne wyszukiwanie, przełącznik motywu, menu profilu.
- Widok mobilny: sidebar jako drawer, tabele degradujące się do kart.
- **Puste stany** z konkretną podpowiedzią, co zrobić (nie samo „Brak danych").
- Tabele: sortowanie i paginacja po stronie serwera, zapisywane zestawy filtrów, eksport widoku do CSV.
- Formularze: walidacja inline, zapisywanie wersji roboczych przy dłuższych formularzach (plan pracy, kreator rozkazu), ostrzeżenie przed opuszczeniem strony z niezapisanymi zmianami.
- **Dostępność:** pełna obsługa klawiatury, poprawne role ARIA, `lang="pl"`, komunikaty o błędach powiązane z polami.

---

## 17. RODO I OCHRONA MAŁOLETNICH

- **Rejestr czynności przetwarzania** jako encja, nie dokument.

- **Minimalizacja:** `birthDate` i `school` widoczne wyłącznie dla funkcyjnych własnej jednostki i jednostek nadrzędnych z uprawnieniem `VIEW_PERSONAL_DATA`. W widokach zagregowanych wyższych szczebli — **tylko wiek, nigdy data urodzenia**.
- **Ochrona małoletnich:** przechowuj wyłącznie `minorProtectionVerifiedAt`, `minorProtectionValidUntil` i `standardsAcknowledgedAt` — **nigdy treści zaświadczeń**. Blokada mianowania na funkcje wychowawcze bez ważnej weryfikacji. Automatyczne przypomnienia 60/30/7 dni przed wygaśnięciem, do instruktora i jego zwierzchnika.
- **Audit log dostępów** do danych osobowych małoletnich: kto, kiedy, jaki zakres. Każdy eksport zawierający dane osobowe logowany z zakresem i celem.

---

## 18. PANEL ADMINISTRACYJNY I DOKUMENTACJA

**Panel:**
- **Ustawienia** z blokadą pól nadpisanych przez `.env` (§5).
- **Słowniki** — edytor wersjonowanych słowników z podglądem różnic między wersjami i datą wejścia w życie.
- **Użytkownicy i uprawnienia** — z widokiem „uprawnienia efektywne" pokazującym, **skąd** wynika każde uprawnienie.
- **Nieaktywne profile** (§8.3) z akcją przywrócenia (§8.5).
- **Zaproszenia** — oczekujące, wygasłe, ponowne wysłanie, unieważnienie.
- **Eksport bazy** — CSV / JSON / SQL z **filtrowaniem hierarchicznym** („wybierz jednostkę wraz ze wszystkimi podległymi"), wyborem zakresu pól, opcją anonimizacji; generowany asynchronicznie, link wygasa po `EXPORT_LINK_TTL_MINUTES`.
- **Audit log** — pełny, niemodyfikowalny, z filtrowaniem.
- **Zdrowie systemu** — status kolejek, integracji, migracji, ostatnich synchronizacji.
- **Link do pełnej dokumentacji** w widocznym miejscu.

**Dokumentacja do wygenerowania** (`docs/`, renderowana wewnątrz aplikacji, wersjonowana w repo):

| Plik | Zawartość |
|---|---|
| `docs/uzytkownik.md` | Instrukcja dla drużynowego, harcerza, hufcowego, komendanta chorągwi — ścieżkami zadaniowymi, nie ekranami |
| `docs/administrator.md` | Wdrożenie, konfiguracja, kopie zapasowe, aktualizacje |
| `docs/keycloak.md` | **Kompletna konfiguracja wg §9** — realm, klienci, scope'y, mappery, role konta serwisowego, grupy, SMTP, polityka haseł, krok po kroku od zera |
| `docs/api.md` + Swagger UI | Interaktywna dokumentacja API z `@nestjs/swagger` |
| `docs/uprawnienia.md` | **Generowana automatycznie** macierz kompetencji z kolumną `legalBasis` |
| `docs/cykl-zycia-konta.md` | Zaproszenie, archiwizacja, przywrócenie, ponowne użycie adresu — z diagramami stanów |
| `docs/model-danych.md` | Diagram ERD + opis encji |
| `docs/integracje.md` | Google Drive, Calendar, S3/CDN, konfiguracja i uprawnienia |
| `docs/eksport.md` | Formaty eksportu, filtrowanie hierarchiczne, zasady RODO |
| `docs/regulaminy.md` | Mapowanie: reguła w kodzie → przepis ZHR, z listą otwartych `TODO(regulamin)` |

---

## 19. KOLEJNOŚĆ PRACY

Po każdym etapie zatrzymaj się na akceptację.

1. **Fundament** — monorepo, Docker Compose, Prisma schema, realm Keycloak (export JSON), seed słowników, CI.
2. **Model organizacyjny** — jednostki, nomenklatura, drzewo, aliasy statutowe, CRUD, testy hierarchii.
3. **Osoby i cykl życia konta** — zaproszenia, aktywacja, archiwizacja, przywracanie, ponowne użycie adresu, profile bez konta, opiekunowie.
4. **Instruktorzy** — model RSI, zwierzchnik vs przełożony, p.o. i opiekun jednostki.
5. **Autoryzacja** — `AuthorizationService`, macierz kompetencji, subsydiarność, delegacje, komplet testów pozytywnych i negatywnych.
6. **Rozkazy** — model, kreator, dzienniki, odwracalność, kary organizacyjne.
7. **Progresja** — trzy silniki, sprawności, stopnie instruktorskie i Zobowiązanie, widoki drużynowego i harcerza.
8. **Spis, plan pracy, kategoryzacja.**
9. **Google Workspace** — Dysk, Kalendarz, kolejki, tryb awaryjny.
10. **Mapa publiczna i wizytówki.**
11. **Warstwa wizualna** — design system, tryb jasny i ciemny, dostępność, widok mobilny.
12. **Panel administracyjny, eksporty, audit log, dokumentacja.**


---

## 20. FORMAT ODPOWIEDZI NA KAŻDYM ETAPIE

1. Krótkie uzasadnienie decyzji projektowych (maks. 10 zdań).
2. Drzewo plików, które powstają lub się zmieniają.
3. Pełna zawartość plików — **bez skrótów typu `// ...reszta bez zmian`**.
4. Polecenia do uruchomienia.
5. Lista `TODO(regulamin)` — miejsca wymagające potwierdzenia w Głównej Kwaterze.
6. Co powstanie w następnym etapie.

---

## 21. CZEGO NIE ROBIĆ

- Nie implementuj pionu terenowego: okręgów, obwodów, zarządów, finansów, majątku, osobowości prawnej.
- Nie wpisuj nazw stopni, sprawności ani wymagań do kodu — tylko do seedów.
- **Nie implementuj zasięgu władzy jako głębokości w drzewie** — ani „jeden poziom w dół", ani „całe poddrzewo". Każda akcja ma własny zasięg z macierzy kompetencji.
- Nie rób z subsydiarności cichego fallbacku — wejście jednostki nadrzędnej w kompetencje niższej musi mieć powód, datę i ślad w rozkazie.
- Nie zakładaj, że hierarchia jednostek pokrywa się z hierarchią zwierzchnictwa instruktorskiego. Nie pokrywa się.
- Nie traktuj nagany jak odwrotności pochwały.
- Nie pozwól użytkownikowi zarejestrować się samodzielnie — konto zakłada komendant.
- Nie zakładaj, że każdy członek ma e-mail.
- **Nie kasuj danych przy usuwaniu użytkownika** i nie blokuj ponownego użycia jego adresu.
- Nie przywracaj profilu bez podania nowego, wolnego adresu e-mail.
- Nie uzależniaj roli root od adresu e-mail.
- Nie trzymaj dodatkowych danych osobowych w Keycloak — to wyłącznie dostawca tożsamości.
- Nie modeluj szóstki jak zastępu.
- Nie mieszaj wędrowników z harcerzami starszymi.
- Nie łącz spisu instruktorskiego ze spisem jednostek ani z planem pracy.
- Nie koduj kolorów wprost w komponentach — tylko tokeny, działające w obu motywach.
