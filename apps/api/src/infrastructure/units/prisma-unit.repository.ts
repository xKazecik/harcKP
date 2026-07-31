import { Injectable } from '@nestjs/common';
import type { Unit } from '@harc/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateUnitData,
  ListUnitsFilter,
  UnitRecord,
  UnitRepository,
  UpdateUnitData,
} from '../../application/units/unit-repository.port.js';

/** Mapowanie encji Prisma → migawka warstwy aplikacji. */
function toRecord(u: Unit): UnitRecord {
  return {
    id: u.id,
    type: u.type,
    branch: u.branch,
    parentId: u.parentId,
    number: u.number,
    localityName: u.localityName,
    properName: u.properName,
    patron: u.patron,
    status: u.status,
    description: u.description,
    publicEmail: u.publicEmail,
    socialLinks: u.socialLinks,
    meetingPlace: u.meetingPlace,
    locationPrecision: u.locationPrecision,
    isPubliclyVisible: u.isPubliclyVisible,
  };
}

/**
 * Repozytorium jednostek na Prisma (infrastructure).
 *
 * @remarks findSubtree używa rekurencyjnego CTE — drzewa są płytkie
 * (organizacja→chorągiew→hufiec→drużyna), ale liczba jednostek może być duża.
 */
@Injectable()
export class PrismaUnitRepository implements UnitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UnitRecord | null> {
    const u = await this.prisma.unit.findUnique({ where: { id } });
    return u ? toRecord(u) : null;
  }

  async create(data: CreateUnitData): Promise<UnitRecord> {
    const u = await this.prisma.unit.create({
      data: {
        type: data.type,
        branch: data.branch,
        parentId: data.parentId,
        number: data.number,
        localityName: data.localityName,
        properName: data.properName,
        patron: data.patron,
      },
    });
    return toRecord(u);
  }

  async update(id: string, data: UpdateUnitData): Promise<UnitRecord> {
    const u = await this.prisma.unit.update({
      where: { id },
      data: {
        ...data,
        socialLinks: data.socialLinks as object | undefined,
        meetingPlace: data.meetingPlace as object | undefined,
      },
    });
    return toRecord(u);
  }

  async list(filter: ListUnitsFilter): Promise<UnitRecord[]> {
    const units = await this.prisma.unit.findMany({
      where: {
        type: filter.type,
        branch: filter.branch,
        parentId: filter.parentId,
        status: filter.status,
      },
      orderBy: [{ type: 'asc' }, { localityName: 'asc' }],
    });
    return units.map(toRecord);
  }

  async findSubtree(rootId: string): Promise<UnitRecord[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "Unit" WHERE id = ${rootId}
        UNION ALL
        SELECT u.id FROM "Unit" u JOIN subtree s ON u."parentId" = s.id
      )
      SELECT id FROM subtree
    `;
    const units = await this.prisma.unit.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
    return units.map(toRecord);
  }
}
