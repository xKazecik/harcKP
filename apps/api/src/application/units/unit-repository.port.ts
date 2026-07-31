import type { UnitType, Branch } from '@harc/domain';

/** Migawka jednostki w warstwie aplikacji — bez typów Prisma (Clean Architecture). */
export interface UnitRecord {
  id: string;
  type: UnitType;
  branch: Branch;
  parentId: string | null;
  number: string | null;
  localityName: string;
  properName: string | null;
  patron: string | null;
  status: 'PROBATIONARY' | 'ACTIVE' | 'SUSPENDED' | 'DISSOLVED';
  description: string | null;
  publicEmail: string | null;
  socialLinks: unknown;
  meetingPlace: unknown;
  locationPrecision: 'EXACT' | 'APPROXIMATE';
  isPubliclyVisible: boolean;
}

export interface CreateUnitData {
  type: UnitType;
  branch: Branch;
  parentId: string | null;
  number: string | null;
  localityName: string;
  properName: string | null;
  patron: string | null;
}

export interface UpdateUnitData {
  number?: string | null;
  localityName?: string;
  properName?: string | null;
  patron?: string | null;
  description?: string | null;
  publicEmail?: string | null;
  socialLinks?: unknown;
  meetingPlace?: unknown;
  locationPrecision?: 'EXACT' | 'APPROXIMATE';
  isPubliclyVisible?: boolean;
}

export interface ListUnitsFilter {
  type?: UnitType;
  branch?: Branch;
  parentId?: string;
  status?: UnitRecord['status'];
}

/** Token DI portu repozytorium jednostek. */
export const UNIT_REPOSITORY = Symbol('UNIT_REPOSITORY');

/**
 * Port repozytorium jednostek (application → infrastructure).
 */
export interface UnitRepository {
  findById(id: string): Promise<UnitRecord | null>;
  create(data: CreateUnitData): Promise<UnitRecord>;
  update(id: string, data: UpdateUnitData): Promise<UnitRecord>;
  list(filter: ListUnitsFilter): Promise<UnitRecord[]>;
  /** Wszystkie jednostki poddrzewa (łącznie z korzeniem) — do budowy drzewa. */
  findSubtree(rootId: string): Promise<UnitRecord[]>;
}
