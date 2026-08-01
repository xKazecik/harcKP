/**
 * Modele odczytu dla warstwy webowej (§12.5, §16.3).
 *
 * Kontroler celowo obsługuje WYŁĄCZNIE odczyt: agreguje dane, które UI
 * potrzebuje w jednym żądaniu (kontekst jednostki, lista członków z wyliczonym
 * wiekiem, dashboard). Wszystkie mutacje pozostają w kontrolerach domenowych,
 * które przechodzą przez use case'y i AuthorizationService.
 *
 * @remarks Zapytania odczytowe idą wprost przez Prismę — tak jak w
 * AdminController — bo nie zawierają reguł domenowych. Reguła, która musi być
 * spójna (wiek, zgoda opiekuna, nazwa jednostki), pochodzi z @harc/domain.
 */
import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import {
  ageAt,
  guardianConsentStatus,
  normalizeUnitLevel,
  unitDisplayName,
  type Branch,
  type UnitType,
} from '@harc/domain';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';

/** Minimalny kształt jednostki potrzebny do wygenerowania nazwy (§6.2). */
interface NameableUnit {
  type: string;
  branch: string;
  number: string | null;
  localityName: string;
  properName: string | null;
  patron: string | null;
}

function displayName(u: NameableUnit): string {
  return unitDisplayName({
    type: u.type as UnitType,
    branch: u.branch as Branch,
    number: u.number,
    localityName: u.localityName,
    properName: u.properName,
    patron: u.patron,
  });
}

/** Wiek liczony na dziś; null gdy brak daty urodzenia (§17 — minimalizacja). */
function age(birthDate: Date | null): number | null {
  return birthDate ? ageAt(birthDate, new Date()) : null;
}

@Controller('directory')
export class DirectoryController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tożsamość zalogowanego użytkownika: profil, funkcje, jednostki do
   * przełącznika kontekstu (§16.3).
   *
   * @param sub - `keycloakUserId` z claimu tokenu; `username` to UUID osoby (§9.3)
   * @returns Profil z listą jednostek albo `{ person: null }` dla konta bez profilu
   */
  @Get('me')
  async me(@Query('sub') sub?: string) {
    if (!sub) return { person: null, units: [], leaderships: [] };

    const person = await this.prisma.person.findFirst({
      where: { OR: [{ keycloakUserId: sub }, { id: sub }] },
      include: { instructorProfile: true },
    });
    if (!person) return { person: null, units: [], leaderships: [] };

    const now = new Date();
    const [leaderships, memberships, sysadmin] = await Promise.all([
      this.prisma.unitLeadership.findMany({
        where: { personId: person.id, OR: [{ validTo: null }, { validTo: { gt: now } }] },
      }),
      this.prisma.unitMembership.findMany({
        where: { personId: person.id, OR: [{ validTo: null }, { validTo: { gt: now } }] },
      }),
      this.prisma.adminGrant.findFirst({
        where: { personId: person.id, role: 'SYSADMIN', revokedAt: null },
      }),
    ]);

    const unitIds = [
      ...new Set([
        ...leaderships.map((l) => l.unitId),
        ...memberships.map((m) => m.unitId),
        ...(person.invitedToUnitId ? [person.invitedToUnitId] : []),
      ]),
    ];
    const units = await this.prisma.unit.findMany({ where: { id: { in: unitIds } } });

    return {
      person: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        branch: person.branch,
        status: person.status,
        membershipCategory: person.membershipCategory,
        themePreference: person.themePreference,
        instructorRank: person.instructorProfile?.rank ?? null,
      },
      isSysadmin: Boolean(sysadmin),
      units: units.map((u) => ({
        id: u.id,
        type: u.type,
        branch: u.branch,
        displayName: displayName(u),
        isLeader: leaderships.some((l) => l.unitId === u.id),
        isActing: leaderships.find((l) => l.unitId === u.id)?.isActing ?? false,
      })),
      leaderships: leaderships.map((l) => ({
        unitId: l.unitId,
        isActing: l.isActing,
        guardianInstructorId: l.guardianInstructorId,
      })),
    };
  }

  /** Płaska lista jednostek — przełącznik kontekstu i drzewo w UI. */
  @Get('units')
  async units(@Query('branch') branch?: string, @Query('type') type?: string) {
    const rows = await this.prisma.unit.findMany({
      where: {
        ...(branch && { branch: branch as never }),
        ...(type && { type: type as never }),
      },
      orderBy: [{ type: 'asc' }, { localityName: 'asc' }],
    });
    return rows.map((u) => ({
      id: u.id,
      type: u.type,
      branch: u.branch,
      parentId: u.parentId,
      status: u.status,
      displayName: displayName(u),
      isPubliclyVisible: u.isPubliclyVisible,
    }));
  }

  /**
   * Kontekst jednostki: pełna ścieżka w hierarchii do breadcrumbu (§16.3),
   * dzieci, kadra i liczniki dashboardu.
   *
   * @throws NotFoundException gdy jednostka nie istnieje
   */
  @Get('units/:id/context')
  async unitContext(@Param('id') id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Jednostka nie istnieje');

    // Ścieżka od korzenia — breadcrumb pokazuje pełną hierarchię (§16.3).
    const path: Array<{ id: string; displayName: string; type: string }> = [];
    let cursor: string | null = unit.parentId;
    while (cursor) {
      const parent = await this.prisma.unit.findUnique({ where: { id: cursor } });
      if (!parent) break;
      path.unshift({ id: parent.id, displayName: displayName(parent), type: parent.type });
      cursor = parent.parentId;
    }

    const now = new Date();
    const [children, memberships, leaderships, orders, plans, pendingReq] = await Promise.all([
      this.prisma.unit.findMany({ where: { parentId: id }, orderBy: { localityName: 'asc' } }),
      this.prisma.unitMembership.findMany({
        where: { unitId: id, OR: [{ validTo: null }, { validTo: { gt: now } }] },
        include: { person: true },
      }),
      this.prisma.unitLeadership.findMany({
        where: { unitId: id, OR: [{ validTo: null }, { validTo: { gt: now } }] },
        include: { person: true },
      }),
      this.prisma.order.count({ where: { unitId: id } }),
      this.prisma.workPlan.findMany({ where: { unitId: id }, orderBy: { scoutingYear: 'desc' } }),
      this.prisma.progressionRequirement.count({
        where: { status: 'SUBMITTED', instance: { unitId: id } },
      }),
    ]);

    const active = memberships.filter((m) => m.person.status !== 'ARCHIVED');
    const ages = active.map((m) => age(m.person.birthDate)).filter((a): a is number => a != null);

    return {
      unit: {
        ...unit,
        displayName: displayName(unit),
        level: normalizeUnitLevel(unit.type as UnitType),
      },
      path,
      children: children.map((c) => ({
        id: c.id,
        type: c.type,
        branch: c.branch,
        status: c.status,
        displayName: displayName(c),
      })),
      leadership: leaderships.map((l) => ({
        personId: l.personId,
        fullName: `${l.person.firstName} ${l.person.lastName}`,
        isActing: l.isActing,
        guardianInstructorId: l.guardianInstructorId,
      })),
      stats: {
        members: active.length,
        participants: active.filter((m) => m.person.membershipCategory === 'UCZESTNIK').length,
        instructors: active.filter((m) => m.person.membershipCategory === 'INSTRUKTOR').length,
        seniorScouts: active.filter((m) => m.person.membershipCategory === 'HARCERZ_STARSZY').length,
        childUnits: children.length,
        orders,
        pendingRequirements: pendingReq,
        averageAge: ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null,
        workPlanStatus: plans[0]?.status ?? null,
        workPlanYear: plans[0]?.scoutingYear ?? null,
      },
    };
  }

  /**
   * Lista członków jednostki dla widoku drużynowego (§12.5): wiek, stopień,
   * sprawności, status karty, Przyrzeczenie, zastęp, przypomnienie o zgodzie.
   *
   * @remarks `birthDate` jest tu zwracane celowo — widok drużynowego wymaga
   * uprawnienia VIEW_PERSONAL_DATA (§17). Widoki zagregowane wyższych szczebli
   * korzystają z `age`, nigdy z daty.
   */
  @Get('units/:id/members')
  async members(@Param('id') id: string, @Query('q') q?: string) {
    const now = new Date();
    const memberships = await this.prisma.unitMembership.findMany({
      where: { unitId: id, OR: [{ validTo: null }, { validTo: { gt: now } }] },
      include: { person: { include: { guardians: true, instructorProfile: true } } },
    });

    const personIds = memberships.map((m) => m.personId);
    const [instances, zastepRows] = await Promise.all([
      this.prisma.progressionInstance.findMany({ where: { personId: { in: personIds } } }),
      this.prisma.zastepMembership.findMany({
        where: { personId: { in: personIds }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
        include: { zastep: true },
      }),
    ]);

    const rows = memberships
      .filter((m) => m.person.status !== 'ARCHIVED')
      .map((m) => {
        const p = m.person;
        const mine = instances.filter((i) => i.personId === p.id);
        const awardedRank = mine
          .filter((i) => i.kind === 'RANK' && i.status === 'AWARDED')
          .at(-1)?.targetCode ?? null;
        const openCard = mine.find((i) => i.kind === 'RANK' && ['DRAFT', 'OPEN'].includes(i.status));
        return {
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          status: p.status,
          branch: p.branch,
          membershipCategory: p.membershipCategory,
          birthDate: p.birthDate,
          age: age(p.birthDate),
          school: p.school,
          phone: p.phone,
          crossNumber: p.crossNumber,
          promiseDate: p.promiseDate,
          rank: awardedRank,
          instructorRank: p.instructorProfile?.rank ?? null,
          openCard: openCard ? { id: openCard.id, targetCode: openCard.targetCode, status: openCard.status } : null,
          badges: mine.filter((i) => i.kind === 'BADGE' && i.status === 'AWARDED').length,
          zastep: zastepRows.find((z) => z.personId === p.id)?.zastep.name ?? null,
          // Przypomnienie, nie blokada — decyzja zamawiającego 2026-07-31.
          guardianConsent: guardianConsentStatus(
            p.birthDate,
            p.guardians.map((g) => ({ consentGivenAt: g.consentGivenAt })),
            now,
          ),
        };
      })
      .filter((r) => {
        if (!q) return true;
        const needle = q.toLowerCase();
        return `${r.firstName} ${r.lastName}`.toLowerCase().includes(needle);
      });

    rows.sort((a, b) => a.lastName.localeCompare(b.lastName, 'pl'));
    return rows;
  }

  /**
   * Lista instruktorów z filtrami panelu komendanta chorągwi (§12.5).
   *
   * @param choragiewId - ogranicza do przynależności do wskazanej chorągwi
   */
  @Get('instructors')
  async instructors(
    @Query('choragiewId') choragiewId?: string,
    @Query('listType') listType?: string,
    @Query('rank') rank?: string,
  ) {
    const now = new Date();
    const rows = await this.prisma.instructorProfile.findMany({
      where: {
        ...(choragiewId && { homeChoragiewId: choragiewId }),
        ...(listType && { listType: listType as never }),
        ...(rank && { rank: rank as never }),
      },
      include: { person: true },
    });

    return rows
      .filter((r) => r.person.status !== 'ARCHIVED')
      .map((r) => ({
        personId: r.personId,
        firstName: r.person.firstName,
        lastName: r.person.lastName,
        branch: r.person.branch,
        email: r.person.email,
        rank: r.rank,
        rankAwardedAt: r.rankAwardedAt,
        listType: r.listType,
        homeChoragiewId: r.homeChoragiewId,
        mainAssignmentLevel: r.mainAssignmentLevel,
        mainAssignmentUnitId: r.mainAssignmentUnitId,
        onLeaveUntil: r.onLeaveUntil,
        // §17: przechowujemy wyłącznie daty weryfikacji, nigdy treści zaświadczeń.
        minorProtectionValidUntil: r.minorProtectionValidUntil,
        minorProtectionValid:
          r.minorProtectionValidUntil != null &&
          r.minorProtectionValidUntil > now &&
          r.standardsAcknowledgedAt != null,
        standardsAcknowledgedAt: r.standardsAcknowledgedAt,
        instructorPledgeDate: r.person.instructorPledgeDate,
      }));
  }

  /**
   * Pełny profil osoby: dane, opiekunowie, funkcje, karty progresji i oś czasu
   * osobistego dziennika zdarzeń (§12.5).
   *
   * @throws NotFoundException gdy osoba nie istnieje
   */
  @Get('persons/:id')
  async person(@Param('id') id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: { guardians: true, instructorProfile: true },
    });
    if (!person) throw new NotFoundException('Osoba nie istnieje');

    const [memberships, leaderships, instances, events, invitation] = await Promise.all([
      this.prisma.unitMembership.findMany({ where: { personId: id }, include: { unit: true } }),
      this.prisma.unitLeadership.findMany({ where: { personId: id }, include: { unit: true } }),
      this.prisma.progressionInstance.findMany({
        where: { personId: id },
        include: { requirements: true },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.personalEventLog.findMany({
        where: { personId: id },
        orderBy: { occurredAt: 'desc' },
        take: 100,
      }),
      this.prisma.invitation.findFirst({
        where: { personId: id, usedAt: null, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      person: {
        ...person,
        age: age(person.birthDate),
        guardianConsent: guardianConsentStatus(
          person.birthDate,
          person.guardians.map((g) => ({ consentGivenAt: g.consentGivenAt })),
          new Date(),
        ),
      },
      memberships: memberships.map((m) => ({
        unitId: m.unitId,
        unitName: displayName(m.unit),
        validFrom: m.validFrom,
        validTo: m.validTo,
      })),
      leaderships: leaderships.map((l) => ({
        unitId: l.unitId,
        unitName: displayName(l.unit),
        isActing: l.isActing,
        validFrom: l.validFrom,
        validTo: l.validTo,
      })),
      progression: instances.map((i) => ({
        id: i.id,
        kind: i.kind,
        targetCode: i.targetCode,
        status: i.status,
        startedAt: i.startedAt,
        deadline: i.deadline,
        total: i.requirements.length,
        verified: i.requirements.filter((r) => r.status === 'VERIFIED').length,
        submitted: i.requirements.filter((r) => r.status === 'SUBMITTED').length,
      })),
      events,
      pendingInvitation: invitation
        ? { id: invitation.id, expiresAt: invitation.expiresAt, lastSentAt: invitation.lastSentAt }
        : null,
    };
  }

  /** Karta progresji ze wszystkimi wymaganiami — widok harcerza i drużynowego. */
  @Get('progression/:id')
  async progressionCard(@Param('id') id: string) {
    const instance = await this.prisma.progressionInstance.findUnique({
      where: { id },
      include: { requirements: { orderBy: { code: 'asc' } } },
    });
    if (!instance) throw new NotFoundException('Karta nie istnieje');
    const person = await this.prisma.person.findUnique({ where: { id: instance.personId } });
    return {
      instance,
      person: person ? { id: person.id, firstName: person.firstName, lastName: person.lastName } : null,
    };
  }

  /**
   * Dashboard globalny — liczby dla widoku startowego, bez danych osobowych.
   *
   * @remarks §17: widoki zagregowane wyższych szczebli operują wyłącznie na
   * licznikach; imion i dat urodzenia tu nie ma.
   */
  @Get('overview')
  async overview() {
    const now = new Date();
    const [units, people, instructors, orders, pendingInvitations, pendingReq, openCases, publicUnits] =
      await Promise.all([
        this.prisma.unit.groupBy({ by: ['type'], _count: true }),
        this.prisma.person.groupBy({ by: ['membershipCategory'], _count: true, where: { status: { in: ['INVITED', 'ACTIVE'] } } }),
        this.prisma.instructorProfile.groupBy({ by: ['rank'], _count: true }),
        this.prisma.order.count(),
        this.prisma.invitation.count({ where: { usedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
        this.prisma.progressionRequirement.count({ where: { status: 'SUBMITTED' } }),
        this.prisma.disciplinaryCase.count({ where: { status: { notIn: ['FINAL', 'EXPIRED'] } } }),
        this.prisma.unit.count({ where: { isPubliclyVisible: true } }),
      ]);

    return {
      unitsByType: Object.fromEntries(units.map((u) => [u.type, u._count])),
      totalUnits: units.reduce((a, u) => a + u._count, 0),
      peopleByCategory: Object.fromEntries(people.map((p) => [p.membershipCategory, p._count])),
      totalPeople: people.reduce((a, p) => a + p._count, 0),
      instructorsByRank: Object.fromEntries(instructors.map((i) => [i.rank, i._count])),
      totalInstructors: instructors.reduce((a, i) => a + i._count, 0),
      orders,
      pendingInvitations,
      pendingRequirements: pendingReq,
      openDisciplinaryCases: openCases,
      publicUnits,
    };
  }

  /** Słowniki wersjonowane — nazwy stopni i sprawności do etykiet w UI (§2). */
  @Get('dictionary/:key')
  async dictionary(@Param('key') key: string) {
    const now = new Date();
    const entries = await this.prisma.dictionaryEntry.findMany({
      where: {
        dictionaryKey: key,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
    });
    // Najwyższa obowiązująca wersja per kod.
    const byCode = new Map<string, (typeof entries)[number]>();
    for (const e of entries) if (!byCode.has(e.code)) byCode.set(e.code, e);
    return [...byCode.values()];
  }
}
