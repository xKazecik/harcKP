import { Inject, Injectable } from '@nestjs/common';
import { validateUnitParent, type HierarchyViolation } from '@harc/domain';
import {
  UNIT_REPOSITORY,
  type CreateUnitData,
  type UnitRecord,
  type UnitRepository,
} from './unit-repository.port.js';

/** Błąd domenowy tworzenia jednostki — kontroler mapuje na 422. */
export class UnitHierarchyError extends Error {
  constructor(public readonly code: HierarchyViolation | 'PARENT_NOT_FOUND') {
    super(`Naruszenie hierarchii jednostek: ${code}`);
    this.name = 'UnitHierarchyError';
  }
}

/**
 * Tworzy jednostkę z walidacją hierarchii (§6.1).
 *
 * @remarks Walidacja przechodzi przez domain → validateUnitParent(), które
 * normalizuje aliasy statutowe (NAMIESTNICTWO≡CHORAGIEW, ZWIAZEK_DRUZYN≡HUFIEC).
 * Status początkowy PROBATIONARY — formalne powołanie rozkazem (FOUND_UNIT)
 * dopnie foundedByOrderId w etapie 6.
 * @throws UnitHierarchyError gdy rodzic nie istnieje albo hierarchia jest błędna
 */
@Injectable()
export class CreateUnitUseCase {
  constructor(@Inject(UNIT_REPOSITORY) private readonly units: UnitRepository) {}

  async execute(input: CreateUnitData): Promise<UnitRecord> {
    let parent: UnitRecord | null = null;
    if (input.parentId) {
      parent = await this.units.findById(input.parentId);
      if (!parent) throw new UnitHierarchyError('PARENT_NOT_FOUND');
    }
    const violation = validateUnitParent({
      childType: input.type,
      childBranch: input.branch,
      parentType: parent?.type ?? null,
      parentBranch: parent?.branch ?? null,
    });
    if (violation) throw new UnitHierarchyError(violation);
    return this.units.create(input);
  }
}
