import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { canDelegate, canManageAdminGrant, type AdminRole, type GrantActor } from '@harc/domain';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { AUDIT_LOG, type AuditLogPort } from '../persons/ports.js';

export interface GrantAdminRoleInput {
  actorPersonId: string;
  actorIsRoot: boolean;
  targetPersonId: string;
  role: AdminRole;
  /** Wymagany dla UNIT_ADMIN, ignorowany dla SYSADMIN. */
  unitId?: string | null;
}

export interface RevokeAdminRoleInput {
  actorPersonId: string;
  actorIsRoot: boolean;
  grantId: string;
}

export interface GrantDelegationInput {
  actorPersonId: string;
  actorIsRoot: boolean;
  toPersonId: string;
  action: string;
  unitId: string;
  expiresAt: Date;
}

export interface RevokeDelegationInput {
  actorPersonId: string;
  actorIsRoot: boolean;
  delegationId: string;
}

/**
 * Nadawanie i odbieranie uprawnień administracyjnych oraz delegacji (§10.1, §10.4).
 *
 * @remarks Decyzje podejmują czyste funkcje domenowe `canManageAdminGrant`
 * i `canDelegate` — ta klasa wyłącznie zbiera dla nich kontekst z bazy
 * i utrwala wynik. Odebranie uprawnienia to zawsze ustawienie `revokedAt`,
 * nigdy `DELETE`: historia uprawnień jest częścią śladu audytowego (§18).
 */
@Injectable()
export class AdminGrantsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  /**
   * Buduje kontekst aktora dla reguł z `admin-grants.ts`.
   *
   * @param personId - osoba wykonująca operację
   * @param isRoot - czy z claimu `groups` wynika ROOT (§9.4)
   * @returns kontekst z rolami administracyjnymi aktora
   */
  private async grantActor(personId: string, isRoot: boolean): Promise<GrantActor> {
    const grants = await this.prisma.adminGrant.findMany({
      where: { personId, revokedAt: null },
    });
    return {
      personId,
      isRoot,
      isSysadmin: grants.some((g) => g.role === 'SYSADMIN'),
      unitAdminOf: grants
        .filter((g) => g.role === 'UNIT_ADMIN' && g.unitId)
        .map((g) => g.unitId as string),
    };
  }

  /**
   * Nadaje rolę administracyjną.
   *
   * @param input - aktor, osoba docelowa, rola i ewentualna jednostka
   * @returns utworzony rekord `AdminGrant`
   * @throws ForbiddenException gdy reguła z §10.1 nie pozwala na operację
   * @throws NotFoundException gdy osoba docelowa nie istnieje
   * @throws BadRequestException gdy uprawnienie już obowiązuje
   */
  async grantRole(input: GrantAdminRoleInput) {
    const target = await this.prisma.person.findUnique({ where: { id: input.targetPersonId } });
    if (!target) throw new NotFoundException('Osoba nie istnieje');

    const unitAncestorIds = input.unitId
      ? (await this.authz.buildResourceContext(input.unitId)).ancestorIds
      : [];

    const actor = await this.grantActor(input.actorPersonId, input.actorIsRoot);
    const decision = canManageAdminGrant(actor, {
      role: input.role,
      personId: input.targetPersonId,
      unitId: input.unitId ?? null,
      unitAncestorIds,
    });
    if (!decision.allowed) {
      throw new ForbiddenException({ code: decision.reason });
    }

    const existing = await this.prisma.adminGrant.findFirst({
      where: {
        personId: input.targetPersonId,
        role: input.role,
        unitId: input.unitId ?? null,
        revokedAt: null,
      },
    });
    if (existing) throw new BadRequestException({ code: 'GRANT_ALREADY_ACTIVE' });

    const grant = await this.prisma.adminGrant.create({
      data: {
        personId: input.targetPersonId,
        role: input.role,
        unitId: input.unitId ?? null,
        grantedByPersonId: input.actorPersonId,
      },
    });

    await this.audit.record({
      actorPersonId: input.actorPersonId,
      action: 'ADMIN_GRANT_CREATED',
      resourceType: 'AdminGrant',
      resourceId: grant.id,
      payload: {
        targetPersonId: input.targetPersonId,
        role: input.role,
        unitId: input.unitId ?? null,
        basis: decision.basis,
      },
    });
    return grant;
  }

  /**
   * Odbiera rolę administracyjną (`revokedAt`, bez kasowania rekordu).
   *
   * @param input - aktor i identyfikator uprawnienia
   * @returns zaktualizowany rekord `AdminGrant`
   * @throws ForbiddenException gdy reguła z §10.1 nie pozwala na operację
   * @throws NotFoundException gdy uprawnienie nie istnieje lub już odebrane
   */
  async revokeRole(input: RevokeAdminRoleInput) {
    const grant = await this.prisma.adminGrant.findUnique({ where: { id: input.grantId } });
    if (!grant || grant.revokedAt) throw new NotFoundException('Uprawnienie nie istnieje');

    const unitAncestorIds = grant.unitId
      ? (await this.authz.buildResourceContext(grant.unitId)).ancestorIds
      : [];

    const actor = await this.grantActor(input.actorPersonId, input.actorIsRoot);
    const decision = canManageAdminGrant(actor, {
      role: grant.role,
      personId: grant.personId,
      unitId: grant.unitId,
      unitAncestorIds,
    });
    if (!decision.allowed) throw new ForbiddenException({ code: decision.reason });

    const updated = await this.prisma.adminGrant.update({
      where: { id: grant.id },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      actorPersonId: input.actorPersonId,
      action: 'ADMIN_GRANT_REVOKED',
      resourceType: 'AdminGrant',
      resourceId: grant.id,
      payload: { targetPersonId: grant.personId, role: grant.role, unitId: grant.unitId },
    });
    return updated;
  }

  /**
   * Deleguje pojedynczą kompetencję funkcyjnemu (§10.4).
   *
   * @param input - aktor, obdarowany, akcja, jednostka i termin wygaśnięcia
   * @returns utworzony rekord `DelegationGrant`
   * @throws ForbiddenException gdy akcja nie jest delegowalna albo delegujący
   *   sam jej nie posiada w tym kontekście
   *
   * @remarks Warunek „tylko kompetencje, które sam posiadam" sprawdzamy przez
   * `AuthorizationService.require` na tej samej jednostce — dzięki temu
   * delegacja nie może rozszerzyć zasięgu poza zasięg delegującego. ROOT jest
   * z tego zwolniony, bo `authorize()` i tak przepuszcza go bezwarunkowo.
   */
  async grantDelegation(input: GrantDelegationInput) {
    const matrixRow = await this.prisma.competence.findFirst({
      where: { action: input.action },
    });
    if (!matrixRow) throw new ForbiddenException({ code: 'ACTION_UNKNOWN' });

    let delegatorHasCompetence = input.actorIsRoot;
    let delegatorCompetenceVia: 'COMPETENCE' | 'DELEGATION' | 'SUBSTITUTION' | 'ADMIN' | null =
      input.actorIsRoot ? 'ADMIN' : null;
    if (!delegatorHasCompetence) {
      try {
        const d = await this.authz.require(input.actorPersonId, false, input.action, input.unitId);
        delegatorHasCompetence = d.allowed;
        // `via` rozstrzyga, czy to władza własna, czy pożyczona — bez tego
        // obdarowany mógłby delegować dalej (zakaz subdelegacji, §10.4).
        delegatorCompetenceVia = d.allowed ? d.via : null;
      } catch {
        delegatorHasCompetence = false;
      }
    }

    const decision = canDelegate(
      {
        action: input.action,
        isDelegable: matrixRow.delegable,
        delegatorHasCompetence,
        delegatorCompetenceVia,
        expiresAt: input.expiresAt,
      },
      new Date(),
    );
    if (!decision.allowed) throw new ForbiddenException({ code: decision.reason });

    const delegation = await this.prisma.delegationGrant.create({
      data: {
        fromPersonId: input.actorPersonId,
        toPersonId: input.toPersonId,
        action: input.action,
        unitId: input.unitId,
        expiresAt: input.expiresAt,
      },
    });

    await this.audit.record({
      actorPersonId: input.actorPersonId,
      action: 'DELEGATION_GRANTED',
      resourceType: 'DelegationGrant',
      resourceId: delegation.id,
      payload: {
        toPersonId: input.toPersonId,
        delegatedAction: input.action,
        unitId: input.unitId,
        expiresAt: input.expiresAt.toISOString(),
      },
    });
    return delegation;
  }

  /**
   * Odwołuje delegację przed terminem.
   *
   * @param input - aktor i identyfikator delegacji
   * @returns zaktualizowany rekord `DelegationGrant`
   * @throws NotFoundException gdy delegacja nie istnieje lub jest już odwołana
   * @throws ForbiddenException gdy aktor nie jest delegującym ani ROOT-em
   */
  async revokeDelegation(input: RevokeDelegationInput) {
    const delegation = await this.prisma.delegationGrant.findUnique({
      where: { id: input.delegationId },
    });
    if (!delegation || delegation.revokedAt) throw new NotFoundException('Delegacja nie istnieje');

    // Odwołać może ten, kto nadał — albo ROOT.
    if (!input.actorIsRoot && delegation.fromPersonId !== input.actorPersonId) {
      throw new ForbiddenException({ code: 'NOT_DELEGATION_OWNER' });
    }

    const updated = await this.prisma.delegationGrant.update({
      where: { id: delegation.id },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      actorPersonId: input.actorPersonId,
      action: 'DELEGATION_REVOKED',
      resourceType: 'DelegationGrant',
      resourceId: delegation.id,
      payload: {
        toPersonId: delegation.toPersonId,
        delegatedAction: delegation.action,
        unitId: delegation.unitId,
      },
    });
    return updated;
  }
}
