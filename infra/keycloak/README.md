# Keycloak — import realmu (dev)

Plik `realm-export.json` jest montowany do kontenera Keycloak i importowany przy
starcie (`--import-realm`). Środowisko dev wstaje jednym poleceniem: `make dev`.

Uwagi:

- Sekrety klientów (`dev-only-change-me-*`) są WYŁĄCZNIE developerskie. Na
  produkcji wygeneruj nowe w konsoli Keycloak i ustaw w zmiennych środowiskowych.
- `redirectUris` wskazują `http://localhost:3000` — na produkcji podmień na
  `{APP_URL}` (pełna procedura: `docs/keycloak.md`, etap 12).
- Konto serwisowe `harc-admin` ma dokładnie role: `manage-users`, `view-users`,
  `query-users`, `query-groups` (opcjonalnie `view-events`). NIGDY `realm-admin`,
  `manage-realm` ani `manage-clients` (§9.2).
- Grupa `/zhr_sysadmins` = ROOT w aplikacji, wykrywany claimem `groups` z pełną
  ścieżką (full path ON). Root NIE jest nadawany przez adres e-mail (§9.4).
- SMTP w dev wskazuje MailHog (`mailhog:1025`) — bez niego `execute-actions-email`
  nie działa i kreator zaproszeń spada do trybu awaryjnego (§8.2).
- User Profile: atrybuty niezarządzane wyłączone — Keycloak jest wyłącznie
  dostawcą tożsamości; dane osobowe należą do aplikacji (§9.1).
