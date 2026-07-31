# Eksport danych (§18, §17)

`POST /admin/exports` tworzy `ExportJob` przetwarzany asynchronicznie przez
worker (kolejka `exports`).

Parametry: `scopeUnitId` (jednostka **wraz ze wszystkimi podległymi** —
filtrowanie hierarchiczne), `format` (CSV/JSON/SQL), `fields` (wybór zakresu),
`anonymize` (pseudonimizacja), `purpose` (**wymagany** — cel przetwarzania).

Zasady RODO:

- każdy eksport zawierający dane osobowe trafia do audit logu z zakresem
  pól, liczbą wierszy i celem;
- link do pliku wygasa po `EXPORT_LINK_TTL_MINUTES` (domyślnie 30 min);
- `birthDate` i `school` wyłącznie dla uprawnionych (`VIEW_PERSONAL_DATA`);
  w widokach zagregowanych wyższych szczebli — tylko wiek, nigdy data;
- eksport z danymi osobowymi wymaga ponownego uwierzytelnienia
  (`max_age=0`, §9.5).
