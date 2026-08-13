import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ListType } from '@harc/db';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { PdfService } from '../../infrastructure/storage/pdf.service.js';
import { S3StorageService } from '../../infrastructure/storage/s3-storage.service.js';

/**
 * §13 — TRZY ODRĘBNE PROCESY o różnych cyklach. Celowo trzy serwisy;
 * nie łączyć w jeden formularz (§21).
 */

/** Spis instruktorski — rok kalendarzowy (§13.1). */
@Injectable()
export class InstructorCensusService {
  constructor(private readonly prisma: PrismaService) {}

  /** Harmonogram konfigurowalny; domyślnie: ogłoszenie 31.10, otwarcie 1.11,
   * deklaracje do 30.11, decyzje do 31.12. */
  async openCampaign(year: number, overrides?: Partial<{ opensAt: Date; declarationDeadline: Date; decisionDeadline: Date }>) {
    return this.prisma.censusCampaign.upsert({
      where: { kind_year: { kind: 'INSTRUCTORS', year } },
      update: {},
      create: {
        kind: 'INSTRUCTORS',
        year,
        announcedAt: new Date(),
        opensAt: overrides?.opensAt ?? new Date(`${year}-11-01`),
        declarationDeadline: overrides?.declarationDeadline ?? new Date(`${year}-11-30`),
        decisionDeadline: overrides?.decisionDeadline ?? new Date(`${year}-12-31`),
      },
    });
  }

  /** Deklaracja instruktora: przydział, wniosek, boolean składek (bez kwot, §1.2). */
  async submitDeclaration(campaignId: string, personId: string, data: {
    declaredListType: ListType;
    requestedAction: 'ENROLL' | 'LEAVE' | 'END_SERVICE';
    declaredAssignment?: Record<string, unknown>;
    feePaidConfirmed: boolean;
  }) {
    const profile = await this.prisma.instructorProfile.findUnique({ where: { personId } });
    // Urlop instruktorski zawiesza wymagalność spisu i deklarację składkową (§7.3).
    if (profile?.onLeaveUntil && profile.onLeaveUntil > new Date()) {
      throw new ConflictException({ code: 'CENSUS_SUSPENDED_ON_LEAVE' });
    }
    return this.prisma.instructorCensusEntry.upsert({
      where: { campaignId_personId: { campaignId, personId } },
      update: { ...data, declaredAssignment: data.declaredAssignment as object, submittedAt: new Date() },
      create: {
        campaignId,
        personId,
        ...data,
        declaredAssignment: data.declaredAssignment as object,
        submittedAt: new Date(),
      },
    });
  }

  async decide(campaignId: string, personId: string, deciderPersonId: string, listType: ListType) {
    return this.prisma.instructorCensusEntry.update({
      where: { campaignId_personId: { campaignId, personId } },
      data: { decidedByPersonId: deciderPersonId, decidedAt: new Date(), decisionListType: listType },
    });
  }

  /**
   * Stany WYLICZANE (automaty §13.1), nie ręczna interwencja:
   * - brak wniosku po terminie → wpisany na listę WSPIERAJĄCYCH do czasu decyzji;
   * - brak decyzji po terminie → wpisany ZGODNIE Z WNIOSKIEM.
   */
  async computedStatus(campaignId: string, personId: string): Promise<{ effectiveListType: ListType; source: string }> {
    const campaign = await this.prisma.censusCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Kampania nie istnieje');
    const entry = await this.prisma.instructorCensusEntry.findUnique({
      where: { campaignId_personId: { campaignId, personId } },
    });
    const now = new Date();
    if (entry?.decisionListType) return { effectiveListType: entry.decisionListType, source: 'DECISION' };
    if (!entry?.submittedAt) {
      return now > campaign.declarationDeadline
        ? { effectiveListType: 'WSPIERAJACY', source: 'AUTO_NO_DECLARATION' }
        : { effectiveListType: 'WSPIERAJACY', source: 'PENDING' };
    }
    if (now > campaign.decisionDeadline && entry.declaredListType) {
      return { effectiveListType: entry.declaredListType, source: 'AUTO_NO_DECISION' };
    }
    return { effectiveListType: entry.declaredListType ?? 'WSPIERAJACY', source: 'PENDING_DECISION' };
  }
}

/** Spis jednostek — stan na 31.12, rola Komisarza Spisowego (§13.2). */
@Injectable()
export class UnitCensusService {
  constructor(private readonly prisma: PrismaService) {}

  async openCampaign(year: number) {
    return this.prisma.censusCampaign.upsert({
      where: { kind_year: { kind: 'UNITS', year } },
      update: {},
      create: {
        kind: 'UNITS',
        year,
        opensAt: new Date(`${year}-12-01`),
        declarationDeadline: new Date(`${year + 1}-01-31`),
        decisionDeadline: new Date(`${year + 1}-02-28`),
      },
    });
  }

  async submit(campaignId: string, unitId: string, byPersonId: string, data: {
    headcount: Record<string, number>;
    cardConfirmed: boolean;
    membersConfirmed: boolean;
  }) {
    return this.prisma.unitCensusEntry.upsert({
      where: { campaignId_unitId: { campaignId, unitId } },
      update: { ...data, headcount: data.headcount as object, submittedByPersonId: byPersonId, submittedAt: new Date() },
      create: {
        campaignId,
        unitId,
        ...data,
        headcount: data.headcount as object,
        submittedByPersonId: byPersonId,
        submittedAt: new Date(),
      },
    });
  }

  /**
   * Import CSV z mapowaniem kolumn i raportem rozbieżności (§13.2 —
   * integracja, nie duplikacja; CENSUS_SOURCE_OF_TRUTH w konfiguracji).
   */
  async importCsv(campaignId: string, rows: Array<Record<string, string>>, mapping: { unitId: string; headcountColumns: Record<string, string> }) {
    const discrepancies: Array<{ unitId: string; field: string; internal: number; external: number }> = [];
    for (const row of rows) {
      const unitId = row[mapping.unitId];
      if (!unitId) continue;
      const existing = await this.prisma.unitCensusEntry.findUnique({
        where: { campaignId_unitId: { campaignId, unitId } },
      });
      const external: Record<string, number> = {};
      for (const [field, col] of Object.entries(mapping.headcountColumns)) {
        external[field] = Number(row[col] ?? 0);
      }
      if (existing) {
        const internal = existing.headcount as Record<string, number>;
        for (const [field, extVal] of Object.entries(external)) {
          if ((internal[field] ?? 0) !== extVal) {
            discrepancies.push({ unitId, field, internal: internal[field] ?? 0, external: extVal });
          }
        }
      }
    }
    return { imported: rows.length, discrepancies };
  }
}

/** Plan pracy — rok harcerski 1.09–31.08 (§13.3). */
@Injectable()
export class WorkPlanService {
  private readonly logger = new Logger(WorkPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: S3StorageService,
  ) {}

  async upsertDraft(unitId: string, scoutingYear: string, content: Record<string, unknown>) {
    const existing = await this.prisma.workPlan.findUnique({
      where: { unitId_scoutingYear: { unitId, scoutingYear } },
    });
    if (existing && !['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(existing.status)) {
      throw new ConflictException({ code: 'WORK_PLAN_NOT_EDITABLE', status: existing.status });
    }
    return this.prisma.workPlan.upsert({
      where: { unitId_scoutingYear: { unitId, scoutingYear } },
      update: { content: content as object },
      create: { unitId, scoutingYear, content: content as object },
    });
  }

  async submit(unitId: string, scoutingYear: string) {
    return this.transition(unitId, scoutingYear, ['DRAFT', 'RETURNED_FOR_CORRECTION'], 'SUBMITTED');
  }

  /** Zatwierdzający z hierarchii — dla drużyny hufcowy; autoryzacja w kontrolerze. */
  async decide(unitId: string, scoutingYear: string, deciderPersonId: string, decision: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION', notes?: string) {
    const plan = await this.transition(unitId, scoutingYear, ['SUBMITTED'], decision, deciderPersonId, notes);
    if (decision === 'APPROVED') {
      await this.storeApprovedPdf(unitId, scoutingYear, deciderPersonId);
      return this.prisma.workPlan.findUnique({
        where: { unitId_scoutingYear: { unitId, scoutingYear } },
      });
    }
    return plan;
  }

  /**
   * Materializuje zatwierdzony plan pracy do niezmienialnego PDF-u w S3 (§13.3).
   *
   * @param unitId - jednostka planu
   * @param scoutingYear - rok harcerski, np. `2026/2027`
   * @param deciderPersonId - osoba zatwierdzająca, trafia do stopki dokumentu
   * @remarks Snapshot powstaje w momencie zatwierdzenia i celowo NIE jest
   * odświeżany przy późniejszych edycjach treści — zatwierdzona wersja ma
   * pozostać niezmienna. Błąd zapisu nie cofa zatwierdzenia; plan jest
   * zatwierdzony decyzją przełożonego, a brak kopii to usterka do ponowienia.
   */
  private async storeApprovedPdf(
    unitId: string,
    scoutingYear: string,
    deciderPersonId: string,
  ): Promise<void> {
    try {
      const plan = await this.prisma.workPlan.findUnique({
        where: { unitId_scoutingYear: { unitId, scoutingYear } },
      });
      if (!plan || plan.pdfStorageKey) return;

      // WorkPlan nie ma relacji do Unit — tylko skalarne unitId.
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { localityName: true },
      });

      const content = (plan.content ?? {}) as Record<string, unknown>;
      const asLines = (value: unknown): string[] => {
        if (Array.isArray(value)) return value.map((v) => `• ${String(v)}`);
        if (value == null || value === '') return ['—'];
        return String(value).split('\n');
      };

      const pdf = await this.pdf.render({
        title: `Plan pracy ${scoutingYear}`,
        subtitle: unit?.localityName ?? unitId,
        blocks: [
          { heading: 'Cele', lines: asLines(content.goals) },
          { heading: 'Kalendarium', lines: asLines(content.calendar) },
          { heading: 'Planowany obóz', lines: asLines(content.camp) },
          { heading: 'Pole służby', lines: asLines(content.service) },
          { heading: 'Deklarowana kategoria', lines: asLines(content.declaredCategory) },
        ],
        footer:
          `Zatwierdzono ${new Date().toISOString().slice(0, 10)} przez ${deciderPersonId}. ` +
          'Kopia niezmienialna — późniejsze edycje treści nie zmieniają tego dokumentu (§13.3).',
      });

      const key = `work-plans/${scoutingYear.replace('/', '-')}/${unitId}.pdf`;
      await this.storage.put(key, pdf, 'application/pdf');
      await this.prisma.workPlan.update({
        where: { unitId_scoutingYear: { unitId, scoutingYear } },
        data: { pdfStorageKey: key },
      });
    } catch (err) {
      this.logger.error(
        `Nie udało się zapisać PDF planu pracy ${unitId}/${scoutingYear}: ${String(err)}. ` +
          'Plan pozostaje zatwierdzony.',
      );
    }
  }

  private async transition(unitId: string, scoutingYear: string, allowedFrom: string[], to: string, deciderPersonId?: string, notes?: string) {
    const plan = await this.prisma.workPlan.findUnique({
      where: { unitId_scoutingYear: { unitId, scoutingYear } },
    });
    if (!plan) throw new NotFoundException('Plan pracy nie istnieje');
    if (!allowedFrom.includes(plan.status)) {
      throw new ConflictException({ code: 'WORK_PLAN_INVALID_TRANSITION', from: plan.status, to });
    }
    return this.prisma.workPlan.update({
      where: { unitId_scoutingYear: { unitId, scoutingYear } },
      data: {
        status: to as never,
        ...(to === 'SUBMITTED' && { submittedAt: new Date() }),
        ...(deciderPersonId && { decidedByPersonId: deciderPersonId, decidedAt: new Date() }),
        ...(notes !== undefined && { returnNotes: notes }),
      },
    });
  }
}

/** Kategoryzacja drużyn — cykl roku harcerskiego (§13.4). */
@Injectable()
export class CategorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Arkusz wypełniany NA BIEŻĄCO przez drużynowego. */
  async upsertSheet(unitId: string, scoutingYear: string, data: {
    declaredCategory: 'POLOWA' | 'LESNA' | 'PUSZCZANSKA';
    answers: Record<string, unknown>;
  }) {
    const now = new Date();
    const requirementSet = await this.prisma.dictionaryEntry.findFirst({
      where: {
        dictionaryKey: 'categorization_sheets',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { version: 'desc' },
    });
    return this.prisma.categorizationSheet.upsert({
      where: { unitId_scoutingYear: { unitId, scoutingYear } },
      update: { declaredCategory: data.declaredCategory, answers: data.answers as object },
      create: {
        unitId,
        scoutingYear,
        requirementSetVersionId: requirementSet?.id ?? 'MISSING_SHEET_DICTIONARY',
        declaredCategory: data.declaredCategory,
        answers: data.answers as object,
      },
    });
  }

  async recordVisit(unitId: string, scoutingYear: string, visitNotes: string) {
    return this.prisma.categorizationSheet.update({
      where: { unitId_scoutingYear: { unitId, scoutingYear } },
      data: { visitNotes },
    });
  }

  /** Przyznanie rozkazem: hufcowy (polowa) / komendant chorągwi (leśna) /
   * Naczelnik (puszczańska) — kompetencja z macierzy (AWARD_CATEGORY). */
  async award(unitId: string, scoutingYear: string, category: string, orderItemId: string) {
    const sheet = await this.prisma.categorizationSheet.update({
      where: { unitId_scoutingYear: { unitId, scoutingYear } },
      data: { awardedCategory: category, awardedByOrderItemId: orderItemId },
    });
    const entry = await this.prisma.dictionaryEntry.findFirst({
      where: { dictionaryKey: 'unit_categories', code: category },
      orderBy: { version: 'desc' },
    });
    await this.prisma.unit.update({ where: { id: unitId }, data: { categoryId: entry?.id ?? null } });
    return sheet;
  }
}
