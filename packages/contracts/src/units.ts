/**
 * Kontrakty modułu jednostek (§6) — walidacja na granicach API i formularzy.
 */
import { z } from 'zod';
import { BranchSchema, UnitStatusSchema, UnitTypeSchema } from './index.js';

export const LocationPrecisionSchema = z.enum(['EXACT', 'APPROXIMATE']);
export type LocationPrecision = z.infer<typeof LocationPrecisionSchema>;

/** Link społecznościowy wizytówki (§15) — platforma z rejestru słownikowego. */
export const SocialLinkSchema = z.object({
  platform: z.string().min(1), // code ze słownika social_platforms
  url: z.string().url(),
});
export type SocialLink = z.infer<typeof SocialLinkSchema>;

/** Harcówka i terminy zbiórek (§6.2). */
export const MeetingPlaceSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(1),
  meetingTimes: z.string().optional(),
});
export type MeetingPlace = z.infer<typeof MeetingPlaceSchema>;

/**
 * Utworzenie jednostki. Nazwa wyświetlana jest GENEROWANA (§6.2) — brak pola
 * "name". Status początkowy: PROBATIONARY (formalne powołanie rozkazem — etap 6).
 */
export const CreateUnitSchema = z.object({
  type: UnitTypeSchema,
  branch: BranchSchema,
  parentId: z.string().uuid().nullish(),
  number: z.string().max(10).nullish(),
  localityName: z.string().min(1).max(100),
  properName: z.string().max(100).nullish(),
  patron: z.string().max(200).nullish(),
});
export type CreateUnit = z.infer<typeof CreateUnitSchema>;

/**
 * Aktualizacja pól redakcyjnych jednostki. Zmiany strukturalne (typ, gałąź,
 * rodzic, status) przechodzą przez dedykowane operacje — docelowo rozkazy (etap 6).
 */
export const UpdateUnitSchema = z.object({
  number: z.string().max(10).nullish(),
  localityName: z.string().min(1).max(100).optional(),
  properName: z.string().max(100).nullish(),
  patron: z.string().max(200).nullish(),
  description: z.string().max(5000).nullish(),
  publicEmail: z.string().email().nullish(),
  socialLinks: z.array(SocialLinkSchema).nullish(),
  meetingPlace: MeetingPlaceSchema.nullish(),
  locationPrecision: LocationPrecisionSchema.optional(),
  isPubliclyVisible: z.boolean().optional(),
});
export type UpdateUnit = z.infer<typeof UpdateUnitSchema>;

/** Filtry listy jednostek. */
export const ListUnitsQuerySchema = z.object({
  type: UnitTypeSchema.optional(),
  branch: BranchSchema.optional(),
  parentId: z.string().uuid().optional(),
  status: UnitStatusSchema.optional(),
});
export type ListUnitsQuery = z.infer<typeof ListUnitsQuerySchema>;

/** Węzeł drzewa jednostek zwracany przez GET /units/:id/tree. */
export interface UnitTreeNode {
  id: string;
  type: z.infer<typeof UnitTypeSchema>;
  branch: z.infer<typeof BranchSchema>;
  status: z.infer<typeof UnitStatusSchema>;
  displayName: string;
  children: UnitTreeNode[];
}
