# API HARC

Interaktywna dokumentacja: Swagger UI pod `/api/docs` (po włączeniu
`@nestjs/swagger` — dekoratory są gotowe do adnotacji; TODO infra).

## Autoryzacja

Dev: nagłówki `X-Person-Id` (UUID osoby) i `X-Root: true`. Docelowo: Bearer
token Keycloak (audience `harc-api`), z których guard wyciąga `person_id`
i claim `groups`.

## Przegląd endpointów

| Obszar | Endpointy |
|---|---|
| Zdrowie | `GET /health`, `GET /ready` |
| Jednostki | `POST/GET /units`, `GET /units/:id`, `GET /units/:id/tree`, `PATCH /units/:id` |
| Nomenklatura | `GET /nomenclature?unitType&branch` |
| Osoby | `POST /persons/invite`, `POST /persons/without-account`, `GET /persons/:id`, `POST /persons/:id/guardians`, `POST /persons/:id/archive`, `POST /persons/:id/restore`, `GET /persons` (archiwalne) |
| Kreator zaproszeń | `GET/POST /public/invitations/:token[/password-email|/password|/profile|/guardian|/finish]` |
| Zaproszenia (panel) | `GET /invitations?status`, `POST /invitations/:id/resend`, `POST /invitations/:id/revoke` |
| Instruktorzy | `GET /instructors/:personId`, `POST /instructors/:personId/leave`, `POST /instructors/:personId/transfer`, `POST /instructors/transfers/:id/advance` |
| Rozkazy | `POST /orders`, `POST /orders/:id/items`, `POST /orders/:id/publish`, `POST /orders/:id/correct`, `GET /orders/:id`, `GET /orders?unitId` |
| Progresja | `POST /progression/start`, `GET /progression/person/:id`, `GET /progression/unit/:id/pending`, `POST /progression/requirements/:id/[submit|verify|approve-feat|withdraw-feat]`, `POST /progression/:id/transition` |
| Spis/plany | `POST /planning/census/instructors/:year/open`, `.../declare`, `.../status/:personId`, `POST /planning/work-plans/:unitId/:year[/submit|/decide]`, `POST /planning/categorization/:unitId/:year` |
| Panel | `GET/PUT /admin/settings`, `GET /admin/dictionaries`, `GET /admin/effective-permissions`, `GET /admin/audit-log`, `POST/GET /admin/exports`, `GET /admin/system-health` |
| Publiczne | `GET /public/map-units?branch&type` |

Kody błędów domenowych: `EMAIL_ALREADY_IN_USE` (409), `CONFIRM_HISTORICAL_EMAIL`
(409), `SETTING_LOCKED_BY_ENV` (409), `MINOR_PROTECTION_NOT_VERIFIED` (422),
`UNIT_HIERARCHY_VIOLATION` (422), `INVITATION_INVALID` (400, neutralny),
`INVALID_PROGRESSION_TRANSITION` (409), `ORDER_ITEM_REQUIRED` (422),
`RESEND_COOLDOWN` (409), `RETRY_BLOCKED` (409), `FORBIDDEN` (403).
