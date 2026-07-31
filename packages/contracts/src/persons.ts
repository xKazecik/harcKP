/**
 * Kontrakty cyklu życia konta (§8) i osób (§7).
 */
import { z } from 'zod';
import { BranchSchema } from './index.js';

/** Krok 2 kreatora zaproszenia — uzupełnienie profilu (§8.2). */
export const CompleteProfileSchema = z.object({
  birthDate: z.string().date().optional(),
  school: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  crossNumber: z.string().max(30).optional(),
  promiseDate: z.string().date().optional(),
  /** Wcześniejsze stopnie/sprawności — tekst do weryfikacji przez komendanta. */
  priorAchievementsNote: z.string().max(5000).optional(),
});
export type CompleteProfile = z.infer<typeof CompleteProfileSchema>;

/** Dane opiekuna prawnego (§7.2). consentGivenAt = odnotowanie zgody. */
export const GuardianInputSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(1).max(30),
  email: z.string().email().optional(),
  address: z.string().min(1).max(500),
  consentGivenAt: z.string().date().optional(),
  consentDocumentRef: z.string().max(500).optional(),
});
export type GuardianInput = z.infer<typeof GuardianInputSchema>;

export const ArchiveReasonSchema = z.enum([
  'WYSTAPIENIE',
  'ZWOLNIENIE',
  'WYKLUCZENIE',
  'SMIERC',
  'BLAD_DANYCH',
  'INNY',
]);

/** Archiwizacja profilu (§8.3) — nigdy nie kasuje danych. */
export const ArchivePersonSchema = z.object({
  reason: ArchiveReasonSchema,
  reasonText: z.string().max(1000).optional(),
});
export type ArchivePerson = z.infer<typeof ArchivePersonSchema>;

/**
 * Przywrócenie profilu (§8.5) — adres wpisywany świadomie, nigdy „jednym
 * kliknięciem". confirmHistoricalEmail wymagane, gdy adres == historicalEmail.
 */
export const RestorePersonSchema = z.object({
  newEmail: z.string().email(),
  confirmHistoricalEmail: z.boolean().optional(),
});
export type RestorePerson = z.infer<typeof RestorePersonSchema>;

/** Profil bez konta (§8.2) — pełnoprawny ewidencyjnie, bez logowania. */
export const CreatePersonWithoutAccountSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  branch: BranchSchema,
  unitId: z.string().uuid(),
  birthDate: z.string().date().optional(),
});
export type CreatePersonWithoutAccount = z.infer<typeof CreatePersonWithoutAccountSchema>;

/** Zaproszenie — utworzenie (3 pola, §8.2) + jednostka docelowa. */
export const InviteToUnitSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  unitId: z.string().uuid(),
  branch: BranchSchema,
});
export type InviteToUnit = z.infer<typeof InviteToUnitSchema>;

export const ConsentStatusSchema = z.enum(['NOT_REQUIRED', 'MISSING', 'PRESENT']);

/**
 * Ostrzeżenia profilu zwracane drużynowemu — m.in. przypomnienie o zgodzie
 * rodzica (decyzja 2026-07-31: przypomnienie zamiast blokady).
 */
export interface PersonWarnings {
  guardianConsent: z.infer<typeof ConsentStatusSchema>;
}
