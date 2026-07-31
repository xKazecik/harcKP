import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { appealDeadline } from '@harc/domain';
import {
  DisciplinaryPayloadSchema,
  type AddOrderItem,
  type CreateOrder,
  type OrderItemType,
} from '@harc/contracts';
import type { Prisma } from '@harc/db';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { InstructorsService } from '../instructors/instructors.service.js';

/** Mapowanie typu pozycji → akcja z macierzy kompetencji (§11.2). */
const ITEM_ACTION: Record<OrderItemType, string> = {
  ADMIT_PARTICIPANT: 'ADMIT_PARTICIPANT',
  RELEASE_PARTICIPANT: 'ADMIT_PARTICIPANT',
  APPOINT_FUNCTION: 'APPOINT_UNIT_LEADER',
  DISMISS_FUNCTION: 'APPOINT_UNIT_LEADER',
  AWARD_RANK: 'AWARD_RANK',
  AWARD_BADGE: 'AWARD_RANK',
  AWARD_ZUCH_STAR: 'AWARD_RANK',
  OPEN_TRIAL: 'AWARD_RANK',
  CLOSE_TRIAL: 'AWARD_RANK',
  EXTEND_TRIAL: 'AWARD_RANK',
  DISCONTINUE_TRIAL: 'AWARD_RANK',
  ADMIT_TO_PROMISE: 'ADMIT_PARTICIPANT',
  RECORD_INSTRUCTOR_PLEDGE: 'ADMIT_INSTRUCTOR',
  COMMENDATION: 'ADMIT_PARTICIPANT',
  DISCIPLINARY_PENALTY: 'DISCIPLINE_INSTRUCTOR',
  FOUND_UNIT: 'FOUND_UNIT',
  DISSOLVE_UNIT: 'FOUND_UNIT',
  RENAME_UNIT: 'FOUND_UNIT',
  SET_UNIT_NUMBER: 'FOUND_UNIT',
  OPEN_UNIT_PROBATION: 'FOUND_UNIT',
  CLOSE_UNIT_PROBATION: 'FOUND_UNIT',
  EXTEND_UNIT_PROBATION: 'FOUND_UNIT',
  APPOINT_UNIT_GUARDIAN: 'APPOINT_UNIT_GUARDIAN',
  ENROLL_ON_INSTRUCTOR_LIST: 'ADMIT_INSTRUCTOR',
  REMOVE_FROM_INSTRUCTOR_LIST: 'ADMIT_INSTRUCTOR',
  GRANT_INSTRUCTOR_LEAVE: 'ADMIT_INSTRUCTOR',
  AWARD_INSTRUCTOR_RANK: 'AWARD_INSTRUCTOR_RANK',
  OPEN_INSTRUCTOR_TRIAL: 'AWARD_INSTRUCTOR_RANK',
  CLOSE_INSTRUCTOR_TRIAL: 'AWARD_INSTRUCTOR_RANK',
  AWARD_CATEGORY: 'AWARD_CATEGORY',
  SET_ADDITIONAL_RANK_REQUIREMENTS: 'AWARD_RANK',
  EXEMPT_FROM_FEAT_APPROVAL: 'FOUND_UNIT',
  APPOINT_CHAPTER: 'APPOINT_CHAPTER',
};

/** Typy wymagające pełnoletniego mianowanego z ważną ochroną małoletnich. */
const APPOINTMENT_TYPES: OrderItemType[] = ['APPOINT_FUNCTION'];

/**
 * Rozkazy (§11): kreator → walidacja → publikacja → skutki w dziennikach.
 * Skutki są ODWRACALNE: sprostowanie generuje operacje kompensujące,
 * nigdy nie kasuje historii.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly instructors: InstructorsService,
  ) {}

  /** Numeracja: licznik per jednostka per rok, wzorzec "L. {n}/{rok}". */
  private async nextNumber(unitId: string, issuedAt: Date): Promise<string> {
    const year = issuedAt.getFullYear();
    const count = await this.prisma.order.count({
      where: {
        unitId,
        issuedAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
      },
    });
    return `L. ${count + 1}/${year}`;
  }

  async createDraft(input: CreateOrder & { issuerPersonId: string }) {
    const issuedAt = new Date(input.issuedAt);
    return this.prisma.order.create({
      data: {
        unitId: input.unitId,
        issuerPersonId: input.issuerPersonId,
        number: await this.nextNumber(input.unitId, issuedAt),
        issuedAt,
        place: input.place,
        contentText: input.contentText ?? null,
      },
    });
  }

  /**
   * Dodanie pozycji z pełną walidacją kreatora (§11.2): kompetencja wydającego,
   * przynależność i status podmiotu, ochrona małoletnich przy mianowaniach,
   * rozszerzony formularz kary.
   */
  async addItem(orderId: string, actorPersonId: string, isRoot: boolean, item: AddOrderItem) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Rozkaz nie istnieje');
    if (order.status !== 'DRAFT') {
      throw new ConflictException({ code: 'ORDER_NOT_DRAFT' });
    }

    const targetUnitId = item.subjectUnitId ?? order.unitId;
    await this.authz.require(actorPersonId, isRoot, ITEM_ACTION[item.type], targetUnitId);

    if (item.subjectPersonId) {
      const subject = await this.prisma.person.findUnique({ where: { id: item.subjectPersonId } });
      if (!subject) throw new UnprocessableEntityException({ code: 'SUBJECT_NOT_FOUND' });
      if (subject.status === 'ARCHIVED') {
        throw new UnprocessableEntityException({ code: 'SUBJECT_ARCHIVED' });
      }
    }
    if (APPOINTMENT_TYPES.includes(item.type) && item.subjectPersonId) {
      await this.instructors.assertAppointable(item.subjectPersonId);
    }
    if (item.type === 'DISCIPLINARY_PENALTY') {
      const parsed = DisciplinaryPayloadSchema.safeParse(item.payload);
      if (!parsed.success) {
        throw new UnprocessableEntityException({
          code: 'DISCIPLINARY_FORM_INCOMPLETE',
          issues: parsed.error.issues.map((i) => i.path.join('.')),
        });
      }
    }

    return this.prisma.orderItem.create({
      data: {
        orderId,
        section: item.section,
        type: item.type,
        subjectPersonId: item.subjectPersonId ?? null,
        subjectUnitId: item.subjectUnitId ?? null,
        payload: item.payload as object,
        effectiveDate: new Date(item.effectiveDate),
      },
    });
  }

  /**
   * Publikacja: każda pozycja → PersonalEventLog + UnitLogbook z linkiem do
   * numeru punktu; skutki specyficzne (kary → DisciplinaryCase; jednostki →
   * status; funkcje → UnitLeadership).
   */
  async publish(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Rozkaz nie istnieje');
    if (order.status !== 'DRAFT') throw new ConflictException({ code: 'ORDER_NOT_DRAFT' });

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const ref = { orderItemId: item.id, orderNumber: order.number, section: item.section };
        if (item.subjectPersonId) {
          await tx.personalEventLog.create({
            data: {
              personId: item.subjectPersonId,
              eventType: item.type,
              occurredAt: item.effectiveDate,
              payload: { ...(item.payload as object), ...ref },
              orderItemId: item.id,
            },
          });
        }
        await tx.unitLogbookEntry.create({
          data: {
            unitId: item.subjectUnitId ?? order.unitId,
            entryType: item.type,
            occurredAt: item.effectiveDate,
            payload: { ...(item.payload as object), ...ref },
            orderItemId: item.id,
          },
        });
        await this.applyEffect(tx, item, order);
      }
      await tx.order.update({ where: { id: orderId }, data: { status: 'PUBLISHED' } });
    });
    return this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  }

  /** Skutki specyficzne — wywoływane w transakcji publikacji. */
  private async applyEffect(
    tx: Prisma.TransactionClient,
    item: { id: string; type: string; subjectPersonId: string | null; subjectUnitId: string | null; payload: unknown; effectiveDate: Date },
    order: { unitId: string; issuerPersonId: string },
  ): Promise<void> {
    const payload = item.payload as Record<string, unknown>;
    switch (item.type) {
      case 'ADMIT_PARTICIPANT':
        if (item.subjectPersonId) {
          await tx.unitMembership.create({
            data: {
              unitId: item.subjectUnitId ?? order.unitId,
              personId: item.subjectPersonId,
              validFrom: item.effectiveDate,
              admittedByOrderId: item.id,
            },
          });
        }
        break;
      case 'RELEASE_PARTICIPANT':
        if (item.subjectPersonId) {
          await tx.unitMembership.updateMany({
            where: { personId: item.subjectPersonId, unitId: item.subjectUnitId ?? order.unitId, validTo: null },
            data: { validTo: item.effectiveDate },
          });
        }
        break;
      case 'APPOINT_FUNCTION':
        if (item.subjectPersonId && item.subjectUnitId) {
          await tx.unitLeadership.create({
            data: {
              unitId: item.subjectUnitId,
              personId: item.subjectPersonId,
              isActing: payload.isActing === true,
              guardianInstructorId: (payload.guardianInstructorId as string) ?? null,
              appointedByOrderId: item.id,
              validFrom: item.effectiveDate,
            },
          });
        }
        break;
      case 'DISMISS_FUNCTION':
        if (item.subjectPersonId && item.subjectUnitId) {
          await tx.unitLeadership.updateMany({
            where: { personId: item.subjectPersonId, unitId: item.subjectUnitId, validTo: null },
            data: { validTo: item.effectiveDate },
          });
        }
        break;
      case 'FOUND_UNIT':
        if (item.subjectUnitId) {
          await tx.unit.update({
            where: { id: item.subjectUnitId },
            data: { status: 'ACTIVE', foundedByOrderId: item.id },
          });
        }
        break;
      case 'DISSOLVE_UNIT':
        if (item.subjectUnitId) {
          await tx.unit.update({
            where: { id: item.subjectUnitId },
            data: { status: 'DISSOLVED', dissolvedByOrderId: item.id },
          });
        }
        break;
      case 'DISCIPLINARY_PENALTY':
        if (item.subjectPersonId) {
          await tx.disciplinaryCase.create({
            data: {
              subjectPersonId: item.subjectPersonId,
              initiatedByPersonId: order.issuerPersonId,
              status: 'PENALTY_ISSUED',
              penaltyType: payload.penaltyType as never,
              penaltyDetails: {
                bannedFunctions: payload.bannedFunctions ?? null,
                banUntil: payload.banUntil ?? null,
              },
              offenseDescription: (payload.offenseDescription as string) ?? null,
              explanationRequestedAt: payload.explanationRequestedAt
                ? new Date(payload.explanationRequestedAt as string)
                : null,
              penaltyOrderItemId: item.id,
              appealDeadline: appealDeadline(item.effectiveDate),
              banEndsAt: payload.banUntil ? new Date(payload.banUntil as string) : null,
            },
          });
        }
        break;
      default:
        // Pozostałe typy: skutek = wpisy w dziennikach; moduły domenowe
        // (progresja, spis) nasłuchują po orderItemId.
        break;
    }
  }

  /**
   * Sprostowanie (§11.2): status CORRECTED + operacje kompensujące na
   * wskazanych pozycjach (reverted=true + wpis kompensujący w dziennikach).
   * Historia NIGDY nie jest kasowana.
   */
  async correct(orderId: string, revertItemIds: string[], correctionOrderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status !== 'PUBLISHED') {
      throw new ConflictException({ code: 'ORDER_NOT_PUBLISHED' });
    }
    await this.prisma.$transaction(async (tx) => {
      for (const id of revertItemIds) {
        const item = order.items.find((i) => i.id === id);
        if (!item || item.reverted) continue;
        await tx.orderItem.update({ where: { id }, data: { reverted: true } });
        await tx.unitLogbookEntry.create({
          data: {
            unitId: item.subjectUnitId ?? order.unitId,
            entryType: `REVERTED:${item.type}`,
            payload: { revertedItemId: id, correctionOrderId },
            orderItemId: id,
          },
        });
        if (item.subjectPersonId) {
          await tx.personalEventLog.create({
            data: {
              personId: item.subjectPersonId,
              eventType: `REVERTED:${item.type}`,
              occurredAt: new Date(),
              payload: { revertedItemId: id, correctionOrderId },
              orderItemId: id,
            },
          });
        }
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CORRECTED', supersededById: correctionOrderId },
      });
    });
  }

  async get(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Rozkaz nie istnieje');
    return order;
  }

  list(unitId: string) {
    return this.prisma.order.findMany({
      where: { unitId },
      orderBy: { issuedAt: 'desc' },
      include: { items: { select: { id: true, section: true, type: true, reverted: true } } },
    });
  }
}
