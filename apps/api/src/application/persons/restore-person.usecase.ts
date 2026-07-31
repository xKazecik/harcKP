import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { EmailAlreadyInUseError } from './invite-person.usecase.js';
import { ConfigService } from '../../infrastructure/config/config.service.js';

export interface RestorePersonInput {
  personId: string;
  newEmail: string;
  confirmHistoricalEmail?: boolean;
  restoredByPersonId: string;
}

/**
 * Przywrócenie profilu (§8.5).
 *
 * Adres wpisywany świadomie (nigdy „jednym kliknięciem"); gdy identyczny
 * z historicalEmail — wymagane jawne potwierdzenie. Stare poświadczenia
 * nigdy nie wracają: wychodzi nowe zaproszenie. Funkcje/przydziały NIE
 * wracają automatycznie (osobne rozkazy — etap 6).
 *
 * @throws NotFoundException gdy profil nie istnieje albo nie jest ARCHIVED
 * @throws EmailAlreadyInUseError (→409) gdy adres zajęty, bez ujawniania czyj
 * @throws ConflictException CONFIRM_HISTORICAL_EMAIL gdy adres == historicalEmail
 *   bez potwierdzenia
 */
@Injectable()
export class RestorePersonUseCase {
  constructor(
    @Inject(PERSON_REPOSITORY) private readonly persons: PersonRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloak: KeycloakAdminPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly config: ConfigService,
  ) {}

  async execute(input: RestorePersonInput): Promise<PersonRecord> {
    const person = await this.persons.findById(input.personId);
    if (!person || person.status !== 'ARCHIVED') {
      throw new NotFoundException('Profil archiwalny nie istnieje');
    }

    const newEmail = input.newEmail.toLowerCase();
    if ((await this.persons.emailTaken(newEmail)) || (await this.keycloak.isEmailTaken(newEmail))) {
      throw new EmailAlreadyInUseError();
    }
    if (
      person.historicalEmail?.toLowerCase() === newEmail &&
      input.confirmHistoricalEmail !== true
    ) {
      throw new ConflictException({
        code: 'CONFIRM_HISTORICAL_EMAIL',
        message:
          'Ten adres był wcześniej przypisany do tego profilu i jest nadal wolny. Potwierdź przywrócenie z tym adresem.',
      });
    }

    // historicalEmail POZOSTAJE jako ślad historyczny (§8.5 pkt 4).
    const updated = await this.persons.update(person.id, {
      status: 'ACTIVE',
      email: newEmail,
      archivedAt: null,
      archiveReason: null,
    });

    if (person.keycloakUserId) {
      await this.keycloak.restoreUser(person.keycloakUserId, newEmail);
    }

    // Nowe zaproszenie — hasło od nowa (§8.5 pkt 6).
    const { token, tokenHash } = this.tokens.generate();
    const ttlHours = Number((await this.config.get('INVITATION_TTL_HOURS')).value);
    await this.invitations.create({
      tokenHash,
      personId: person.id,
      createdByPersonId: input.restoredByPersonId,
      expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
    });
    const appUrl = (await this.config.get('APP_URL')).value;
    const appName = (await this.config.get('APP_NAME')).value;
    await this.mailer.send(
      newEmail,
      `${appName} — przywrócenie konta`,
      `Twój profil w systemie ${appName} został przywrócony.\n` +
        `Ustaw hasło od nowa: ${appUrl}/zaproszenie/${token}\n`,
    );

    await this.audit.record({
      actorPersonId: input.restoredByPersonId,
      action: 'PERSON_RESTORED',
      resourceType: 'Person',
      resourceId: person.id,
      payload: { previousEmail: person.historicalEmail, newEmail },
    });

    return updated;
  }
}
