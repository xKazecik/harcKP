/**
 * Kontrakty modułu rozkazów (§11).
 */
import { z } from 'zod';

/** Katalog typów pozycji rozkazu (§11.2). */
export const OrderItemTypeSchema = z.enum([
  'ADMIT_PARTICIPANT',
  'RELEASE_PARTICIPANT',
  'APPOINT_FUNCTION',
  'DISMISS_FUNCTION',
  'AWARD_RANK',
  'AWARD_BADGE',
  'AWARD_ZUCH_STAR',
  'OPEN_TRIAL',
  'CLOSE_TRIAL',
  'EXTEND_TRIAL',
  'DISCONTINUE_TRIAL',
  'ADMIT_TO_PROMISE',
  'RECORD_INSTRUCTOR_PLEDGE',
  'COMMENDATION',
  'DISCIPLINARY_PENALTY',
  'FOUND_UNIT',
  'DISSOLVE_UNIT',
  'RENAME_UNIT',
  'SET_UNIT_NUMBER',
  'OPEN_UNIT_PROBATION',
  'CLOSE_UNIT_PROBATION',
  'EXTEND_UNIT_PROBATION',
  'APPOINT_UNIT_GUARDIAN',
  'ENROLL_ON_INSTRUCTOR_LIST',
  'REMOVE_FROM_INSTRUCTOR_LIST',
  'GRANT_INSTRUCTOR_LEAVE',
  'AWARD_INSTRUCTOR_RANK',
  'OPEN_INSTRUCTOR_TRIAL',
  'CLOSE_INSTRUCTOR_TRIAL',
  'AWARD_CATEGORY',
  'SET_ADDITIONAL_RANK_REQUIREMENTS',
  'EXEMPT_FROM_FEAT_APPROVAL',
  'APPOINT_CHAPTER',
]);
export type OrderItemType = z.infer<typeof OrderItemTypeSchema>;

export const CreateOrderSchema = z.object({
  unitId: z.string().uuid(),
  place: z.string().min(1).max(200),
  issuedAt: z.string().date(),
  contentText: z.string().max(50_000).optional(),
});
export type CreateOrder = z.infer<typeof CreateOrderSchema>;

export const AddOrderItemSchema = z.object({
  section: z.string().min(1).max(10),
  type: OrderItemTypeSchema,
  subjectPersonId: z.string().uuid().optional(),
  subjectUnitId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).default({}),
  effectiveDate: z.string().date(),
});
export type AddOrderItem = z.infer<typeof AddOrderItemSchema>;

/** Rozszerzony formularz kary (§11.3) — tryb "Nagana / kara" w kreatorze. */
export const DisciplinaryPayloadSchema = z.object({
  penaltyType: z.enum([
    'UPOMNIENIE',
    'NAGANA',
    'ZAKAZ_PELNIENIA_FUNKCJI',
    'ODEBRANIE_STOPNIA_INSTRUKTORSKIEGO',
    'WYKLUCZENIE',
  ]),
  offenseDescription: z.string().min(1).max(5000),
  explanationRequestedAt: z.string().date(),
  /** przy ZAKAZ_PELNIENIA_FUNKCJI — jakich funkcji dotyczy i na jak długo */
  bannedFunctions: z.array(z.string()).optional(),
  banUntil: z.string().date().optional(),
  appealNotice: z.string().min(1), // pouczenie o odwołaniu
});
export type DisciplinaryPayload = z.infer<typeof DisciplinaryPayloadSchema>;
