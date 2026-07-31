import { Inject, Injectable } from '@nestjs/common';
import { guardianConsentStatus, type ConsentStatus } from '@harc/domain';
import type { CompleteProfile, GuardianInput } from '@harc/contracts';
import {
  AUDIT_LOG,
  INVITATION_REPOSITORY,
  KEYCLOAK_ADMIN,
  MAILER,
  PERSON_REPOSITORY,
  TOKEN_SERVICE,
  type AuditLogPort,
  type InvitationRecord,
  type InvitationRepository,
  type KeycloakAdminPort,
  type MailerPort,
  type PersonRepository,
  type TokenService,
} from './ports.js';
import { ConfigService } from '../../infrastructure/config/config.service.js';

/**
 * Neutralny błąd tokenu (§8.2) — jeden kod niezależnie od przyczyny
 * (zużyty / unieważniony / wygasły / nieistniejący), bez ujawniania,
 * czy konto istnieje.
 */
export class InvalidInvitationTokenError extends Error {
  readonly code = 'INVITATION_INVALID';
  constructor() {
    super('Link jest nieprawidłowy albo stracił ważność');
  }
}

/**
 * Kreator zaproszenia (§8.2, krok 2) — weryfikacja tokenu i kolejne kroki.
 */
@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(PERSON_REPOSITORY) private readonly persons: PersonRepository,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloak: KeycloakAdminPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly config: ConfigService,
  ) {}

  /** @throws InvalidInvitationTokenError dla każdego niepoprawnego stanu tokenu */
  private async requireValid(token: string): Promise<InvitationRecord> {
    const invitation = await this.invitations.findByTokenHash(this.tokens.hash(token));
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt < new Date()) {
      throw new InvalidInvitationTokenError();
    }
    return invitation;
  }

  /** Weryfikacja tokenu przy wejściu na stronę kreatora. */
  async verify(token: string): Promise<{ firstName: string; personId: string }> {
    const invitation = await this.requireValid(token);
    const person = await this.persons.findById(invitation.personId);
    if (!person) throw new InvalidInvitationTokenError();
    return { firstName: person.firstName, personId: person.id };
  }

  /**
   * Krok 1 — hasło po stronie Keycloak (execute-actions-email z UPDATE_PASSWORD).
   * Aplikacja nigdy nie widzi hasła.
   */
  async requestPasswordSetup(token: string): Promise<void> {
    const invitation = await this.requireValid(token);
    const person = await this.persons.findById(invitation.personId);
    if (!person?.keycloakUserId) throw new InvalidInvitationTokenError();
    const appUrl = (await this.config.get('APP_URL')).value;
    await this.keycloak.sendSetPasswordEmail(
      person.keycloakUserId,
      `${appUrl}/zaproszenie/${token}?krok=profil`,
    );
  }

  /** Krok 1 (tryb awaryjny) — hasło ustawiane przez API, tylko w pamięci żądania. */
  async setPasswordFallback(token: string, password: string): Promise<void> {
    const invitation = await this.requireValid(token);
    const person = await this.persons.findById(invitation.personId);
    if (!person?.keycloakUserId) throw new InvalidInvitationTokenError();
    await this.keycloak.resetPassword(person.keycloakUserId, password);
  }

  /** Krok 2 — uzupełnienie profilu. */
  async completeProfile(token: string, profile: CompleteProfile): Promise<void> {
    const invitation = await this.requireValid(token);
    await this.persons.update(invitation.personId, {
      birthDate: profile.birthDate ? new Date(profile.birthDate) : null,
      school: profile.school ?? null,
      phone: profile.phone ?? null,
      crossNumber: profile.crossNumber ?? null,
      promiseDate: profile.promiseDate ? new Date(profile.promiseDate) : null,
    });
  }

  /**
   * Krok 3 — opiekun. NIEBLOKUJĄCY (decyzja 2026-07-31): pominięcie kroku przy
   * osobie <16 lat skutkuje statusem MISSING i przypomnieniem dla drużynowego,
   * nie zatrzymaniem kreatora.
   */
  async addGuardian(token: string, guardian: GuardianInput): Promise<void> {
    const invitation = await this.requireValid(token);
    await this.persons.addGuardian(invitation.personId, {
      fullName: guardian.fullName,
      phone: guardian.phone,
      email: guardian.email ?? null,
      address: guardian.address,
      consentGivenAt: guardian.consentGivenAt ? new Date(guardian.consentGivenAt) : null,
      consentDocumentRef: guardian.consentDocumentRef ?? null,
    });
  }

  /**
   * Krok 4 — podsumowanie: ACTIVE, usedAt, powiadomienie komendanta.
   * Gdy zgoda rodzica jest MISSING, powiadomienie zawiera przypomnienie
   * o dołączeniu pozwolenia od rodzica do profilu.
   */
  async finish(token: string): Promise<{ consentStatus: ConsentStatus }> {
    const invitation = await this.requireValid(token);
    const person = await this.persons.findById(invitation.personId);
    if (!person) throw new InvalidInvitationTokenError();

    await this.persons.update(person.id, { status: 'ACTIVE' });
    await this.invitations.update(invitation.id, { usedAt: new Date() });

    const guardians = await this.persons.listGuardians(person.id);
    const refreshed = await this.persons.findById(person.id);
    const consentStatus = guardianConsentStatus(
      refreshed?.birthDate ?? null,
      guardians,
      new Date(),
    );

    const inviter = await this.persons.findById(invitation.createdByPersonId);
    if (inviter?.email) {
      const reminder =
        consentStatus === 'MISSING'
          ? `\n\nPRZYPOMNIENIE: ${person.firstName} ${person.lastName} ma mniej niż 16 lat, ` +
            `a do profilu nie dołączono pozwolenia od rodzica na uczestnictwo w drużynie. ` +
            `Zbierz zgodę i odnotuj ją w profilu (zakładka Opiekunowie).`
          : '';
      const appName = (await this.config.get('APP_NAME')).value;
      await this.mailer.send(
        inviter.email,
        `${appName} — ${person.firstName} ${person.lastName} aktywował(a) konto`,
        `Zaproszona osoba dokończyła zakładanie konta.${reminder}`,
      );
    }

    await this.audit.record({
      actorPersonId: person.id,
      action: 'PERSON_ACTIVATED',
      resourceType: 'Person',
      resourceId: person.id,
      payload: { consentStatus },
    });

    return { consentStatus };
  }
}
