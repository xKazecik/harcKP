import { beforeEach, describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { InvitePersonUseCase, EmailAlreadyInUseError } from './invite-person.usecase.js';
import { AcceptInvitationUseCase, InvalidInvitationTokenError } from './accept-invitation.usecase.js';
import { ArchivePersonUseCase } from './archive-person.usecase.js';
import { RestorePersonUseCase } from './restore-person.usecase.js';
import { PersonProfileUseCase } from './person-profile.usecase.js';
import {
  FakeAudit,
  FakeInvitationRepository,
  FakeKeycloak,
  FakeMailer,
  FakePersonRepository,
  FakeTokens,
} from './test-fakes.js';
import { ConfigService } from '../../infrastructure/config/config.service.js';

describe('Cykl życia konta (§8)', () => {
  let persons: FakePersonRepository;
  let invitations: FakeInvitationRepository;
  let keycloak: FakeKeycloak;
  let mailer: FakeMailer;
  let audit: FakeAudit;
  let tokens: FakeTokens;
  let config: ConfigService;
  let invite: InvitePersonUseCase;
  let accept: AcceptInvitationUseCase;
  let archive: ArchivePersonUseCase;
  let restore: RestorePersonUseCase;
  let profile: PersonProfileUseCase;

  const inviteInput = {
    firstName: 'Jan',
    lastName: 'Kowalski',
    email: 'jan@example.org',
    branch: 'HARCERZE' as const,
    unitId: 'unit-1',
    invitedByPersonId: 'komendant-1',
  };

  beforeEach(() => {
    persons = new FakePersonRepository();
    invitations = new FakeInvitationRepository();
    keycloak = new FakeKeycloak();
    mailer = new FakeMailer();
    audit = new FakeAudit();
    tokens = new FakeTokens();
    config = new ConfigService();
    invite = new InvitePersonUseCase(persons, invitations, keycloak, mailer, tokens, audit, config);
    accept = new AcceptInvitationUseCase(invitations, persons, keycloak, mailer, tokens, audit, config);
    archive = new ArchivePersonUseCase(persons, keycloak, audit, config);
    restore = new RestorePersonUseCase(persons, invitations, keycloak, mailer, tokens, audit, config);
    profile = new PersonProfileUseCase(persons, audit);

    // Komendant z adresem — odbiorca powiadomień o aktywacji.
    persons.persons.set('komendant-1', {
      id: 'komendant-1',
      keycloakUserId: 'kc-komendant',
      status: 'ACTIVE',
      email: 'komendant@example.org',
      historicalEmail: null,
      firstName: 'Anna',
      lastName: 'Nowak',
      birthDate: null,
      school: null,
      phone: null,
      branch: 'HARCERZE',
      crossNumber: null,
      promiseDate: null,
      archivedAt: null,
      archiveReason: null,
      invitedToUnitId: null,
    });
  });

  it('zaproszenie: Person INVITED + użytkownik KC bez poświadczeń + e-mail z linkiem', async () => {
    const { person } = await invite.execute(inviteInput);
    expect(person.status).toBe('INVITED');
    expect(keycloak.calls).toContain(`createUser:${person.id}`);
    expect(mailer.sent[0]?.to).toBe('jan@example.org');
    expect(mailer.sent[0]?.body).toContain('/zaproszenie/token-1');
  });

  it('NEGATYWNY: drugi INVITED/ACTIVE z tym samym adresem → EMAIL_ALREADY_IN_USE', async () => {
    await invite.execute(inviteInput);
    await expect(invite.execute(inviteInput)).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });

  it('kreator: zużyty token daje neutralny błąd', async () => {
    await invite.execute(inviteInput);
    await accept.finish('token-1');
    await expect(accept.verify('token-1')).rejects.toBeInstanceOf(InvalidInvitationTokenError);
  });

  it('kreator: <16 lat bez zgody NIE blokuje aktywacji, ale wysyła przypomnienie komendantowi', async () => {
    await invite.execute(inviteInput);
    await accept.completeProfile('token-1', { birthDate: '2013-05-10' });
    const { consentStatus } = await accept.finish('token-1');
    expect(consentStatus).toBe('MISSING');
    const notification = mailer.sent.find((m) => m.to === 'komendant@example.org');
    expect(notification?.body).toContain('pozwolenia od rodzica');
  });

  it('kreator: zgoda odnotowana → PRESENT, bez przypomnienia', async () => {
    await invite.execute(inviteInput);
    await accept.completeProfile('token-1', { birthDate: '2013-05-10' });
    await accept.addGuardian('token-1', {
      fullName: 'Maria Kowalska',
      phone: '600100200',
      address: 'ul. Leśna 1, Poznań',
      consentGivenAt: '2026-07-01',
    });
    const { consentStatus } = await accept.finish('token-1');
    expect(consentStatus).toBe('PRESENT');
    const notification = mailer.sent.find((m) => m.to === 'komendant@example.org');
    expect(notification?.body).not.toContain('pozwolenia od rodzica');
  });

  it('archiwizacja: zwalnia adres (historicalEmail), tombstone w KC, dane zostają', async () => {
    const { person } = await invite.execute(inviteInput);
    await accept.finish('token-1');
    await archive.execute({
      personId: person.id,
      reason: 'WYSTAPIENIE',
      archivedByPersonId: 'komendant-1',
    });
    const archived = await persons.findById(person.id);
    expect(archived?.status).toBe('ARCHIVED');
    expect(archived?.email).toBeNull();
    expect(archived?.historicalEmail).toBe('jan@example.org');
    expect(archived?.firstName).toBe('Jan'); // dane NIE są kasowane
    expect(keycloak.calls).toContain(`archiveUser:${archived?.keycloakUserId}`);
  });

  it('PONOWNE UŻYCIE ADRESU (§8.4): adres zwolniony archiwizacją od razu działa dla nowej osoby', async () => {
    const { person } = await invite.execute(inviteInput);
    await accept.finish('token-1');
    await archive.execute({
      personId: person.id,
      reason: 'WYSTAPIENIE',
      archivedByPersonId: 'komendant-1',
    });
    const second = await invite.execute({ ...inviteInput, firstName: 'Brat' });
    expect(second.person.email).toBe('jan@example.org');
    expect(second.person.id).not.toBe(person.id);
  });

  it('przywrócenie: zajęty adres → EMAIL_ALREADY_IN_USE (bez ujawniania czyj)', async () => {
    const { person } = await invite.execute(inviteInput);
    await accept.finish('token-1');
    await archive.execute({ personId: person.id, reason: 'INNY', archivedByPersonId: 'k' });
    await invite.execute({ ...inviteInput, firstName: 'Brat' }); // adres znowu zajęty
    await expect(
      restore.execute({
        personId: person.id,
        newEmail: 'jan@example.org',
        restoredByPersonId: 'komendant-1',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });

  it('przywrócenie: adres == historicalEmail wymaga jawnego potwierdzenia', async () => {
    const { person } = await invite.execute(inviteInput);
    await accept.finish('token-1');
    await archive.execute({ personId: person.id, reason: 'INNY', archivedByPersonId: 'k' });
    await expect(
      restore.execute({
        personId: person.id,
        newEmail: 'jan@example.org',
        restoredByPersonId: 'komendant-1',
      }),
    ).rejects.toMatchObject({ response: { code: 'CONFIRM_HISTORICAL_EMAIL' } });

    const restored = await restore.execute({
      personId: person.id,
      newEmail: 'jan@example.org',
      confirmHistoricalEmail: true,
      restoredByPersonId: 'komendant-1',
    });
    expect(restored.status).toBe('ACTIVE');
    expect(restored.historicalEmail).toBe('jan@example.org'); // ślad pozostaje
    const inviteMail = mailer.sent.at(-1);
    expect(inviteMail?.body).toContain('/zaproszenie/'); // nowe zaproszenie — hasło od nowa
  });

  it('profil bez konta: pełnoprawny ewidencyjnie, z przypomnieniem o zgodzie', async () => {
    const p = await profile.createWithoutAccount({
      firstName: 'Zuch',
      lastName: 'Malec',
      branch: 'HARCERZE',
      unitId: 'unit-1',
      birthDate: '2018-03-01',
      createdByPersonId: 'komendant-1',
    });
    expect(p.status).toBe('ACTIVE');
    expect(p.keycloakUserId).toBeNull();
    expect(p.warnings.guardianConsent).toBe('MISSING');
    const after = await profile.addGuardian(
      p.id,
      { fullName: 'Rodzic', phone: '1', address: 'x', consentGivenAt: '2026-07-01' },
      'komendant-1',
    );
    expect(after.warnings.guardianConsent).toBe('PRESENT');
  });
});
