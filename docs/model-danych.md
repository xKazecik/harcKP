# Model danych HARC

Źródło prawdy: `packages/db/prisma/schema.prisma`. Diagram ERD:
`npx prisma generate && npx prisma-erd-generator` (opcjonalnie) albo dowolne
narzędzie czytające schemat.

## Obszary

**Słowniki (§2).** `Dictionary` → `DictionaryEntry` (wersjonowane:
`validFrom/validTo`, `sourceDocument`, `sourceClause`). Konsumenci przechowują
ID KONKRETNEJ wersji (`ProgressionInstance.requirementSetVersionId`,
`CategorizationSheet.requirementSetVersionId`). `Nomenclature` — etykiety
funkcyjnych. `Competence` — macierz uprawnień z `legalBasis`.

**Jednostki (§6).** `Unit` (drzewo przez `parentId`; nazwa generowana),
`UnitGroupMembership` (szczep grupuje — grupowanie ≠ podległość),
`Zastep`/`ZastepMembership` (trwały, z historią) vs `Szostka` (nietrwała),
`UnitLeadership` (p.o. + opiekun + scopeOverrides).

**Osoby (§7–8).** `Person` (INVITED/ACTIVE/ARCHIVED; `email` z częściowym
indeksem unikalnym; `historicalEmail` bez ograniczeń), `Guardian`
(`consentGivenAt` nullable — przypomnienie zamiast blokady), `Invitation`
(token wyłącznie jako SHA-256), `InstructorProfile` (RSI), `TransferRequest`.

**Autoryzacja (§10).** `AdminGrant` (SYSADMIN/UNIT_ADMIN; root wyłącznie
z Keycloak), `SubstitutionGrant` (subsydiarność — jawny grant),
`DelegationGrant`, `PendingApproval` (kontrasygnata opiekuna dla p.o.).

**Rozkazy (§11).** `Order` → `OrderItem` (payload walidowany Zod per typ;
`reverted` przy sprostowaniu), `UnitLogbookEntry`, `PersonalEventLog`,
`DisciplinaryCase` (maszyna stanów, zatarcie jobem).

**Progresja (§12).** `ProgressionInstance` (kind × branch decyduje
o przejściach) → `ProgressionRequirement` (zadania, wyczyn, dowody),
`Chapter`/`ChapterMember`.

**Planowanie (§13).** `CensusCampaign` → `InstructorCensusEntry` (automaty
stanów wyliczane) / `UnitCensusEntry`; `WorkPlan` (workflow + niezmienialny
PDF); `CategorizationSheet`.

**Operacje.** `AppSetting` (poziom „database" konfiguracji), `AuditLog`
(append-only), `ExportJob`, `EmailChangeRequest` (§9.6).
