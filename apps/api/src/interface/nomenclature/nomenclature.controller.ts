import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { BranchSchema, UnitTypeSchema } from '@harc/contracts';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

const QuerySchema = z.object({
  unitType: UnitTypeSchema.optional(),
  branch: BranchSchema.optional(),
});
type NomenclatureQuery = z.infer<typeof QuerySchema>;

/**
 * Nomenklatura (§6.4) — źródło etykiet funkcyjnych dla frontendu.
 *
 * @remarks Frontend NIGDY nie buduje etykiet warunkami if — pobiera je stąd.
 * Aliasy statutowe mają własne wiersze w tabeli (etykieta "Namiestnik" ≠
 * "Komendant Chorągwi"), bo nomenklatura to warstwa prezentacji, nie uprawnień.
 */
@Controller('nomenclature')
export class NomenclatureController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(QuerySchema)) query: NomenclatureQuery,
  ): Promise<Array<{ unitType: string; branch: string; roleKey: string; label: string }>> {
    return this.prisma.nomenclature.findMany({
      where: { unitType: query.unitType, branch: query.branch },
      select: { unitType: true, branch: true, roleKey: true, label: true },
      orderBy: [{ unitType: 'asc' }, { branch: 'asc' }, { roleKey: 'asc' }],
    });
  }
}
