import { Injectable } from '@nestjs/common';
import type { Invitation } from '@harc/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  InvitationRecord,
  InvitationRepository,
} from '../../application/persons/ports.js';

function toRecord(i: Invitation): InvitationRecord {
  return {
    id: i.id,
    personId: i.personId,
    createdByPersonId: i.createdByPersonId,
    createdAt: i.createdAt,
    expiresAt: i.expiresAt,
    usedAt: i.usedAt,
    revokedAt: i.revokedAt,
    lastSentAt: i.lastSentAt,
  };
}

/** Repozytorium zaproszeń (infrastructure). Token wyłącznie jako hash (§8.2). */
@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Parameters<InvitationRepository['create']>[0]): Promise<InvitationRecord> {
    const i = await this.prisma.invitation.create({ data });
    return toRecord(i);
  }

  async findByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
    const i = await this.prisma.invitation.findUnique({ where: { tokenHash } });
    return i ? toRecord(i) : null;
  }

  async findById(id: string): Promise<InvitationRecord | null> {
    const i = await this.prisma.invitation.findUnique({ where: { id } });
    return i ? toRecord(i) : null;
  }

  async findActiveByPersonId(personId: string): Promise<InvitationRecord | null> {
    const i = await this.prisma.invitation.findFirst({
      where: { personId, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return i ? toRecord(i) : null;
  }

  async update(
    id: string,
    data: Parameters<InvitationRepository['update']>[1],
  ): Promise<InvitationRecord> {
    const i = await this.prisma.invitation.update({ where: { id }, data });
    return toRecord(i);
  }

  async list(filter: { pending?: boolean; expired?: boolean }): Promise<InvitationRecord[]> {
    const now = new Date();
    const rows = await this.prisma.invitation.findMany({
      where: filter.pending
        ? { usedAt: null, revokedAt: null, expiresAt: { gt: now } }
        : filter.expired
          ? { usedAt: null, revokedAt: null, expiresAt: { lte: now } }
          : {},
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}
