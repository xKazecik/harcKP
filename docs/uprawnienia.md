# Macierz kompetencji HARC

> Plik GENEROWANY automatycznie z `packages/db/seeds/competences.json` —
> nie edytuj ręcznie. Regeneracja: `node scripts/generate-permissions-doc.mjs`.

Zasięg władzy NIE jest funkcją głębokości w drzewie (§10.2). Aliasy statutowe
(NAMIESTNICTWO≡CHORAGIEW, ZWIAZEK_DRUZYN≡HUFIEC) są normalizowane w silniku.

| Akcja | Poziom | Zasięg | Typy docelowe | Pełnoletność | Ochr. małoletnich | Delegowalna | Podstawa prawna |
|---|---|---|---|---|---|---|---|
| `ADMIT_PARTICIPANT` | DRUZYNA | OWN_UNIT | DRUZYNA, DRUZYNA_WEDROWNICZA, GROMADA, SAMODZIELNY_ZASTEP | nie | tak | nie | Reg. Drużyny Harcerzy — TODO(regulamin): uzupełnić § |
| `APPOINT_PATROL_LEADER` | DRUZYNA | OWN_UNIT | DRUZYNA, DRUZYNA_WEDROWNICZA | nie | nie | nie | Reg. Drużyny Harcerzy — wyłączna kompetencja drużynowego; hufcowy NIE mianuje zastępowych ani przybocznych. TODO(regulamin): uzupełnić § |
| `AWARD_RANK` | DRUZYNA | OWN_UNIT | DRUZYNA, DRUZYNA_WEDROWNICZA, SAMODZIELNY_ZASTEP | nie | nie | nie | Reg. Stopni Harcerzy 2025 — HR na wniosek kapituły; gdy drużynowy nie jest HR — hufcowy. TODO(regulamin): uzupełnić § |
| `FOUND_UNIT` | HUFIEC | DIRECT_CHILDREN | DRUZYNA, DRUZYNA_WEDROWNICZA, GROMADA, SAMODZIELNY_ZASTEP | tak | nie | nie | Reg. Hufca — hufcowy powołuje i rozwiązuje drużyny. TODO(regulamin): uzupełnić § |
| `APPOINT_UNIT_LEADER` | HUFIEC | DIRECT_CHILDREN | DRUZYNA, DRUZYNA_WEDROWNICZA, GROMADA, SAMODZIELNY_ZASTEP | tak | nie | nie | Reg. Hufca — mianowanie i zwalnianie drużynowych. TODO(regulamin): uzupełnić § |
| `APPOINT_UNIT_GUARDIAN` | HUFIEC | DIRECT_CHILDREN | DRUZYNA, DRUZYNA_WEDROWNICZA, GROMADA | tak | nie | nie | Reg. Hufca — powołanie opiekuna drużyny (przy p.o.). TODO(regulamin): uzupełnić § |
| `FOUND_HUFIEC` | CHORAGIEW | DIRECT_CHILDREN | HUFIEC | tak | nie | nie | Reg. Chorągwi — komendant chorągwi powołuje i rozwiązuje hufce; standardowo NIE powołuje drużyn. TODO(regulamin): uzupełnić § |
| `ADMIT_INSTRUCTOR` | CHORAGIEW | OWN_BRANCH_ORG | — | tak | nie | nie | Reg. Służby Instruktorskiej — oś zwierzchnika, nie hierarchia jednostek. TODO(regulamin): uzupełnić § |
| `AWARD_INSTRUCTOR_RANK` | CHORAGIEW | OWN_BRANCH_ORG | — | tak | nie | nie | Reg. stopni instruktorskich — kompetencja per stopień i organizacja w słowniku instructor_ranks; zastrzeżona dla poziomu chorągwi i wyżej. Drużynowy i hufcowy NIE mają tej akcji. |
| `ISSUE_ORDER` | DRUZYNA | OWN_UNIT | DRUZYNA, DRUZYNA_WEDROWNICZA, GROMADA | nie | nie | nie | Reg. Drużyny — SAMODZIELNY_ZASTEP celowo wyłączony z targetTypes (twarde wyłączenie ISSUE_ORDER i MAINTAIN_UNIT_LOGBOOK, §6.3). |
| `ISSUE_ORDER` | HUFIEC | OWN_UNIT | HUFIEC | tak | nie | nie | Reg. Hufca — TODO(regulamin): uzupełnić § |
| `ISSUE_ORDER` | CHORAGIEW | OWN_UNIT | CHORAGIEW | tak | nie | nie | Reg. Chorągwi — TODO(regulamin): uzupełnić § |
| `DISCIPLINE_INSTRUCTOR` | CHORAGIEW | OWN_BRANCH_ORG | — | tak | nie | nie | Reg. Służby Instruktorskiej — kara wymierzana przez ZWIERZCHNIKA (oś getSupervisor, nie hierarchia jednostek). TODO(regulamin): uzupełnić § |
| `APPROVE_WORK_PLAN` | HUFIEC | DIRECT_CHILDREN | DRUZYNA, DRUZYNA_WEDROWNICZA, GROMADA, SAMODZIELNY_ZASTEP | tak | nie | tak | Reg. Hufca — zatwierdzanie planów pracy jednostek podległych (§13.3). Delegowalna (np. na członka komendy). |
| `AWARD_CATEGORY` | HUFIEC | DIRECT_CHILDREN | DRUZYNA, DRUZYNA_WEDROWNICZA | tak | nie | nie | Zasady kategoryzacji — hufcowy przyznaje kategorię POLOWA (§13.4). |
| `AWARD_CATEGORY` | CHORAGIEW | SUBTREE | DRUZYNA, DRUZYNA_WEDROWNICZA | tak | nie | nie | Zasady kategoryzacji — komendant chorągwi przyznaje kategorię LESNA (§13.4). |
| `AWARD_CATEGORY` | ORGANIZACJA | SUBTREE | DRUZYNA, DRUZYNA_WEDROWNICZA | tak | nie | nie | Zasady kategoryzacji — Naczelnik przyznaje kategorię PUSZCZANSKA (§13.4). |
| `APPOINT_CHAPTER` | DRUZYNA | OWN_UNIT | DRUZYNA, DRUZYNA_WEDROWNICZA | nie | nie | nie | Reg. Stopni — kapitułę powołuje drużynowy / hufcowy / komendant chorągwi (§11.2). TODO(regulamin): uzupełnić § |
| `APPOINT_CHAPTER` | HUFIEC | DIRECT_CHILDREN | DRUZYNA, DRUZYNA_WEDROWNICZA, SAMODZIELNY_ZASTEP | tak | nie | nie | Reg. Stopni (§11.2). TODO(regulamin): uzupełnić § |

## Otwarte TODO(regulamin)

- `ADMIT_PARTICIPANT` (DRUZYNA)
- `APPOINT_PATROL_LEADER` (DRUZYNA)
- `AWARD_RANK` (DRUZYNA)
- `FOUND_UNIT` (HUFIEC)
- `APPOINT_UNIT_LEADER` (HUFIEC)
- `APPOINT_UNIT_GUARDIAN` (HUFIEC)
- `FOUND_HUFIEC` (CHORAGIEW)
- `ADMIT_INSTRUCTOR` (CHORAGIEW)
- `ISSUE_ORDER` (HUFIEC)
- `ISSUE_ORDER` (CHORAGIEW)
- `DISCIPLINE_INSTRUCTOR` (CHORAGIEW)
- `APPOINT_CHAPTER` (DRUZYNA)
- `APPOINT_CHAPTER` (HUFIEC)
