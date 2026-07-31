/**
 * Fake'i portów do testów jednostkowych cyklu życia konta.
 * Odtwarzają semantykę §8.4: unikalność adresu tylko wśród INVITED/ACTIVE.
 */
import type {
  AuditLogPort,
  GuardianRecord,
  InvitationRecord,
  InvitationRepository,
  KeycloakAdminPort,
  MailerPort,
  PersonRecord,
  PersonRepository,
  TokenService,
} from './ports.js';

export class FakePersonRepository implements PersonRepository {
  readonly persons = new Map<string, PersonRecord>();
  readonly guardians = new Map<string, GuardianRecord[]>();
  private seq = 0;

  async findById(id: string): Promise<PersonRecord | null> {
    return this.persons.get(id) ?? null;
  }

  async emailTaken(email: string): Promise<boolean> {
    return [...this.persons.values()].some(
      (p) =>
        p.email?.toLowerCase() === email.toLowerCase() &&
        (p.status === 'INVITED' || p.status === 'ACTIVE'),
    );
  }

  async create(data: Parameters<PersonRepository['create']>[0]): Promise<PersonRecord> {
    const person: PersonRecord = {
      id: `person-${++this.seq}`,
      keycloakUserId: null,
      status: data.status,
      email: data.email,
      historicalEmail: null,
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: null,
      school: null,
      phone: null,
      branch: data.branch,
      crossNumber: null,
      promiseDate: null,
      archivedAt: null,
      archiveReason: null,
      invitedToUnitId: data.invitedToUnitId,
    };
    this.persons.set(person.id, person);
    return person;
  }

  async update(id: string, data: Partial<Omit<PersonRecord, 'id'>>): Promise<PersonRecord> {
    const p = this.persons.get(id);
    if (!p) throw new Error('not found');
    const next = { ...p, ...data };
    this.persons.set(id, next);
    return next;
  }

  async listGuardians(personId: string): Promise<GuardianRecord[]> {
    return this.guardians.get(personId) ?? [];
  }

  async addGuardian(
    personId: string,
    data: Parameters<PersonRepository['addGuardian']>[1],
  ): Promise<GuardianRecord> {
    const g: GuardianRecord = {
      id: `guardian-${++this.seq}`,
      personId,
      fullName: data.fullName,
      consentGivenAt: data.consentGivenAt,
    };
    const list = this.guardians.get(personId) ?? [];
    list.push(g);
    this.guardians.set(personId, list);
    return g;
  }

  async listArchived(): Promise<PersonRecord[]> {
    return [...this.persons.values()].filter((p) => p.status === 'ARCHIVED');
  }
}

export class FakeInvitationRepository implements InvitationRepository {
  readonly invitations = new Map<string, InvitationRecord & { tokenHash: string }>();
  private seq = 0;

  async create(
    data: Parameters<InvitationRepository['create']>[0],
  ): Promise<InvitationRecord> {
    const inv = {
      id: `inv-${++this.seq}`,
      tokenHash: data.tokenHash,
      personId: data.personId,
      createdByPersonId: data.createdByPersonId,
      createdAt: new Date(),
      expiresAt: data.expiresAt,
      usedAt: null,
      revokedAt: null,
      lastSentAt: new Date(),
    };
    this.invitations.set(inv.id, inv);
    return inv;
  }

  async findByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
    return [...this.invitations.values()].find((i) => i.tokenHash === tokenHash) ?? null;
  }

  async findById(id: string): Promise<InvitationRecord | null> {
    return this.invitations.get(id) ?? null;
  }

  async findActiveByPersonId(personId: string): Promise<InvitationRecord | null> {
    return (
      [...this.invitations.values()].find(
        (i) => i.personId === personId && !i.usedAt && !i.revokedAt && i.expiresAt > new Date(),
      ) ?? null
    );
  }

  async update(
    id: string,
    data: Parameters<InvitationRepository['update']>[1],
  ): Promise<InvitationRecord> {
    const i = this.invitations.get(id);
    if (!i) throw new Error('not found');
    const next = { ...i, ...data };
    this.invitations.set(id, next);
    return next;
  }

  async list(): Promise<InvitationRecord[]> {
    return [...this.invitations.values()];
  }
}

export class FakeKeycloak implements KeycloakAdminPort {
  readonly users = new Map<string, { email: string; enabled: boolean }>();
  readonly calls: string[] = [];
  private seq = 0;

  async createUser(personId: string, email: string): Promise<string> {
    const id = `kc-${++this.seq}`;
    this.users.set(id, { email, enabled: true });
    this.calls.push(`createUser:${personId}`);
    return id;
  }

  async isEmailTaken(email: string): Promise<boolean> {
    return [...this.users.values()].some(
      (u) => u.enabled && u.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async sendSetPasswordEmail(id: string): Promise<void> {
    this.calls.push(`sendSetPasswordEmail:${id}`);
  }

  async resetPassword(id: string): Promise<void> {
    this.calls.push(`resetPassword:${id}`);
  }

  async archiveUser(id: string, tombstoneEmail: string): Promise<void> {
    const u = this.users.get(id);
    if (u) this.users.set(id, { email: tombstoneEmail, enabled: false });
    this.calls.push(`archiveUser:${id}`);
  }

  async restoreUser(id: string, newEmail: string): Promise<void> {
    const u = this.users.get(id);
    if (u) this.users.set(id, { email: newEmail, enabled: true });
    this.calls.push(`restoreUser:${id}`);
  }
}

export class FakeMailer implements MailerPort {
  readonly sent: Array<{ to: string; subject: string; body: string }> = [];
  async send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ to, subject, body });
  }
}

export class FakeAudit implements AuditLogPort {
  readonly entries: Array<{ action: string; resourceId: string }> = [];
  async record(entry: { action: string; resourceId: string }): Promise<void> {
    this.entries.push({ action: entry.action, resourceId: entry.resourceId });
  }
}

export class FakeTokens implements TokenService {
  private seq = 0;
  generate(): { token: string; tokenHash: string } {
    const token = `token-${++this.seq}`;
    return { token, tokenHash: this.hash(token) };
  }
  hash(token: string): string {
    return `hash(${token})`;
  }
}
