# Keycloak — konfiguracja od zera (§9)

Dev: realm importuje się automatycznie z `infra/keycloak/realm-export.json`
(`make dev`). Poniżej pełna procedura ręczna dla produkcji.

## 1. Realm

Utwórz realm `harc` i ustaw (Realm settings):

| Zakładka | Ustawienie | Wartość |
|---|---|---|
| Login | User registration | **OFF** — konto zakłada komendant |
| Login | Forgot password | ON |
| Login | Remember me | ON |
| Login | Email as username | OFF (username = UUID osoby) |
| Login | Login with email | **ON** |
| Login | Duplicate emails | **OFF** |
| Login | Edit username | **OFF** |
| Email | SMTP | wymagane — bez tego `execute-actions-email` nie działa |
| Sessions | SSO Session Idle / Max | 30 min / 10 h |
| Tokens | Access Token Lifespan | 5 min |
| Security defenses | Brute force detection | ON: 5 prób, 60 s, backoff wykładniczy |
| General | SSL required | `external` (prod: `all`) |

**Password policy:** `length(12) and notUsername and notEmail and passwordHistory(3) and hashAlgorithm(argon2)`.

**Required actions:** włącz `UPDATE_PASSWORD`, `VERIFY_EMAIL`, `UPDATE_PROFILE`,
`CONFIGURE_TOTP` (nieobowiązkowa).

**User Profile:** `email`, `firstName`, `lastName` wymagane; atrybuty
niezarządzane WYŁĄCZONE — Keycloak jest wyłącznie dostawcą tożsamości,
dane osobowe należą do aplikacji.

## 2. Klienci

### harc-web (aplikacja)
Client authentication ON (confidential), Standard flow ON, Direct access
grants OFF, PKCE **S256 wymagane**, redirect URIs:
`{APP_URL}/api/auth/callback/keycloak`, `{APP_URL}/zaproszenie/*`;
backchannel logout: `{APP_URL}/api/auth/backchannel-logout` (session required).

### harc-api (serwer zasobów)
Standard flow OFF, Service accounts OFF, Client authentication ON.
Służy wyłącznie jako `audience` weryfikowany przez NestJS.

### harc-admin (Admin API)
Standard flow OFF, Service accounts ON (`client_credentials`).
Role konta serwisowego z klienta `realm-management` — DOKŁADNIE te:

- `manage-users` — tworzenie, reset-password, execute-actions-email, disable,
  zmiana adresu przy archiwizacji/przywracaniu
- `view-users`, `query-users` — odczyt i wyszukiwanie (zajętość adresu)
- `query-groups` — wykrywanie roota
- `view-events` — opcjonalnie (audyt logowań)

**Nigdy:** `realm-admin`, `manage-realm`, `manage-clients`.

## 3. Client scope `harc` (default dla harc-web)

| Mapper | Typ | Konfiguracja |
|---|---|---|
| groups | Group Membership | claim `groups`, **Full group path ON**, ID+access token |
| audience-harc-api | Audience | Included Client Audience: `harc-api`, access token |
| person_id | User Property | property `username` → claim `person_id` |

Full group path MUSI być włączony: aplikacja porównuje claim z
`KEYCLOAK_ROOT_GROUP=/zhr_sysadmins` (z ukośnikiem).

## 4. Grupa root

Utwórz grupę `/zhr_sysadmins`. Członkostwo = uprawnienie ROOT w aplikacji,
wyliczane przy każdym logowaniu z claimu — nie z bazy i **nigdy z adresu
e-mail** (adres jest zmienialny i zwalniany przy archiwizacji — §9.4).
Bootstrap pustej instalacji: `ROOT_BOOTSTRAP_SUBS` działa do pierwszego
nadania SYSADMIN.

## 5. Operacje wrażliwe

Zmiana własnego e-maila, nadanie SYSADMIN, przywrócenie profilu, trwałe
usunięcie, eksport z danymi osobowymi → przekierowanie z `max_age=0`
(wymusza hasło) i weryfikacja `auth_time`; z OTP dodatkowo `acr_values=2`.

## 6. Zmiana adresu e-mail

Kolejność: **najpierw Keycloak, potem baza.** Token weryfikacyjny na NOWY
adres → po kliknięciu `PUT /users/{id}` + `VERIFY_EMAIL` → dopiero po
sukcesie zapis w bazie (transakcja). Całość przez kolejkę z retry i DLQ;
stara i nowa wartość w audit logu.
