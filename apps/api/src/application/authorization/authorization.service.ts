import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  authorize,
  type ActorContext,
  type CompetenceRow,
  type Decision,
  type ResourceContext,
  type UnitType,
} from '@harc/domain';
import { ageAt } from '@harc/domain';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * AuthorizationService (§10) — buduje konteksty z bazy i deleguje decyzję
 * do czystej funkcji domenowej authorize().
 *
 * Macierz kompetencji jest DANYMI (tabela Competence, seed §2) — cache 60 s.
 * Root pochodzi WYŁĄCZNIE z claimu groups Keycloak (§9.4), przekazywanego
 * przez guard; nigdy z adresu e-mail.
 */
@Injectable()
export class AuthorizationService {
  private matrixCache: { rows: CompetenceRow[]; loadedAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async getMatrix(): Promise<CompetenceRow[]> {
    if (this.matrixCache && Date.now() - this.matrixCache.loadedAt < 60_000) {
      return this.matrixCache.rows;
    }
    const now = new Date();
    const rows = await this.prisma.competence.findMany({
      where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
    });
    const mapped: CompetenceRow[] = rows.map((r) => ({
      action: r.action,
      holderLevel: r.holderLevel,
      branch: r.branch,
      targetScope: r.targetScope as CompetenceRow['targetScope'],
      targetTypes: r.targetTypes as UnitType[],
      requiresAdult: r.requiresAdult,
      requiresMinorProtection: r.requiresMinorProtection,
      minimumInstructorRank: r.minimumInstructorRank,
      delegable: r.delegable,
      legalBasis: r.legalBasis,
    }));
    this.matrixCache = { rows: mapped, loadedAt: Date.now() };
    return mapped;
  }

  async buildActorContext(personId: string, isRoot: boolean): Promise<ActorContext> {
    const now = new Date();
    const [person, profile, leaderships, delegations, sysadmin] = await Promise.all([
      this.prisma.person.findUnique({ where: { id: personId } }),
      this.prisma.instructorProfile.findUnique({ where: { personId } }),
      // Tylko funkcja LEADER daje kompetencje z urzędu. Kwatermistrz, v-ce
      // hufcowy czy przyboczny są funkcjami ewidencyjnymi — uprawnienia
      // techniczne dostają wyłącznie przez jawną delegację (§10.4), bo „sama
      // nazwa funkcji nie daje uprawnień". Bez tego filtra każde mianowanie
      // byłoby cichym nadaniem władzy komendanta jednostki.
      this.prisma.unitLeadership.findMany({
        where: { personId, roleKey: 'LEADER', OR: [{ validTo: null }, { validTo: { gt: now } }] },
      }),
      this.prisma.delegationGrant.findMany({
        where: { toPersonId: personId, revokedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.adminGrant.findFirst({
        where: { personId, role: 'SYSADMIN', revokedAt: null },
      }),
    ]);
    const ledUnitIds = leaderships.map((l) => l.unitId);
    const [units, substitutions] = await Promise.all([
      this.prisma.unit.findMany({ where: { id: { in: ledUnitIds } } }),
      this.prisma.substitutionGrant.findMany({
        where: {
          grantorUnitId: { in: ledUnitIds },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
      }),
    ]);
    return {
      personId,
      isAdult: person?.birthDate ? ageAt(person.birthDate, now) >= 18 : false,
      minorProtectionValid:
        (profile?.minorProtectionValidUntil ?? new Date(0)) > now &&
        profile?.standardsAcknowledgedAt != null,
      instructorRank: profile?.rank ?? null,
      ledUnits: leaderships.map((l) => {
        const u = units.find((x) => x.id === l.unitId);
        return {
          unitId: l.unitId,
          unitType: (u?.type ?? 'DRUZYNA') as UnitType,
          branch: (u?.branch ?? 'HARCERZE') as ActorContext['ledUnits'][0]['branch'],
          isActing: l.isActing,
        };
      }),
      delegations: delegations.map((d) => ({ action: d.action, unitId: d.unitId })),
      substitutions: substitutions.map((s) => ({
        grantorUnitId: s.grantorUnitId,
        targetUnitId: s.targetUnitId,
      })),
      isSysadmin: Boolean(sysadmin),
      isRoot,
    };
  }

  async buildResourceContext(unitId: string): Promise<ResourceContext> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new ForbiddenException({ code: 'RESOURCE_NOT_FOUND' });
    const ancestors: string[] = [];
    let cursor = unit.parentId;
    while (cursor) {
      ancestors.push(cursor);
      const parent = await this.prisma.unit.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
    return {
      unitId: unit.id,
      unitType: unit.type,
      branch: unit.branch,
      parentId: unit.parentId,
      ancestorIds: ancestors,
    };
  }

  /**
   * Decyzja + wpis do audit logu przy odmowie akcji wrażliwych.
   * @throws ForbiddenException gdy decyzja negatywna
   */
  async require(personId: string, isRoot: boolean, action: string, unitId: string): Promise<Decision> {
    const [actor, resource, matrix] = await Promise.all([
      this.buildActorContext(personId, isRoot),
      this.buildResourceContext(unitId),
      this.getMatrix(),
    ]);
    const decision = authorize(actor, action, resource, matrix);
    if (!decision.allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', action, reason: decision.reason });
    }
    if (decision.pendingApproval) {
      // Kontrasygnata opiekuna (§7.4): zapis PendingApproval robi use case akcji.
    }
    return decision;
  }

  /** Widok "uprawnienia efektywne" (§18): skąd wynika każde uprawnienie. */
  async effectivePermissions(personId: string, isRoot: boolean, unitId: string) {
    const [actor, resource, matrix] = await Promise.all([
      this.buildActorContext(personId, isRoot),
      this.buildResourceContext(unitId),
      this.getMatrix(),
    ]);
    const actions = [...new Set(matrix.map((r) => r.action))];
    return actions.map((action) => {
      const d = authorize(actor, action, resource, matrix);
      return d.allowed
        ? { action, allowed: true, via: d.via, basis: d.basis, pendingApproval: d.pendingApproval ?? false }
        : { action, allowed: false, reason: d.reason };
    });
  }
}
