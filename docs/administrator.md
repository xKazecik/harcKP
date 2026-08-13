# HARC — administracja i wdrożenie

## Wdrożenie od zera

```bash
cp .env.example .env      # uzupełnij sekrety (Keycloak, S3, ENCRYPTION_KEY)
make dev                  # dev: Postgres, Redis, Keycloak+realm, MailHog, MinIO
make migrate              # migracje + indeks częściowy + prisma generate
make seed                 # słowniki (idempotentnie)
```

Produkcja: `docker compose -f docker-compose.prod.yml up -d` z zewnętrznym
Postgresem, Redisem, Keycloakiem i S3. Konfiguracja Keycloak: `docs/keycloak.md`.

## Konfiguracja (trzy poziomy, §5)

default w kodzie → baza (panel) → **zmienna środowiskowa (nadrzędna)**.
Pole nadpisane przez env jest w panelu wyszarzone; zapis zwraca
`409 SETTING_LOCKED_BY_ENV` — walidacja serwerowa.

## Kopie zapasowe

- PostgreSQL: `pg_dump` co noc + WAL archiving; test odtwarzania co kwartał.
- S3/MinIO: wersjonowanie bucketa (rozkazy i plany PDF są niezmienialne).
- Keycloak: eksport realmu `make realm-export` po każdej zmianie konfiguracji.

## Aktualizacje

1. `git pull` → `pnpm install` → `make migrate` (migracje są addytywne).
2. Nowe wersje słowników wprowadzaj przez seed z wyższym `version` —
   NIGDY nie nadpisuj istniejących wersji (trwające karty prób, §2).

## Zadania cykliczne (worker)

| Job | Harmonogram | Działanie |
|---|---|---|
| expunge-penalties | 03:00 | zatarcie kar (§11.3) |
| minor-protection-reminders | 06:00 | przypomnienia 60/30/7 dni (§17) |
| heartbeat | co 60 s | test kolejek |

## Bezpieczeństwo

- Root = grupa Keycloak `/zhr_sysadmins` (claim, nie e-mail).
- Sysadmin nie zarządza innymi sysadminami — wymuszone w domenie.
- Sekrety wrażliwe szyfrowane AES-GCM kluczem z `ENCRYPTION_KEY`, z rotacją.
- Audit log jest append-only; eksporty danych osobowych logowane z celem.
- Retencja: `DATA_RETENTION_MONTHS` (job czyszczący wg rejestru czynności).

## Nadawanie uprawnień (§10.1, §10.4)

Dwie różne rzeczy, których nie należy mylić:

- **Rola administracyjna** (`SYSADMIN`, `UNIT_ADMIN`) — panel „Role i delegacje".
  Sysadmina nadaje i odbiera wyłącznie root. Sysadmin nie może tknąć innego
  sysadmina ani siebie; administrator jednostki działa tylko w swoim poddrzewie.
- **Delegacja kompetencji** — pojedyncza akcja z macierzy, powierzona funkcyjnemu
  na czas określony. Delegować można wyłącznie akcje oznaczone `delegable`
  i tylko takie, które delegujący sam posiada **z urzędu**. Subdelegacja jest
  zablokowana: kto ma coś z delegacji, nie przekaże tego dalej.

Sama funkcja (kwatermistrz, przyboczny, członek komendy) jest wpisem
ewidencyjnym i **nie daje żadnych uprawnień technicznych** — kompetencje
z urzędu ma tylko `roleKey = LEADER`, czyli komendant jednostki.

## Tryb roota (§10.1)

Panel → „Tryb roota". Pozwala wprowadzić zmianę bezpośrednio, z pominięciem
rozkazów i macierzy kompetencji: nadać i odebrać funkcję **bez rozkazu**,
zmienić dowolne pola jednostki i profilu osoby.

Zasady, na które warto zwrócić uwagę przy audycie:

- każda operacja wymaga **powodu** i trafia do logu jako `ROOT_OVERRIDE`;
- pominięcie walidacji (wiek, ochrona małoletnich, opiekun przy p.o.) wymaga
  jawnej flagi `force` i jest w logu odnotowane osobno — dzięki temu widać
  różnicę między poprawką literówki a obejściem zabezpieczenia;
- funkcja nadana tą drogą ma puste `appointedByOrderId`, więc w historii widać,
  które wpisy mają umocowanie w dokumencie, a które powstały interwencją;
- **opublikowanych rozkazów nie da się edytować także w tym trybie** (§8.6) —
  sprostowanie idzie osobnym rozkazem;
- adresu e-mail nie zmienia się tędy — musi przejść przez `/persons/me/email-change`,
  żeby zachować kolejność Keycloak → baza (§9.6).
