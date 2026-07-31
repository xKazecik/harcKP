# Mapowanie: reguła w kodzie → przepis ZHR

| Reguła | Miejsce w kodzie | Podstawa |
|---|---|---|
| Aliasy statutowe (namiestnictwo≡chorągiew, związek drużyn≡hufiec) | `domain/unit-level.ts → normalizeUnitLevel` | Statut ZHR |
| Hierarchia jednostek | `domain/unit-hierarchy.ts` | Regulaminy jednostek |
| Zasięg władzy per akcja (nie głębokość drzewa) | `domain/authorization.ts` + seed `competences.json` | §10.2, przepisy per wiersz (`legalBasis`) |
| Zwierzchnik: pwd/phm → komendant chorągwi; hm → Naczelnik | `domain/instructor-supervision.ts → getSupervisor` | Reg. Służby Instruktorskiej |
| Przełożony z przydziału | `getDirectSuperior` | RSI |
| Blokada mianowania bez ochrony małoletnich | `checkAppointmentEligibility` | RSI + polityka ochrony małoletnich |
| Kary: wyjaśnienia → kara → apelacja (1 mies., bez wykonania) → zatarcie (rok) | `domain/disciplinary.ts` | Regulamin dyscyplinarny |
| Progresja OH-ek: próba otwierana/zamykana/umarzana rozkazem | `domain/progression.ts` | Reg. stopni harcerek |
| Progresja OH-y: liczy się przyznanie rozkazem | `domain/progression.ts` | Reg. stopni harcerzy 2025 |
| Kapituła: ≥3 osoby, instruktor, HR-chair ≥ phm | `validateChapter` | Reg. stopni harcerzy |
| Unikalność e-mail tylko INVITED/ACTIVE | `prisma/sql/partial-indexes.sql` | decyzja projektowa §8.4 |

## Otwarte TODO(regulamin)

1. **Asymetria podharcmistrzyni** (OH-ek: Naczelniczka?) — reg. z 2012 r.;
   wartość konfigurowalna w słowniku `instructor_ranks`.
2. **Zgoda rodzica <16 lat jako przypomnienie, nie blokada** — zmiana
   zamawiającego (2026-07-31) wobec §7.2; do potwierdzenia w GK.
3. Przełożony szczepowego = hufcowy (uproszczenie §1.3 — pion terenowy poza
   zakresem).
4. Umocowanie kręgów (hufiec/chorągiew/organizacja) i ich koedukacyjność.
5. Przynależność gromad do szczepu.
6. Paragrafy `legalBasis` w większości wierszy macierzy kompetencji.
7. Wersje regulaminów: stopnie harcerek, zuchowe, sprawności, kategoryzacja.
8. Terminy spisu jednostek (obecnie założenie: 1.12–31.01).

Pełna macierz uprawnień: `docs/uprawnienia.md` (generowana automatycznie).
