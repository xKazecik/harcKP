import { describe, expect, it, beforeEach } from 'vitest';
import 'reflect-metadata';
import { CreateUnitUseCase, UnitHierarchyError } from './create-unit.usecase.js';
import type {
  CreateUnitData,
  ListUnitsFilter,
  UnitRecord,
  UnitRepository,
  UpdateUnitData,
} from './unit-repository.port.js';

/** Repozytorium in-memory — testy use case'ów bez bazy. */
class InMemoryUnitRepository implements UnitRepository {
  private readonly units = new Map<string, UnitRecord>();
  private seq = 0;

  seed(partial: Partial<UnitRecord> & Pick<UnitRecord, 'type' | 'branch'>): UnitRecord {
    const unit: UnitRecord = {
      id: partial.id ?? `unit-${++this.seq}`,
      parentId: partial.parentId ?? null,
      number: partial.number ?? null,
      localityName: partial.localityName ?? 'Testowa',
      properName: partial.properName ?? null,
      patron: partial.patron ?? null,
      status: partial.status ?? 'ACTIVE',
      description: null,
      publicEmail: null,
      socialLinks: null,
      meetingPlace: null,
      locationPrecision: 'EXACT',
      isPubliclyVisible: false,
      type: partial.type,
      branch: partial.branch,
    };
    this.units.set(unit.id, unit);
    return unit;
  }

  async findById(id: string): Promise<UnitRecord | null> {
    return this.units.get(id) ?? null;
  }

  async create(data: CreateUnitData): Promise<UnitRecord> {
    return this.seed({ ...data, status: 'PROBATIONARY' });
  }

  async update(id: string, data: UpdateUnitData): Promise<UnitRecord> {
    const u = this.units.get(id);
    if (!u) throw new Error('not found');
    const next = { ...u, ...data } as UnitRecord;
    this.units.set(id, next);
    return next;
  }

  async list(_filter: ListUnitsFilter): Promise<UnitRecord[]> {
    return [...this.units.values()];
  }

  async findSubtree(rootId: string): Promise<UnitRecord[]> {
    const all = [...this.units.values()];
    const result: UnitRecord[] = [];
    const queue = [rootId];
    while (queue.length) {
      const id = queue.shift();
      const u = all.find((x) => x.id === id);
      if (u) {
        result.push(u);
        queue.push(...all.filter((x) => x.parentId === u.id).map((x) => x.id));
      }
    }
    return result;
  }
}

describe('CreateUnitUseCase (§6.1)', () => {
  let repo: InMemoryUnitRepository;
  let useCase: CreateUnitUseCase;

  beforeEach(() => {
    repo = new InMemoryUnitRepository();
    useCase = new CreateUnitUseCase(repo);
  });

  it('tworzy drużynę pod hufcem ze statusem PROBATIONARY', async () => {
    const hufiec = repo.seed({ type: 'HUFIEC', branch: 'HARCERZE' });
    const unit = await useCase.execute({
      type: 'DRUZYNA',
      branch: 'HARCERZE',
      parentId: hufiec.id,
      number: '1',
      localityName: 'Sucholeska',
      properName: 'Grań',
      patron: null,
    });
    expect(unit.status).toBe('PROBATIONARY');
    expect(unit.parentId).toBe(hufiec.id);
  });

  it('alias: tworzy drużynę pod ZWIAZKIEM_DRUZYN (≡ hufiec)', async () => {
    const zd = repo.seed({ type: 'ZWIAZEK_DRUZYN', branch: 'HARCERKI' });
    const unit = await useCase.execute({
      type: 'DRUZYNA',
      branch: 'HARCERKI',
      parentId: zd.id,
      number: null,
      localityName: 'Pomorska',
      properName: null,
      patron: null,
    });
    expect(unit.parentId).toBe(zd.id);
  });

  it('NEGATYWNY: drużyna pod chorągwią → INVALID_PARENT_TYPE', async () => {
    const choragiew = repo.seed({ type: 'CHORAGIEW', branch: 'HARCERZE' });
    await expect(
      useCase.execute({
        type: 'DRUZYNA',
        branch: 'HARCERZE',
        parentId: choragiew.id,
        number: null,
        localityName: 'X',
        properName: null,
        patron: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PARENT_TYPE' });
  });

  it('NEGATYWNY: niezgodność gałęzi → BRANCH_MISMATCH', async () => {
    const hufiec = repo.seed({ type: 'HUFIEC', branch: 'HARCERZE' });
    await expect(
      useCase.execute({
        type: 'DRUZYNA',
        branch: 'HARCERKI',
        parentId: hufiec.id,
        number: null,
        localityName: 'X',
        properName: null,
        patron: null,
      }),
    ).rejects.toMatchObject({ code: 'BRANCH_MISMATCH' });
  });

  it('NEGATYWNY: nieistniejący rodzic → PARENT_NOT_FOUND', async () => {
    await expect(
      useCase.execute({
        type: 'DRUZYNA',
        branch: 'HARCERZE',
        parentId: 'brak',
        number: null,
        localityName: 'X',
        properName: null,
        patron: null,
      }),
    ).rejects.toBeInstanceOf(UnitHierarchyError);
  });

  it('NEGATYWNY: hufiec bez rodzica → PARENT_REQUIRED', async () => {
    await expect(
      useCase.execute({
        type: 'HUFIEC',
        branch: 'HARCERZE',
        parentId: null,
        number: null,
        localityName: 'X',
        properName: null,
        patron: null,
      }),
    ).rejects.toMatchObject({ code: 'PARENT_REQUIRED' });
  });
});
