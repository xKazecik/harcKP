import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { guardianConsentStatus, type Branch, type ConsentStatus } from '@harc/domain';
import type { GuardianInput } from '@harc/contracts';
import {
  AUDIT_LOG,
  PERSON_REPOSITORY,
  type AuditLogPort,
  type PersonRecord,
  type PersonRepository,
} from './ports.js';

export interface PersonWithWarnings extends PersonRecord {
  warnings: { guardianConsent: ConsentStatus };
}

/**
 * Profil osoby + profile bez konta + opiekunowie.
 *
 * @remarks Każdy odczyt profilu niesie warnings.guardianConsent — frontend
 * pokazuje drużynowemu przypomnienie "dołącz pozwolenie od rodzica do profilu"
 * przy statusie MISSING (decyzja 2026-07-31: przypomnienie zamiast blokady).
 */
@Injectable()
export class PersonProfileUseCase {
  constructor(
    @Inject(PERSON_REPOSITORY) private readonly persons: PersonRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async get(personId: string): Promise<PersonWithWarnings> {
    const person = await this.persons.findById(personId);
    if (!person) throw new NotFoundException('Profil nie istnieje');
    const guardians = await this.persons.listGuardians(personId);
    return {
      ...person,
      warnings: {
        guardianConsent: guardianConsentStatus(person.birthDate, guardians, new Date()),
      },
    };
  }

  /** Profil bez konta (§8.2) — Person bez keycloakUserId, od razu ACTIVE. */
  async createWithoutAccount(input: {
    firstName: string;
    lastName: string;
    branch: Branch;
    unitId: string;
    birthDate?: string;
    createdByPersonId: string;
  }): Promise<PersonWithWarnings> {
    const person = await this.persons.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: null,
      branch: input.branch,
      status: 'ACTIVE',
      invitedToUnitId: input.unitId,
    });
    if (input.birthDate) {
      await this.persons.update(person.id, { birthDate: new Date(input.birthDate) });
    }
    await this.audit.record({
      actorPersonId: input.createdByPersonId,
      action: 'PERSON_CREATED_WITHOUT_ACCOUNT',
      resourceType: 'Person',
      resourceId: person.id,
      payload: { unitId: input.unitId },
    });
    return this.get(person.id);
  }

  /** Dodanie opiekuna z odnotowaniem zgody — dostępne też po aktywacji konta. */
  async addGuardian(
    personId: string,
    guardian: GuardianInput,
    actorPersonId: string,
  ): Promise<PersonWithWarnings> {
    const person = await this.persons.findById(personId);
    if (!person) throw new NotFoundException('Profil nie istnieje');
    await this.persons.addGuardian(personId, {
      fullName: guardian.fullName,
      phone: guardian.phone,
      email: guardian.email ?? null,
      address: guardian.address,
      consentGivenAt: guardian.consentGivenAt ? new Date(guardian.consentGivenAt) : null,
      consentDocumentRef: guardian.consentDocumentRef ?? null,
    });
    await this.audit.record({
      actorPersonId,
      action: 'GUARDIAN_ADDED',
      resourceType: 'Person',
      resourceId: personId,
      payload: { consentRecorded: Boolean(guardian.consentGivenAt) },
    });
    return this.get(personId);
  }
}
