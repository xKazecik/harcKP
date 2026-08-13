import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';
import { RootOnlyGuard } from './root-only.guard.js';
import { RootOverrideUseCase } from '../application/admin/root-override.usecase.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';

/**
 * Powód jest WYMAGANY przy każdej operacji trybu roota.
 *
 * @remarks Minimalna długość odsiewa „x" i „.", ale nie blokuje pracy —
 * chodzi o to, żeby za pół roku dało się odczytać z audytu, dlaczego ktoś
 * ominął normalny tryb, a nie o formalną biurokrację.
 */
const reason = z.string().trim().min(3).max(500);
const force = z.boolean().optional();

/**
 * Tryb roota (§10.1) — zmiany poza normalnym trybem, w tym nadawanie funkcji
 * bez rozkazu.
 *
 * Cały kontroler stoi za `RootOnlyGuard`: jeden punkt egzekwowania zamiast
 * sprawdzeń rozsianych po metodach. Każda operacja wymaga pola `reason`
 * i trafia do audit logu jako `ROOT_OVERRIDE`.
 *
 * Czego tu celowo NIE ma: edycji opublikowanych rozkazów. Rozkaz jest
 * dokumentem organizacji i nie podlega zmianie (§8.6) — sprostowanie idzie
 * osobnym rozkazem przez zwykły moduł.
 */
@Controller('root')
@UseGuards(RootOnlyGuard)
export class RootController {
  constructor(
    private readonly root: RootOverrideUseCase,
    private readonly prisma: PrismaService,
  ) {}

  /** Historia interwencji trybu roota — podgląd dla panelu (§18). */
  @Get('overrides')
  overrides(@Query('limit') limit?: string) {
    return this.prisma.auditLog.findMany({
      where: { action: 'ROOT_OVERRIDE' },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Number(limit ?? 100), 500),
    });
  }

  /** Funkcje pełnione w jednostce — także te nadane bez rozkazu. */
  @Get('leadership')
  leadership(@Query('unitId') unitId?: string, @Query('personId') personId?: string) {
    return this.prisma.unitLeadership.findMany({
      where: { ...(unitId && { unitId }), ...(personId && { personId }) },
      orderBy: { validFrom: 'desc' },
      take: 200,
    });
  }

  /**
   * Nadanie funkcji BEZ rozkazu (§10.1).
   *
   * @throws 403 ROOT_REQUIRED — brak uprawnienia ROOT
   * @throws 404 GUARDIAN_REQUIRED_FOR_ACTING — p.o. bez opiekuna i bez `force`
   */
  @Post('leadership')
  appointFunction(
    @Headers('x-person-id') actorId: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          unitId: z.string().uuid(),
          personId: z.string().uuid(),
          roleKey: z.string().min(1).max(50).default('LEADER'),
          isActing: z.boolean().optional(),
          guardianInstructorId: z.string().uuid().nullish(),
          reason,
          force,
        }),
      ),
    )
    body: {
      unitId: string;
      personId: string;
      roleKey: string;
      isActing?: boolean;
      guardianInstructorId?: string | null;
      reason: string;
      force?: boolean;
    },
  ) {
    return this.root.appointFunction({ actorPersonId: actorId, ...body });
  }

  /** Zwolnienie z funkcji BEZ rozkazu (§10.1). */
  @Post('leadership/:id/end')
  endFunction(
    @Param('id') id: string,
    @Headers('x-person-id') actorId: string,
    @Body(new ZodValidationPipe(z.object({ reason, force })))
    body: { reason: string; force?: boolean },
  ) {
    return this.root.endFunction({ actorPersonId: actorId, leadershipId: id, ...body });
  }

  /** Dowolna edycja jednostki — łącznie ze statusem i kategorią. */
  @Patch('units/:id')
  patchUnit(
    @Param('id') id: string,
    @Headers('x-person-id') actorId: string,
    @Body(new ZodValidationPipe(z.object({ reason, force, data: z.record(z.unknown()) })))
    body: { reason: string; force?: boolean; data: Record<string, unknown> },
  ) {
    return this.root.patchUnit({ actorPersonId: actorId, unitId: id, ...body });
  }

  /**
   * Dowolna edycja osoby — łącznie z kategorią członkostwa i statusem.
   *
   * @remarks Adres e-mail jest wyłączony z tej ścieżki: musi iść przez
   * `/persons/me/email-change`, żeby zachować kolejność Keycloak → baza (§9.6).
   */
  @Patch('persons/:id')
  patchPerson(
    @Param('id') id: string,
    @Headers('x-person-id') actorId: string,
    @Body(new ZodValidationPipe(z.object({ reason, force, data: z.record(z.unknown()) })))
    body: { reason: string; force?: boolean; data: Record<string, unknown> },
  ) {
    return this.root.patchPerson({ actorPersonId: actorId, personId: id, ...body });
  }
}
