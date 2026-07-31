/**
 * Panel administracyjny (§18) + mapa publiczna (§15).
 */
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';
import {
  ConfigService,
  SettingLockedByEnvError,
} from '../infrastructure/config/config.service.js';
import { PrismaService } from '../infrastructure/prisma/prisma.service.js';
import { AuthorizationService } from '../application/authorization/authorization.service.js';
import { unitDisplayName } from '@harc/domain';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  /** Ustawienia z {value, source, isLocked} — pola env wyszarzone w UI (§5). */
  @Get('settings')
  settings() {
    return this.config.getAll();
  }

  /** @throws 409 SETTING_LOCKED_BY_ENV — walidacja serwerowa, nie tylko UI (§5). */
  @Put('settings/:key')
  async setSetting(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(z.object({ value: z.string() }))) body: { value: string },
    @Headers('x-person-id') actorId: string,
  ) {
    try {
      return await this.config.set(key, body.value, actorId);
    } catch (err) {
      if (err instanceof SettingLockedByEnvError) {
        throw new ConflictException({ code: err.code, key: err.key });
      }
      throw err;
    }
  }

  /** Edytor słowników: wersje z podglądem różnic (§18). */
  @Get('dictionaries')
  dictionaries() {
    return this.prisma.dictionary.findMany({ include: { entries: { orderBy: { version: 'asc' } } } });
  }

  /** Uprawnienia efektywne — skąd wynika każde uprawnienie (§18). */
  @Get('effective-permissions')
  effectivePermissions(
    @Query('personId') personId: string,
    @Query('unitId') unitId: string,
    @Headers('x-root') root: string,
  ) {
    return this.authz.effectivePermissions(personId, root === 'true', unitId);
  }

  /** Audit log — pełny, niemodyfikowalny, z filtrowaniem (§18). */
  @Get('audit-log')
  auditLog(
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('actorPersonId') actorPersonId?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(action && { action }),
        ...(resourceType && { resourceType }),
        ...(actorPersonId && { actorPersonId }),
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  /** Eksport asynchroniczny z filtrowaniem hierarchicznym (§18) — job workera. */
  @Post('exports')
  @HttpCode(202)
  createExport(
    @Headers('x-person-id') actorId: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          scopeUnitId: z.string().uuid().optional(),
          format: z.enum(['CSV', 'JSON', 'SQL']),
          fields: z.array(z.string()),
          anonymize: z.boolean().default(false),
          purpose: z.string().min(1).max(500),
        }),
      ),
    )
    body: { scopeUnitId?: string; format: string; fields: string[]; anonymize: boolean; purpose: string },
  ) {
    return this.prisma.exportJob.create({
      data: {
        requestedByPersonId: actorId,
        scopeUnitId: body.scopeUnitId ?? null,
        format: body.format,
        fields: body.fields,
        anonymize: body.anonymize,
        purpose: body.purpose,
      },
    });
  }

  @Get('exports/:id')
  getExport(@Param('id') id: string) {
    return this.prisma.exportJob.findUnique({ where: { id } });
  }

  /** Zdrowie systemu: kolejki, migracje, synchronizacje (§18). */
  @Get('system-health')
  async systemHealth() {
    const [pendingExports, pendingApprovals] = await Promise.all([
      this.prisma.exportJob.count({ where: { status: { in: ['PENDING', 'RUNNING'] } } }),
      this.prisma.pendingApproval.count({ where: { status: 'PENDING' } }),
    ]);
    return { database: 'ok', pendingExports, pendingApprovals, timestamp: new Date().toISOString() };
  }
}

/** Mapa publiczna (§15) — bez logowania, wyłącznie dane jednostek. */
@Controller('public')
export class PublicMapController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('map-units')
  async mapUnits(
    @Query('branch') branch?: 'HARCERZE' | 'HARCERKI',
    @Query('type') type?: string,
  ) {
    const units = await this.prisma.unit.findMany({
      where: {
        isPubliclyVisible: true,
        status: { in: ['ACTIVE', 'PROBATIONARY'] },
        ...(branch && { branch }),
        ...(type && { type: type as never }),
      },
      select: {
        id: true,
        type: true,
        branch: true,
        number: true,
        localityName: true,
        properName: true,
        patron: true,
        description: true,
        publicEmail: true,
        socialLinks: true,
        meetingPlace: true,
        locationPrecision: true,
      },
    });
    return units.map((u) => {
      const place = u.meetingPlace as { lat?: number; lng?: number; address?: string; meetingTimes?: string } | null;
      // APPROXIMATE: rozmycie ~500 m (deterministyczne, żeby pineska nie skakała).
      const blur = (v: number, seed: string): number => {
        const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
        return v + ((h % 100) - 50) * 0.0001;
      };
      const lat = place?.lat;
      const lng = place?.lng;
      return {
        id: u.id,
        displayName: unitDisplayName(u),
        branch: u.branch,
        type: u.type,
        description: u.description,
        publicEmail: u.publicEmail,
        socialLinks: u.socialLinks,
        meetingTimes: place?.meetingTimes ?? null,
        address: u.locationPrecision === 'EXACT' ? (place?.address ?? null) : null,
        lat: lat != null ? (u.locationPrecision === 'EXACT' ? lat : blur(lat, u.id)) : null,
        lng: lng != null ? (u.locationPrecision === 'EXACT' ? lng : blur(lng, u.id)) : null,
      };
    });
  }
}
