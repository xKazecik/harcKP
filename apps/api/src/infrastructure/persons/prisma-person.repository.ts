import { Injectable } from '@nestjs/common';
import type { Person } from '@harc/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  GuardianRecord,
  PersonRecord,
  PersonRepository,
} from '../../application/persons/ports.js';

function toRecord(p: Person): PersonRecord {
  return {
    id: p.id,
    keycloakUserId: p.keycloakUserId,
    status: p.status,
    email: p.email,
    historicalEmail: p.historicalEmail,
    firstName: p.firstName,
    lastName: p.lastName,
    birthDate: p.birthDate,
    school: p.school,
    phone: p.phone,
    branch: p.branch,
    crossNumber: p.crossNumber,
    promiseDate: p.promiseDate,
    archivedAt: p.archivedAt,
    archiveReason: p.archiveReason,
    invitedToUnitId: p.invitedToUnitId,
  };
}

/**
 * Repozytorium osób (infrastructure).
 *
 * @remarks emailTaken() odzwierciedla indeks częściowy person_active_email_unique
 * (§8.4): unikalność TYLKO wśród INVITED/ACTIVE, historicalEmail bez ograniczeń.
 */
@Injectable()
export class PrismaPersonRepository implements PersonRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PersonRecord | null> {
    const p = await this.prisma.person.findUnique({ where: { id } });
    return p ? toRecord(p) : null;
  }

  async emailTaken(email: string): Promise<boolean> {
    const count = await this.prisma.person.count({
      where: {
        email: { equals: email, mode: 'insensitive' },
        status: { in: ['INVITED', 'ACTIVE'] },
      },
    });
    return count > 0;
  }

  async create(data: Parameters<PersonRepository['create']>[0]): Promise<PersonRecord> {
    const p = await this.prisma.person.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        branch: data.branch,
        status: data.status,
        invitedToUnitId: data.invitedToUnitId,
      },
    });
    return toRecord(p);
  }

  async update(id: string, data: Partial<Omit<PersonRecord, 'id'>>): Promise<PersonRecord> {
    const p = await this.prisma.person.update({
      where: { id },
      data: {
        keycloakUserId: data.keycloakUserId,
        status: data.status,
        email: data.email,
        historicalEmail: data.historicalEmail,
        birthDate: data.birthDate,
        school: data.school,
        phone: data.phone,
        crossNumber: data.crossNumber,
        promiseDate: data.promiseDate,
        archivedAt: data.archivedAt,
        archiveReason: data.archiveReason as never,
      },
    });
    return toRecord(p);
  }

  async listGuardians(personId: string): Promise<GuardianRecord[]> {
    const rows = await this.prisma.guardian.findMany({ where: { personId } });
    return rows.map((g) => ({
      id: g.id,
      personId: g.personId,
      fullName: g.fullName,
      consentGivenAt: g.consentGivenAt,
    }));
  }

  async addGuardian(
    personId: string,
    data: Parameters<PersonRepository['addGuardian']>[1],
  ): Promise<GuardianRecord> {
    const g = await this.prisma.guardian.create({
      data: {
        personId,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        address: data.address,
        // NULL = zgoda jeszcze nieodnotowana (decyzja 2026-07-31 — przypomnienie).
        consentGivenAt: data.consentGivenAt,
        consentDocumentRef: data.consentDocumentRef,
      },
    });
    return {
      id: g.id,
      personId: g.personId,
      fullName: g.fullName,
      consentGivenAt: g.consentGivenAt,
    };
  }

  async listArchived(): Promise<PersonRecord[]> {
    const rows = await this.prisma.person.findMany({
      where: { status: 'ARCHIVED' },
      orderBy: { archivedAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
