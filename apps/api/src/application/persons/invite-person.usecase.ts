import { Inject, Injectable } from '@nestjs/common';
import type { Branch } from '@harc/domain';
import {
  AUDIT_LOG,
  INVITATION_REPOSITORY,
  KEYCLOAK_ADMIN,
  MAILER,
  PERSON_REPOSITORY,
  TOKEN_SERVICE,
  type AuditLogPort,
  type InvitationRepository,
  type KeycloakAdminPort,
  type MailerPort,
  type PersonRecord,
  type PersonRepository,
  type TokenService,
} from './ports.js';
import { ConfigService } from '../../infrastructure/config/config.service.js';

/** Błędy cyklu życia konta — mapowane w kontrolerach na kody HTTP. */
export class EmailAlreadyInUseError extends Error {
  readonly code = 'EMAIL_ALREADY_IN_USE';
  constructor() {
    // Komunikat neutralny — bez ujawniania, czyj to adres (§8.5 pkt 2).
    super('Adres e-mail jest przypisany do aktywnego profilu');
  }
}

export interface InvitePersonInput {
  firstName: string;
  lastName: string;
  email: string;
  branch: Branch;
  unitId: string;
  invitedByPersonId: string;
}

/**
 * Zaproszenie do jednostki (§8.2, krok 1) — konto zakłada komendant.
 *
 * Kolejność: unikalność adresu (DB + Keycloak) → Person INVITED →
 * użytkownik Keycloak (username=UUID, bez poświadczeń) → Invitation
 * (token hashowany) → e-mail z linkiem.
 *
 * @remarks Indeks częściowy person_active_email_unique jest backstopem —
 * race condition kończy się błędem unikalności z bazy, nie duplikatem.
 */
@Injectable()
export class InvitePersonUseCase {
  constructor(
    @Inject(PERSON_REPOSITORY) private readonly persons: PersonRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloak: KeycloakAdminPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly config: ConfigService,
  ) {}

  async execute(input: InvitePersonInput): Promise<{ person: PersonRecord; invitationId: string }> {
    const email = input.email.toLowerCase();
    if ((await this.persons.emailTaken(email)) || (await this.keycloak.isEmailTaken(email))) {
      throw new EmailAlreadyInUseError();
    }

    const person = await this.persons.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      branch: input.branch,
      status: 'INVITED',
      invitedToUnitId: input.unitId,
    });

    const keycloakUserId = await this.keycloak.createUser(person.id, email);
    await this.persons.update(person.id, { keycloakUserId });

    const { token, tokenHash } = this.tokens.generate();
    const ttlHours = Number((await this.config.get('INVITATION_TTL_HOURS')).value);
    const invitation = await this.invitations.create({
      tokenHash,
      personId: person.id,
      createdByPersonId: input.invitedByPersonId,
      expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
    });

    const appUrl = (await this.config.get('APP_URL')).value;
    const appName = (await this.config.get('APP_NAME')).value;
    await this.mailer.send(
      email,
      `${appName} — zaproszenie do jednostki`,
      `Cześć ${input.firstName}!\n\nZostało dla Ciebie założone konto w systemie ${appName}.\n` +
        `Dokończ zakładanie konta w ciągu ${ttlHours} godzin:\n\n${appUrl}/zaproszenie/${token}\n`,
    );

    await this.audit.record({
      actorPersonId: input.invitedByPersonId,
      action: 'PERSON_INVITED',
      resourceType: 'Person',
      resourceId: person.id,
      payload: { unitId: input.unitId },
    });

    return { person, invitationId: invitation.id };
  }
}
