import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AUDIT_LOG,
  KEYCLOAK_ADMIN,
  MAILER,
  TOKEN_SERVICE,
  type AuditLogPort,
  type KeycloakAdminPort,
  type MailerPort,
  type TokenService,
} from './ports.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { ConfigService } from '../../infrastructure/config/config.service.js';

export interface RequestEmailChangeInput {
  personId: string;
  newEmail: string;
}

export interface ConfirmEmailChangeInput {
  token: string;
}

/** Ile godzin żyje link weryfikacyjny zmiany adresu. */
const TOKEN_TTL_HOURS = 24;

/**
 * Samodzielna zmiana adresu e-mail (§9.6).
 *
 * Kolejność jest istotna i celowo nieoczywista: **najpierw Keycloak, potem
 * baza**. Keycloak jest dostawcą tożsamości i wymusza unikalność adresu
 * w realmie, więc to on może odrzucić zmianę. Gdyby zapis szedł najpierw do
 * bazy, przy błędzie Keycloak aplikacja pokazywałaby nowy adres, którym nie
 * dałoby się zalogować — czyli cichy rozjazd tożsamości.
 *
 * Weryfikacja idzie na NOWY adres, a stary działa do chwili potwierdzenia.
 * Dzięki temu literówka nie odcina nikogo od konta: link po prostu nie
 * dociera, żądanie wygasa, adres zostaje stary.
 */
@Injectable()
export class ChangeEmailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloak: KeycloakAdminPort,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  /**
   * Sprawdza, czy adres jest wolny wśród osób INVITED/ACTIVE oraz w Keycloak.
   *
   * @param email - adres do sprawdzenia
   * @param exceptPersonId - profil pomijany (własny adres użytkownika)
   * @throws ConflictException EMAIL_ALREADY_IN_USE — bez ujawniania, czyj to adres
   */
  private async assertEmailFree(email: string, exceptPersonId: string): Promise<void> {
    const taken = await this.prisma.person.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        status: { in: ['INVITED', 'ACTIVE'] },
        NOT: { id: exceptPersonId },
      },
      select: { id: true },
    });
    if (taken) throw new ConflictException({ code: 'EMAIL_ALREADY_IN_USE' });

    // Zapytanie do IdP też może paść — bez rozróżnienia „adres zajęty" od
    // „nie wiem, bo Keycloak nie odpowiada" użytkownik dostałby gołe 500.
    let takenInIdp: boolean;
    try {
      takenInIdp = await this.keycloak.isEmailTaken(email);
    } catch {
      throw new ServiceUnavailableException({ code: 'IDENTITY_PROVIDER_UNAVAILABLE' });
    }
    if (takenInIdp) throw new ConflictException({ code: 'EMAIL_ALREADY_IN_USE' });
  }

  /**
   * Krok 1: rejestruje żądanie i wysyła link weryfikacyjny na nowy adres.
   *
   * @param input - osoba i docelowy adres
   * @returns identyfikator żądania i moment wygaśnięcia
   * @throws NotFoundException gdy profil nie istnieje
   * @throws BadRequestException gdy adres jest taki sam jak obecny
   * @throws ConflictException EMAIL_ALREADY_IN_USE gdy adres zajęty
   */
  async request(input: RequestEmailChangeInput): Promise<{ id: string; expiresAt: Date }> {
    const person = await this.prisma.person.findUnique({ where: { id: input.personId } });
    if (!person) throw new NotFoundException('Profil nie istnieje');
    if (person.status !== 'ACTIVE') {
      throw new BadRequestException({ code: 'PROFILE_NOT_ACTIVE' });
    }

    const newEmail = input.newEmail.trim().toLowerCase();
    if (person.email && person.email.toLowerCase() === newEmail) {
      throw new BadRequestException({ code: 'EMAIL_UNCHANGED' });
    }
    await this.assertEmailFree(newEmail, person.id);

    // Wcześniejsze, niepotwierdzone żądania tracą ważność — w danym momencie
    // ma sens tylko jeden link.
    await this.prisma.emailChangeRequest.updateMany({
      where: { personId: person.id, confirmedAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });

    const { token, tokenHash } = this.tokens.generate();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3_600_000);
    const created = await this.prisma.emailChangeRequest.create({
      data: {
        personId: person.id,
        newEmail,
        previousEmail: person.email,
        tokenHash,
        expiresAt,
      },
    });

    const appUrl = (await this.config.get('APP_URL')).value;
    await this.mailer.send(
      newEmail,
      'HARC — potwierdź nowy adres e-mail',
      [
        `Cześć ${person.firstName}!`,
        '',
        'Ktoś (mamy nadzieję, że Ty) poprosił o zmianę adresu e-mail w systemie HARC',
        `na ten adres. Aby potwierdzić, otwórz link:`,
        '',
        `${appUrl}/profil/zmiana-adresu/${token}`,
        '',
        `Link jest ważny ${TOKEN_TTL_HOURS} godziny.`,
        'Do czasu potwierdzenia logujesz się starym adresem.',
        'Jeśli to nie Ty — zignoruj tę wiadomość, nic się nie zmieni.',
      ].join('\n'),
    );

    await this.audit.record({
      actorPersonId: person.id,
      action: 'EMAIL_CHANGE_REQUESTED',
      resourceType: 'Person',
      resourceId: person.id,
      payload: { from: person.email, to: newEmail, requestId: created.id },
    });

    return { id: created.id, expiresAt };
  }

  /**
   * Krok 2: potwierdza zmianę — najpierw Keycloak, potem baza (§9.6).
   *
   * @param input - token z linku weryfikacyjnego
   * @returns nowy adres zapisany na profilu
   * @throws BadRequestException INVALID_OR_EXPIRED_TOKEN — komunikat neutralny
   * @throws ConflictException EMAIL_ALREADY_IN_USE gdy adres zajęto w międzyczasie
   */
  async confirm(input: ConfirmEmailChangeInput): Promise<{ email: string }> {
    const tokenHash = this.tokens.hash(input.token);
    const req = await this.prisma.emailChangeRequest.findUnique({ where: { tokenHash } });
    if (!req || req.confirmedAt || req.cancelledAt || req.expiresAt < new Date()) {
      throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });
    }

    const person = await this.prisma.person.findUnique({ where: { id: req.personId } });
    if (!person) throw new BadRequestException({ code: 'INVALID_OR_EXPIRED_TOKEN' });

    // Wszystko, co dotyka IdP, jest w jednym bloku: i sprawdzenie zajętości,
    // i sam zapis. Każde niepowodzenie po tej stronie kończy operację BEZ
    // zmian w bazie i z wpisem w logu (§9.6 pkt 4), a token zostaje ważny,
    // więc użytkownik ponawia z tego samego linku.
    try {
      // Ponowne sprawdzenie: między wysłaniem linku a kliknięciem ktoś inny
      // mógł zająć ten adres (np. zwolniony przy archiwizacji).
      await this.assertEmailFree(req.newEmail, person.id);

      if (person.keycloakUserId) {
        await this.keycloak.updateEmail(person.keycloakUserId, req.newEmail);
      }
    } catch (err) {
      await this.audit.record({
        actorPersonId: person.id,
        action: 'EMAIL_CHANGE_FAILED',
        resourceType: 'Person',
        resourceId: person.id,
        payload: {
          from: person.email,
          to: req.newEmail,
          requestId: req.id,
          stage: 'IDENTITY_PROVIDER',
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    // 2) Baza — dopiero po sukcesie po stronie IdP, w transakcji.
    const previous = person.email;
    await this.prisma.$transaction([
      this.prisma.person.update({
        where: { id: person.id },
        data: { email: req.newEmail },
      }),
      this.prisma.emailChangeRequest.update({
        where: { id: req.id },
        data: { confirmedAt: new Date() },
      }),
    ]);

    // 3) Prośba o weryfikację nowego adresu po stronie Keycloak. Świadomie po
    // zapisie i bez przerywania operacji — adres jest już spójny w obu
    // systemach, a nieudany mail to sprawa do ponowienia, nie do wycofania.
    if (person.keycloakUserId) {
      try {
        await this.keycloak.sendVerifyEmail(person.keycloakUserId);
      } catch {
        // celowo pominięte — patrz komentarz wyżej
      }
    }

    await this.audit.record({
      actorPersonId: person.id,
      action: 'EMAIL_CHANGED',
      resourceType: 'Person',
      resourceId: person.id,
      payload: { from: previous, to: req.newEmail, requestId: req.id },
    });

    return { email: req.newEmail };
  }

  /** Anuluje własne oczekujące żądanie zmiany adresu. */
  async cancel(personId: string): Promise<{ cancelled: number }> {
    const res = await this.prisma.emailChangeRequest.updateMany({
      where: { personId, confirmedAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    return { cancelled: res.count };
  }

  /** Oczekujące żądanie zmiany adresu dla profilu — do pokazania w UI. */
  async pending(personId: string) {
    return this.prisma.emailChangeRequest.findFirst({
      where: {
        personId,
        confirmedAt: null,
        cancelledAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, newEmail: true, expiresAt: true, createdAt: true },
    });
  }
}
