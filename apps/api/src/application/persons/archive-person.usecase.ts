import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AUDIT_LOG,
  KEYCLOAK_ADMIN,
  PERSON_REPOSITORY,
  type AuditLogPort,
  type KeycloakAdminPort,
  type PersonRecord,
  type PersonRepository,
} from './ports.js';
import { ConfigService } from '../../infrastructure/config/config.service.js';

export interface ArchivePersonInput {
  personId: string;
  reason: 'WYSTAPIENIE' | 'ZWOLNIENIE' | 'WYKLUCZENIE' | 'SMIERC' | 'BLAD_DANYCH' | 'INNY';
  reasonText?: string;
  archivedByPersonId: string;
}

/**
 * Archiwizacja profilu (§8.3) — NIGDY nie kasuje danych.
 *
 * 1. status=ARCHIVED + metadane archiwizacji;
 * 2. email → historicalEmail, email=NULL (adres natychmiast wolny — §8.4);
 * 3. Keycloak: disable + tombstone {personId}@{domena} + unieważnienie sesji
 *    i poświadczeń (obowiązkowe — unikalność adresu w realmie);
 * 4. zniknięcie z widoków operacyjnych realizują filtry repozytoriów;
 *    historia (rozkazy, dzienniki, audit) pozostaje nietknięta.
 *
 * @remarks Karty progresji w toku → ABANDONED: TODO(etap 7).
 */
@Injectable()
export class ArchivePersonUseCase {
  constructor(
    @Inject(PERSON_REPOSITORY) private readonly persons: PersonRepository,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloak: KeycloakAdminPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly config: ConfigService,
  ) {}

  async execute(input: ArchivePersonInput): Promise<PersonRecord> {
    const person = await this.persons.findById(input.personId);
    if (!person) throw new NotFoundException('Profil nie istnieje');
    if (person.status === 'ARCHIVED') return person;

    const releasedEmail = person.email;
    const updated = await this.persons.update(person.id, {
      status: 'ARCHIVED',
      email: null,
      historicalEmail: releasedEmail ?? person.historicalEmail,
      archivedAt: new Date(),
      archiveReason: input.reason,
    });

    if (person.keycloakUserId) {
      const domain = (await this.config.get('ACCOUNT_ARCHIVE_TOMBSTONE_DOMAIN')).value;
      await this.keycloak.archiveUser(person.keycloakUserId, `${person.id}@${domain}`);
    }

    await this.audit.record({
      actorPersonId: input.archivedByPersonId,
      action: 'PERSON_ARCHIVED',
      resourceType: 'Person',
      resourceId: person.id,
      payload: {
        reason: input.reason,
        reasonText: input.reasonText ?? null,
        releasedEmail,
      },
    });

    return updated;
  }
}
