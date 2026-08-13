import {
  ConflictException,
  Injectable,
  Logger,
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
import { PdfService } from '../../infrastructure/storage/pdf.service.js';
import { S3StorageService } from '../../infrastructure/storage/s3-storage.service.js';

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
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly instructors: InstructorsService,
    private readonly pdf: PdfService,
    private readonly storage: S3StorageService,
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

    await this.storeOrderPdf(orderId);
    return this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  }

  /**
   * Zapisuje niezmienialną kopię rozkazu w S3 (§11.1: „kopia w S3 — obowiązkowa").
   *
   * @param orderId - identyfikator opublikowanego rozkazu
   * @remarks Wykonywane PO zatwierdzeniu transakcji, nie w jej środku: zapis
   * do S3 nie jest transakcyjny, więc trzymanie go w transakcji bazodanowej
   * i tak nie dałoby atomowości, a wydłużałoby blokady. Gdy rozkaz ma już
   * wgrany PDF (`pdfStorageKey`), nic nie nadpisujemy — dokument organizacji
   * jest niezmienialny (§8.6).
   *
   * Błąd zapisu nie wycofuje publikacji: rozkaz jest wydany w momencie
   * publikacji, a brak kopii to usterka techniczna do ponowienia. Zostaje
   * odnotowany w logu i widoczny jako brak `pdfStorageKey`.
   */
  private async storeOrderPdf(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: { section: 'asc' } } },
    });
    if (!order || order.pdfStorageKey) return;

    try {
      // Order nie ma relacji do Unit — tylko skalarne unitId.
      const unit = await this.prisma.unit.findUnique({
        where: { id: order.unitId },
        select: { localityName: true },
      });

      const pdf = await this.pdf.render({
        title: `Rozkaz ${order.number}`,
        subtitle: `${unit?.localityName ?? ''} · ${order.place} · ${order.issuedAt
          .toISOString()
          .slice(0, 10)}`,
        blocks: [
          ...(order.contentText ? [{ lines: order.contentText.split('\n') }] : []),
          {
            heading: 'Pozycje rozkazu',
            lines: order.items.map(
              (i) =>
                `${i.section}. ${i.type}${
                  i.effectiveDate
                    ? ` — z dniem ${i.effectiveDate.toISOString().slice(0, 10)}`
                    : ''
                }`,
            ),
          },
        ],
        footer:
          `Dokument wygenerowany przez HARC ${new Date().toISOString().slice(0, 10)}. ` +
          'Kopia niezmienialna — sprostowanie następuje osobnym rozkazem (§11.2).',
      });

      const key = `orders/${order.issuedAt.getFullYear()}/${order.id}.pdf`;
      await this.storage.put(key, pdf, 'application/pdf');
      await this.prisma.order.update({ where: { id: orderId }, data: { pdfStorageKey: key } });
    } catch (err) {
      this.logger.error(
        `Nie udało się zapisać kopii PDF rozkazu ${orderId}: ${String(err)}. ` +
          'Rozkaz pozostaje opublikowany; kopię można wygenerować ponownie.',
      );
    }
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
              // Funkcja ze słownika Nomenclature (§6.4). Brak wartości = LEADER,
              // czyli komendant jednostki. Tylko LEADER daje kompetencje
              // z macierzy — pozostałe funkcje wymagają delegacji (§10.4).
              roleKey: typeof payload.roleKey === 'string' ? payload.roleKey : 'LEADER',
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
            where: {
              personId: item.subjectPersonId,
              unitId: item.subjectUnitId,
              // Zwolnienie dotyczy konkretnej funkcji — bez tego zwolnienie
              // z kwatermistrzostwa zamykałoby też funkcję komendanta.
              roleKey: typeof payload.roleKey === 'string' ? payload.roleKey : 'LEADER',
              validTo: null,
            },
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
