/**
 * @harc/contracts — schematy Zod i typy współdzielone (§3).
 *
 * Enumy MUSZĄ pozostawać zgodne ze schema.prisma; walidacja na granicach
 * (kontrolery API, formularze web) używa wyłącznie tych schematów.
 */
import { z } from 'zod';

export const BranchSchema = z.enum(['HARCERZE', 'HARCERKI']);
export type Branch = z.infer<typeof BranchSchema>;

export const UnitTypeSchema = z.enum([
  'ORGANIZACJA',
  'CHORAGIEW',
  'NAMIESTNICTWO',
  'HUFIEC',
  'ZWIAZEK_DRUZYN',
  'GROMADA',
  'DRUZYNA',
  'DRUZYNA_WEDROWNICZA',
  'SAMODZIELNY_ZASTEP',
  'SZCZEP',
  'KRAG_HARCERSTWA_STARSZEGO',
  'KRAG_INSTRUKTORSKI',
]);
export type UnitType = z.infer<typeof UnitTypeSchema>;

export const UnitStatusSchema = z.enum(['PROBATIONARY', 'ACTIVE', 'SUSPENDED', 'DISSOLVED']);
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

export const MembershipCategorySchema = z.enum([
  'UCZESTNIK',
  'HARCERZ_STARSZY',
  'INSTRUKTOR',
  'CZLONEK_WSPOLDZIALAJACY',
]);
export type MembershipCategory = z.infer<typeof MembershipCategorySchema>;

export const PersonStatusSchema = z.enum(['INVITED', 'ACTIVE', 'ARCHIVED']);
export type PersonStatus = z.infer<typeof PersonStatusSchema>;

export const InstructorRankSchema = z.enum(['PRZEWODNIK', 'PODHARCMISTRZ', 'HARCMISTRZ']);
export type InstructorRank = z.infer<typeof InstructorRankSchema>;

export const ThemePreferenceSchema = z.enum(['LIGHT', 'DARK', 'SYSTEM']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const TargetScopeSchema = z.enum([
  'OWN_UNIT',
  'DIRECT_CHILDREN',
  'SUBTREE',
  'OWN_BRANCH_ORG',
]);
export type TargetScope = z.infer<typeof TargetScopeSchema>;

/**
 * Wiersz macierzy kompetencji (§10.2) — walidacja seedów i payloadów słownika.
 */
export const CompetenceSchema = z.object({
  action: z.string().min(1),
  holderLevel: UnitTypeSchema,
  branch: BranchSchema.optional(),
  targetScope: TargetScopeSchema,
  targetTypes: z.array(UnitTypeSchema),
  requiresAdult: z.boolean(),
  requiresMinorProtection: z.boolean(),
  minimumInstructorRank: InstructorRankSchema.optional(),
  delegable: z.boolean(),
  legalBasis: z.string().min(1),
  validFrom: z.string(),
  validTo: z.string().optional(),
  version: z.number().int().positive().optional(),
});
export type Competence = z.infer<typeof CompetenceSchema>;

/**
 * Formularz "Przyjmij do jednostki" (§8.2, krok 1) — DOKŁADNIE trzy pola.
 */
export const InvitePersonSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
});
export type InvitePerson = z.infer<typeof InvitePersonSchema>;

export * from './units.js';
export * from './persons.js';

/** Odpowiedź ConfigService (§5) — trzy poziomy konfiguracji. */
export const SettingSchema = z.object({
  key: z.string(),
  value: z.string(),
  source: z.enum(['default', 'database', 'env']),
  isLocked: z.boolean(),
});
export type Setting = z.infer<typeof SettingSchema>;
