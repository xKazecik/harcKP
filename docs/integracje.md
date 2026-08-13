# Integracje

## Google Workspace — poza zakresem

Integracja z Google Workspace (Dysk, Kalendarz) **nie jest częścią systemu**.
Decyzja zamawiającego z 2026-08-13: moduł został wycofany z zakresu i usunięty
z kodu, schematu bazy oraz konfiguracji, żeby nie zostawiać martwych pól
sugerujących działającą funkcję.

Wynikające z tego uproszczenia wobec pierwotnej specyfikacji:

- dokumenty (PDF rozkazów, zatwierdzone plany pracy, załączniki, eksporty)
  mają **jedno** miejsce składowania — S3; nie ma równoległego zapisu na Dysk;
- nie ma kalendarza jednostki ani synchronizacji wydarzeń, więc odpada też
  eksport `.ics` dla rodziców;
- kalendarium roczne z planu pracy pozostaje jako dokument (PDF/XLSX w S3),
  a nie jako żywy kalendarz.

Gdyby integracja miała kiedyś wrócić, trzeba ją zaprojektować od nowa —
w repozytorium nie ma po niej żadnego rusztowania.

## S3 / MinIO

Bucket `S3_BUCKET`: załączniki dowodów progresji, PDF-y rozkazów (obowiązkowa
kopia), plany pracy po zatwierdzeniu, eksporty (`EXPORT_LINK_TTL_MINUTES`).
Dev: MinIO z docker-compose (konsola :9001).

## SMTP

Aplikacja: `SMTP_*` (dev: MailHog :8025). Keycloak ma WŁASNĄ konfigurację
SMTP w realmie — bez niej `execute-actions-email` nie działa i kreator
zaproszeń przechodzi w tryb awaryjny (hasło przez API).

W `docker-compose.yml` usługi `api` i `worker` dostają `SMTP_HOST: mailhog`,
bo wartość z `.env` (`localhost`) jest przeznaczona dla uruchomienia poza
Dockerem — wewnątrz kontenera wskazywałaby na sam kontener.

## Keycloak — dwa adresy issuera

`KEYCLOAK_ISSUER_URL` to adres widziany przez **przeglądarkę**
(dev: `localhost:8080`). Wywołania serwer→serwer — wymiana kodu na token
w `apps/web` oraz całe Admin API w `apps/api` — idą pod
`KEYCLOAK_ISSUER_INTERNAL_URL`, w compose ustawiany na
`http://keycloak:8080/realms/harc`. Bez tego rozróżnienia kontener wołałby
`localhost`, czyli samego siebie, i zakładanie kont przy zaproszeniach oraz
zmiana adresu e-mail kończyłyby się `ECONNREFUSED`.
