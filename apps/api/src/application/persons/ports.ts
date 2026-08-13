import type { Branch } from '@harc/domain';

// ---------------------------------------------------------------------------
// Migawki warstwy aplikacji
// ---------------------------------------------------------------------------

export interface PersonRecord {
  id: string;
  keycloakUserId: string | null;
  status: 'INVITED' | 'ACTIVE' | 'ARCHIVED';
  email: string | null;
  historicalEmail: string | null;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  school: string | null;
  phone: string | null;
  branch: Branch;
  crossNumber: string | null;
  promiseDate: Date | null;
  archivedAt: Date | null;
  archiveReason: string | null;
  invitedToUnitId: string | null;
}

export interface GuardianRecord {
  id: string;
  personId: string;
  fullName: string;
  consentGivenAt: Date | null;
}

export interface InvitationRecord {
  id: string;
  personId: string;
  createdByPersonId: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  lastSentAt: Date;
}

// ---------------------------------------------------------------------------
// Porty repozytoriów
// ---------------------------------------------------------------------------

export const PERSON_REPOSITORY = Symbol('PERSON_REPOSITORY');

export interface PersonRepository {
  findById(id: string): Promise<PersonRecord | null>;
  /** Czy adres jest zajęty wśród INVITED/ACTIVE (§8.4)? Backstop: indeks częściowy. */
  emailTaken(email: string): Promise<boolean>;
  create(data: {
    firstName: string;
    lastName: string;
    email: string | null;
    branch: Branch;
    status: 'INVITED' | 'ACTIVE';
    invitedToUnitId: string | null;
  }): Promise<PersonRecord>;
  update(id: string, data: Partial<Omit<PersonRecord, 'id'>>): Promise<PersonRecord>;
  listGuardians(personId: string): Promise<GuardianRecord[]>;
  addGuardian(
    personId: string,
    data: {
      fullName: string;
      phone: string;
      email: string | null;
      address: string;
      consentGivenAt: Date | null;
      consentDocumentRef: string | null;
    },
  ): Promise<GuardianRecord>;
  /** Widok "Nieaktywne profile" (§8.3). */
  listArchived(): Promise<PersonRecord[]>;
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');

export interface InvitationRepository {
  create(data: {
    tokenHash: string;
    personId: string;
    createdByPersonId: string;
    expiresAt: Date;
  }): Promise<InvitationRecord>;
  findByTokenHash(tokenHash: string): Promise<InvitationRecord | null>;
  findById(id: string): Promise<InvitationRecord | null>;
  findActiveByPersonId(personId: string): Promise<InvitationRecord | null>;
  update(id: string, data: Partial<Pick<InvitationRecord, 'usedAt' | 'revokedAt' | 'lastSentAt' | 'expiresAt'>> & { tokenHash?: string }): Promise<InvitationRecord>;
  list(filter: { pending?: boolean; expired?: boolean }): Promise<InvitationRecord[]>;
}

// ---------------------------------------------------------------------------
// Port Keycloak Admin API (§9.2 — tylko role manage/view/query-users)
// ---------------------------------------------------------------------------

export const KEYCLOAK_ADMIN = Symbol('KEYCLOAK_ADMIN');

export interface KeycloakAdminPort {
  /** Tworzy użytkownika: username = personId (UUID), bez poświadczeń. */
  createUser(personId: string, email: string): Promise<string>;
  isEmailTaken(email: string): Promise<boolean>;
  /** execute-actions-email z UPDATE_PASSWORD i redirectem do kreatora (§8.2). */
  sendSetPasswordEmail(keycloakUserId: string, redirectUri: string): Promise<void>;
  /** Tryb awaryjny: bezpośrednie ustawienie hasła (§8.2). */
  resetPassword(keycloakUserId: string, password: string): Promise<void>;
  /**
   * Archiwizacja (§8.3): disable, tombstone email, emailVerified=false,
   * unieważnienie sesji, usunięcie poświadczeń. Username pozostaje UUID-em.
   */
  archiveUser(keycloakUserId: string, tombstoneEmail: string): Promise<void>;
  /** Przywrócenie (§8.5): enable + nowy adres, emailVerified=false. */
  restoreUser(keycloakUserId: string, newEmail: string): Promise<void>;
  /**
   * Zmiana adresu w Keycloak (§9.6) — wykonywana PRZED zapisem w bazie.
   *
   * @param keycloakUserId - identyfikator użytkownika w realmie
   * @param newEmail - nowy adres; `emailVerified` wraca na false
   * @throws Error gdy Keycloak odrzuci zmianę (np. adres zajęty w realmie)
   */
  updateEmail(keycloakUserId: string, newEmail: string): Promise<void>;
  /** Wysyła wiadomość weryfikacyjną na aktualnie zapisany adres (§9.6). */
  sendVerifyEmail(keycloakUserId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Pozostałe porty
// ---------------------------------------------------------------------------

export const MAILER = Symbol('MAILER');

export interface MailerPort {
  send(to: string, subject: string, textBody: string): Promise<void>;
}

export const AUDIT_LOG = Symbol('AUDIT_LOG');

export interface AuditLogPort {
  record(entry: {
    actorPersonId: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

/** Generacja i hashowanie tokenów zaproszeń (token jawny tylko w linku). */
export interface TokenService {
  generate(): { token: string; tokenHash: string };
  hash(token: string): string;
}
