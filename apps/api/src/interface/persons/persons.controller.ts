import {
  Body,
  Controller,
  ConflictException,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ArchivePersonSchema,
  CreatePersonWithoutAccountSchema,
  GuardianInputSchema,
  InviteToUnitSchema,
  RestorePersonSchema,
  type ArchivePerson,
  type CreatePersonWithoutAccount,
  type GuardianInput,
  type InviteToUnit,
  type RestorePerson,
} from '@harc/contracts';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  InvitePersonUseCase,
  EmailAlreadyInUseError,
} from '../../application/persons/invite-person.usecase.js';
import { ArchivePersonUseCase } from '../../application/persons/archive-person.usecase.js';
import { RestorePersonUseCase } from '../../application/persons/restore-person.usecase.js';
import {
  PersonProfileUseCase,
  type PersonWithWarnings,
} from '../../application/persons/person-profile.usecase.js';
import { PERSON_REPOSITORY, type PersonRepository } from '../../application/persons/ports.js';

/**
 * Osoby i cykl życia konta (§7–§8).
 *
 * ETAP 3: tożsamość aktora pochodzi z nagłówka X-Person-Id (dev). Etap 5
 * zastąpi go guardem OIDC (token Keycloak) i AuthorizationService — w tym
 * uprawnieniem RESTORE_PERSON dla przywracania.
 */
@Controller('persons')
export class PersonsController {
  constructor(
    private readonly invitePerson: InvitePersonUseCase,
    private readonly archivePerson: ArchivePersonUseCase,
    private readonly restorePerson: RestorePersonUseCase,
    private readonly profile: PersonProfileUseCase,
    @Inject(PERSON_REPOSITORY) private readonly persons: PersonRepository,
  ) {}

  /** Formularz „Przyjmij do jednostki" — trzy pola + kontekst jednostki (§8.2). */
  @Post('invite')
  @HttpCode(201)
  async invite(
    @Body(new ZodValidationPipe(InviteToUnitSchema)) body: InviteToUnit,
    @Headers('x-person-id') actorId: string,
  ): Promise<{ personId: string; invitationId: string }> {
    try {
      const result = await this.invitePerson.execute({
        ...body,
        invitedByPersonId: actorId ?? 'system',
      });
      return { personId: result.person.id, invitationId: result.invitationId };
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError) {
        throw new ConflictException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }

  /** Profil bez konta (§8.2) — osoba bez e-maila, pełnoprawna ewidencyjnie. */
  @Post('without-account')
  @HttpCode(201)
  async withoutAccount(
    @Body(new ZodValidationPipe(CreatePersonWithoutAccountSchema))
    body: CreatePersonWithoutAccount,
    @Headers('x-person-id') actorId: string,
  ): Promise<PersonWithWarnings> {
    return this.profile.createWithoutAccount({ ...body, createdByPersonId: actorId ?? 'system' });
  }

  /** Profil z ostrzeżeniami — w tym przypomnieniem o zgodzie rodzica. */
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<PersonWithWarnings> {
    return this.profile.get(id);
  }

  /** Dodanie opiekuna / odnotowanie zgody rodzica (przypomnienie znika). */
  @Post(':id/guardians')
  @HttpCode(201)
  async addGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(GuardianInputSchema)) body: GuardianInput,
    @Headers('x-person-id') actorId: string,
  ): Promise<PersonWithWarnings> {
    return this.profile.addGuardian(id, body, actorId ?? 'system');
  }

  /** Archiwizacja (§8.3) — nie kasuje danych, zwalnia adres e-mail. */
  @Post(':id/archive')
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ArchivePersonSchema)) body: ArchivePerson,
    @Headers('x-person-id') actorId: string,
  ): Promise<{ status: string }> {
    const person = await this.archivePerson.execute({
      personId: id,
      reason: body.reason,
      ...(body.reasonText !== undefined && { reasonText: body.reasonText }),
      archivedByPersonId: actorId ?? 'system',
    });
    return { status: person.status };
  }

  /** Przywrócenie (§8.5) — wymaga świadomie wpisanego, wolnego adresu. */
  @Post(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RestorePersonSchema)) body: RestorePerson,
    @Headers('x-person-id') actorId: string,
  ): Promise<{ status: string }> {
    try {
      const person = await this.restorePerson.execute({
        personId: id,
        newEmail: body.newEmail,
        ...(body.confirmHistoricalEmail !== undefined && {
          confirmHistoricalEmail: body.confirmHistoricalEmail,
        }),
        restoredByPersonId: actorId ?? 'system',
      });
      return { status: person.status };
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError) {
        throw new ConflictException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }

  /** Widok „Nieaktywne profile" (§8.3) — pełna historia dostępna w profilu. */
  @Get()
  async listArchived(): Promise<Array<Record<string, unknown>>> {
    const rows = await this.persons.listArchived();
    return rows.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      historicalEmail: p.historicalEmail,
      archivedAt: p.archivedAt,
      archiveReason: p.archiveReason,
      lastUnitId: p.invitedToUnitId,
    }));
  }
}
