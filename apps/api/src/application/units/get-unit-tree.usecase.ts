import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { unitDisplayName } from '@harc/domain';
import type { UnitTreeNode } from '@harc/contracts';
import {
  UNIT_REPOSITORY,
  type UnitRecord,
  type UnitRepository,
} from './unit-repository.port.js';

/**
 * Buduje drzewo poddrzewa jednostki z generowanymi nazwami (§6.2).
 */
@Injectable()
export class GetUnitTreeUseCase {
  constructor(@Inject(UNIT_REPOSITORY) private readonly units: UnitRepository) {}

  /**
   * @param rootId - korzeń poddrzewa
   * @returns drzewo z displayName per węzeł
   * @throws NotFoundException gdy korzeń nie istnieje
   */
  async execute(rootId: string): Promise<UnitTreeNode> {
    const all = await this.units.findSubtree(rootId);
    const root = all.find((u) => u.id === rootId);
    if (!root) throw new NotFoundException('Jednostka nie istnieje');

    const byParent = new Map<string | null, UnitRecord[]>();
    for (const u of all) {
      const list = byParent.get(u.parentId) ?? [];
      list.push(u);
      byParent.set(u.parentId, list);
    }

    const toNode = (u: UnitRecord): UnitTreeNode => ({
      id: u.id,
      type: u.type,
      branch: u.branch,
      status: u.status,
      displayName: unitDisplayName(u),
      children: (byParent.get(u.id) ?? []).map(toNode),
    });

    return toNode(root);
  }
}
