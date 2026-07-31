# Integracje

## Google Workspace (§14)

Tryby (`GOOGLE_MODE`): `WORKSPACE_SERVICE_ACCOUNT` (konto serwisowe +
domain-wide delegation, `GOOGLE_IMPERSONATE_SUBJECT`), `OAUTH_PERSONAL`,
`DISABLED` (domyślny w dev).

**Kalendarz:** Google Calendar API + kanał `watch` (push) → webhook →
lokalny cache (`GoogleCalendarChannel`). Jeden kalendarz per jednostka
(`Unit.googleCalendarId`). Synchronizacja dwukierunkowa z jawnym
rozstrzyganiem konfliktów. Eksport `.ics` read-only dla rodziców — jedyne
miejsce na subskrypcję ICS. Kalendarium roczne materializowane przy
zatwierdzeniu planu pracy (snapshot PDF/XLSX w S3 — niezmienialny).

**Bezpieczeństwo:** tokeny AES-GCM (`ENCRYPTION_KEY`), scope minimalny
(`drive.file` zamiast `drive`), rate limiting z backoffem, wszystkie operacje
przez kolejkę BullMQ z retry i DLQ.

## S3 / MinIO

Bucket `S3_BUCKET`: załączniki dowodów progresji, PDF-y rozkazów (obowiązkowa
kopia), plany pracy po zatwierdzeniu, eksporty (`EXPORT_LINK_TTL_MINUTES`).
Dev: MinIO z docker-compose (konsola :9001).

## SMTP

Aplikacja: `SMTP_*` (dev: MailHog :8025). Keycloak ma WŁASNĄ konfigurację
SMTP w realmie — bez niej `execute-actions-email` nie działa i kreator
zaproszeń przechodzi w tryb awaryjny (hasło przez API).
