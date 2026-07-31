import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CreateUnitSchema,
  ListUnitsQuerySchema,
  UpdateUnitSchema,
  type CreateUnit,
  type ListUnitsQuery,
  type UnitTreeNode,
  type UpdateUnit,
} from '@harc/contracts';
import { unitDisplayName } from '@harc/domain';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  CreateUnitUseCase,
  UnitHierarchyError,
} from '../../application/units/create-unit.usecase.js';
import { GetUnitTreeUseCase } from '../../application/units/get-unit-tree.usecase.js';
import {
  UNIT_REPOSITORY,
  type UnitRecord,
  type UnitRepository,
} from '../../application/units/unit-repository.port.js';
import { Inject } from '@nestjs/common';

/** Odpowiedź API — jednostka z wygenerowaną nazwą (§6.2). */
type UnitResponse = UnitRecord & { displayName: string };

function withDisplayName(u: UnitRecord): UnitResponse {
  return { ...u, displayName: unitDisplayName(u) };
}

/**
 * CRUD jednostek (etap 2 — bez autoryzacji; AuthorizationService wejdzie
 * w etapie 5 i zepnie każdą operację z macierzą kompetencji).
 */
@Controller('units')
export class UnitsController {
  constructor(
    private readonly createUnit: CreateUnitUseCase,
    private readonly getTree: GetUnitTreeUseCase,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
  ) {}

  /**
   * Tworzy jednostkę.
   * @throws 422 UNIT_HIERARCHY_VIOLATION przy błędnym umocowaniu w drzewie
   */
  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(CreateUnitSchema)) body: CreateUnit,
  ): Promise<UnitResponse> {
    try {
      const unit = await this.createUnit.execute({
        type: body.type,
        branch: body.branch,
        parentId: body.parentId ?? null,
        number: body.number ?? null,
        localityName: body.localityName,
        properName: body.properName ?? null,
        patron: body.patron ?? null,
      });
      return withDisplayName(unit);
    } catch (err) {
      if (err instanceof UnitHierarchyError) {
        throw new UnprocessableEntityException({
          code: 'UNIT_HIERARCHY_VIOLATION',
          violation: err.code,
        });
      }
      throw err;
    }
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListUnitsQuerySchema)) query: ListUnitsQuery,
  ): Promise<UnitResponse[]> {
    const units = await this.units.list(query);
    return units.map(withDisplayName);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<UnitResponse> {
    const unit = await this.units.findById(id);
    if (!unit) throw new NotFoundException('Jednostka nie istnieje');
    return withDisplayName(unit);
  }

  @Get(':id/tree')
  async tree(@Param('id', ParseUUIDPipe) id: string): Promise<UnitTreeNode> {
    return this.getTree.execute(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUnitSchema)) body: UpdateUnit,
  ): Promise<UnitResponse> {
    const existing = await this.units.findById(id);
    if (!existing) throw new NotFoundException('Jednostka nie istnieje');
    const unit = await this.units.update(id, body);
    return withDisplayName(unit);
  }
}
