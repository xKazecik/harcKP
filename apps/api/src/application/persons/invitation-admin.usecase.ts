import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AUDIT_LOG,
  INVITATION_REPOSITORY,
  MAILER,
  PERSON_REPOSITORY,
  TOKEN_SERVICE,
  type AuditLogPort,
  type InvitationRepository,
  type MailerPort,
  type PersonRepository,
  type TokenService,
} from './ports.js';
import { ConfigService } from '../../infrastructure/config/config.service.js';

/**
 * Zarządzanie zaproszeniami przez komendanta (§8.2 — obsługa brzegów):
 * ponowna wysyłka z cooldownem, unieważnienie, lista oczekujących/wygasłych.
 */
@Injectable()
export class InvitationAdminUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(PERSON_REPOSITORY) private readonly persons: PersonRepository,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly config: ConfigService,
  ) {}

  /**
   * Ponowna wysyłka: nowy token (stary przestaje działać), nowy termin ważności.
   * @throws ConflictException RESEND_COOLDOWN gdy nie minął cooldown
   */
  async resend(invitationId: string, actorPersonId: string): Promise<void> {
    const invitation = await this.invitations.findById(invitationId);
    if (!invitation || invitation.usedAt || invitation.revokedAt) {
      throw new NotFoundException('Zaproszenie nie istnieje albo zostało zamknięte');
    }
    const cooldownMin = Number(
      (await this.config.get('INVITATION_RESEND_COOLDOWN_MINUTES')).value,
    );
    const earliest = new Date(invitation.lastSentAt.getTime() + cooldownMin * 60_000);
    if (new Date() < earliest) {
      throw new ConflictException({ code: 'RESEND_COOLDOWN', retryAfter: earliest.toISOString() });
    }

    const person = await this.persons.findById(invitation.personId);
    if (!person?.email) throw new NotFoundException('Profil nie ma adresu e-mail');

    const { token, tokenHash } = this.tokens.generate();
    const ttlHours = Number((await this.config.get('INVITATION_TTL_HOURS')).value);
    await this.invitations.update(invitation.id, {
      tokenHash,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
    });

    const appUrl = (await this.config.get('APP_URL')).value;
    const appName = (await this.config.get('APP_NAME')).value;
    await this.mailer.send(
      person.email,
      `${appName} — zaproszenie (ponowna wysyłka)`,
      `Dokończ zakładanie konta: ${appUrl}/zaproszenie/${token}\n`,
    );

    await this.audit.record({
      actorPersonId,
      action: 'INVITATION_RESENT',
      resourceType: 'Invitation',
      resourceId: invitation.id,
      payload: {},
    });
  }

  /** Unieważnienie zaproszenia przez komendanta. */
  async revoke(invitationId: string, actorPersonId: string): Promise<void> {
    const invitation = await this.invitations.findById(invitationId);
    if (!invitation || invitation.usedAt || invitation.revokedAt) {
      throw new NotFoundException('Zaproszenie nie istnieje albo zostało zamknięte');
    }
    await this.invitations.update(invitation.id, { revokedAt: new Date() });
    await this.audit.record({
      actorPersonId,
      action: 'INVITATION_REVOKED',
      resourceType: 'Invitation',
      resourceId: invitation.id,
      payload: {},
    });
  }
}
