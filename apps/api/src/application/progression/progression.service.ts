import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ageAt,
  canTransitionProgression,
  checkRankAge,
  transitionRequiresOrderItem,
  type ProgressionKind,
  type ProgressionStatus,
} from '@harc/domain';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

const KIND_TO_DICTIONARY: Record<ProgressionKind, (branch: string) => string> = {
  RANK: (b) => (b === 'HARCERKI' ? 'ranks_harcerki' : 'ranks_harcerze'),
  BADGE: () => 'badges',
  ZUCH_STAR: () => 'zuchy_gwiazdki',
  INSTRUCTOR_RANK: () => 'instructor_ranks',
};

/**
 * Progresja (§12) — wspólny serwis trzech silników.
 *
 * Różnice między organizacjami dotyczą WYŁĄCZNIE dozwolonych przejść stanów
 * i wymogu pozycji w rozkazie — obie zaszyte w @harc/domain (progression.ts).
 * UX (karta, zadania, edycja, indywidualizacja) jest wspólny.
 */
@Injectable()
export class ProgressionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * "Rozpocznij zdobywanie stopnia X": pobiera AKTUALNĄ wersję wymagań ze
   * słownika + dodatkowe wymagania drużyny; karta zapamiętuje
   * requirementSetVersionId i jest rozliczana wg tej wersji na zawsze (§2).
   */
  async startPath(input: {
    personId: string;
    unitId: string;
    kind: ProgressionKind;
    targetCode: string;
  }) {
    const person = await this.prisma.person.findUnique({ where: { id: input.personId } });
    if (!person || person.status === 'ARCHIVED') {
      throw new UnprocessableEntityException({ code: 'SUBJECT_UNAVAILABLE' });
    }
    const now = new Date();
    const dictKey = KIND_TO_DICTIONARY[input.kind](person.branch);
    const entry = await this.prisma.dictionaryEntry.findFirst({
      where: {
        dictionaryKey: dictKey,
        code: input.targetCode,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { version: 'desc' },
    });
    if (!entry) throw new NotFoundException({ code: 'REQUIREMENT_SET_NOT_FOUND' });

    // Walidacja wieku (payload słownika, §12.2)
    const payload = entry.payload as { ageMin?: number | null; ageMax?: number | null };
    if (person.birthDate && input.kind === 'RANK') {
      const ageError = checkRankAge({
        age: ageAt(person.birthDate, now),
        ageMin: payload.ageMin ?? null,
        ageMax: payload.ageMax ?? null,
      });
      if (ageError) throw new UnprocessableEntityException({ code: ageError });
    }

    // Karencja po negatywnym zamknięciu sprawności (§12.3)
    const blocked = await this.prisma.progressionInstance.findFirst({
      where: {
        personId: input.personId,
        targetCode: input.targetCode,
        status: 'CLOSED_NEGATIVE',
        retryBlockedUntil: { gt: now },
      },
    });
    if (blocked) {
      throw new ConflictException({ code: 'RETRY_BLOCKED', until: blocked.retryBlockedUntil });
    }

    const instance = await this.prisma.progressionInstance.create({
      data: {
        personId: input.personId,
        unitId: input.unitId,
        kind: input.kind,
        branch: person.branch,
        targetCode: input.targetCode,
        requirementSetVersionId: entry.id,
      },
    });

    // Domyślny zestaw wymagań + dodatkowe wymagania drużyny (§12.1)
    const defaults = ((entry.payload as { requirements?: Array<{ code: string; area?: string; description: string; isFeat?: boolean }> }).requirements ?? []);
    const unitExtras = await this.prisma.dictionaryEntry.findFirst({
      where: { dictionaryKey: 'unit_rank_extras', code: `${input.unitId}:${input.targetCode}` },
      orderBy: { version: 'desc' },
    });
    const extras = ((unitExtras?.payload as { requirements?: Array<{ code: string; description: string }> })?.requirements ?? []);
    for (const req of [...defaults, ...extras]) {
      await this.prisma.progressionRequirement.create({
        data: {
          instanceId: instance.id,
          code: req.code,
          areaCode: 'area' in req ? ((req as { area?: string }).area ?? null) : null,
          description: req.description,
          isFeat: 'isFeat' in req ? Boolean((req as { isFeat?: boolean }).isFeat) : false,
        },
      });
    }
    return this.get(instance.id);
  }

  async get(instanceId: string) {
    const instance = await this.prisma.progressionInstance.findUnique({
      where: { id: instanceId },
      include: { requirements: true },
    });
    if (!instance) throw new NotFoundException('Karta nie istnieje');
    return instance;
  }

  /** Drużynowy edytuje/indywidualizuje zadania; w trakcie może zamienić zadanie. */
  async replaceRequirement(instanceId: string, requirementId: string, description: string) {
    await this.prisma.progressionRequirement.update({
      where: { id: requirementId },
      data: { status: 'REPLACED' },
    });
    return this.prisma.progressionRequirement.create({
      data: { instanceId, code: 'CUSTOM', description },
    });
  }

  /** Harcerz zgłasza wykonanie z komentarzem i załącznikami (S3). */
  async submitCompletion(requirementId: string, evidence: { comment: string; attachments?: string[] }) {
    return this.prisma.progressionRequirement.update({
      where: { id: requirementId },
      data: { status: 'SUBMITTED', evidence: evidence as object, submittedAt: new Date() },
    });
  }

  async verify(requirementId: string, verifierPersonId: string) {
    return this.prisma.progressionRequirement.update({
      where: { id: requirementId },
      data: { status: 'VERIFIED', verifiedByPersonId: verifierPersonId, verifiedAt: new Date() },
    });
  }

  /**
   * Zatwierdzenie warunków bezpieczeństwa wyczynu (§12.2): hufcowy albo
   * komendant obozu; zwolnienie rozkazem dla drużynowego ≥ phm.
   * Wycofanie się harcerza z wyczynu — dozwolona, nieoceniająca akcja.
   */
  async approveFeat(requirementId: string, approverPersonId: string) {
    return this.prisma.progressionRequirement.update({
      where: { id: requirementId },
      data: { featApprovedByPersonId: approverPersonId },
    });
  }

  async withdrawFromFeat(requirementId: string) {
    return this.prisma.progressionRequirement.update({
      where: { id: requirementId },
      data: { status: 'PENDING', evidence: undefined, featApprovedByPersonId: null },
    });
  }

  /**
   * Przejście stanu karty — waliduje maszynę stanów per (kind, branch)
   * i wymóg pozycji w rozkazie (§12.1).
   */
  async transition(
    instanceId: string,
    to: ProgressionStatus,
    opts: { orderItemId?: string; retryBlockedUntil?: Date } = {},
  ) {
    const instance = await this.get(instanceId);
    if (
      !canTransitionProgression(
        instance.kind as ProgressionKind,
        instance.branch,
        instance.status as ProgressionStatus,
        to,
      )
    ) {
      throw new ConflictException({
        code: 'INVALID_PROGRESSION_TRANSITION',
        from: instance.status,
        to,
      });
    }
    if (
      transitionRequiresOrderItem(instance.kind as ProgressionKind, instance.branch, to) &&
      !opts.orderItemId
    ) {
      throw new UnprocessableEntityException({ code: 'ORDER_ITEM_REQUIRED', transition: to });
    }
    return this.prisma.progressionInstance.update({
      where: { id: instanceId },
      data: {
        status: to,
        ...(to === 'OPEN' && opts.orderItemId && { openedByOrderItemId: opts.orderItemId }),
        ...((to === 'CLOSED_POSITIVE' || to === 'CLOSED_NEGATIVE' || to === 'DISCONTINUED') &&
          opts.orderItemId && { closedByOrderItemId: opts.orderItemId }),
        ...(to === 'AWARDED' && opts.orderItemId && { awardedByOrderItemId: opts.orderItemId }),
        ...(to === 'CLOSED_NEGATIVE' &&
          opts.retryBlockedUntil && { retryBlockedUntil: opts.retryBlockedUntil }),
      },
    });
  }

  /** Widok drużynowego: kolejka "Do zatwierdzenia" (§12.5). */
  pendingForUnit(unitId: string) {
    return this.prisma.progressionRequirement.findMany({
      where: { status: 'SUBMITTED', instance: { unitId } },
      include: { instance: { select: { personId: true, targetCode: true, kind: true } } },
      orderBy: { submittedAt: 'asc' },
    });
  }

  /** Karty osoby (widok harcerza, §12.5). */
  forPerson(personId: string) {
    return this.prisma.progressionInstance.findMany({
      where: { personId },
      include: { requirements: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  /** Archiwizacja osoby → wszystkie karty w toku ABANDONED (§8.3). */
  async abandonAllFor(personId: string): Promise<void> {
    await this.prisma.progressionInstance.updateMany({
      where: { personId, status: { in: ['DRAFT', 'OPEN'] } },
      data: { status: 'ABANDONED' },
    });
  }
}
