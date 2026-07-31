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
- Tokeny Google szyfrowane AES-GCM (`ENCRYPTION_KEY`), rotacja.
- Audit log jest append-only; eksporty danych osobowych logowane z celem.
- Retencja: `DATA_RETENTION_MONTHS` (job czyszczący wg rejestru czynności).
