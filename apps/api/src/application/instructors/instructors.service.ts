import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  checkAppointmentEligibility,
  getSupervisor,
  type InstructorRank,
  type SupervisorRef,
} from '@harc/domain';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * Instruktorzy (§7.3) — profil RSI, zwierzchnik, urlop, przeniesienia.
 *
 * @remarks Serwis celowo cienki nad Prisma: reguły (zwierzchnik, blokada
 * mianowania) są w @harc/domain i mają tam testy.
 */
@Injectable()
export class InstructorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(personId: string) {
    const profile = await this.prisma.instructorProfile.findUnique({ where: { personId } });
    if (!profile) throw new NotFoundException('Brak profilu instruktorskiego');
    return {
      ...profile,
      supervisor: getSupervisor(profile.rank, profile.homeChoragiewId) satisfies SupervisorRef,
    };
  }

  /** Wpis na listę instruktorów — tworzy/aktualizuje profil RSI. */
  async upsertProfile(personId: string, data: {
    rank: InstructorRank;
    rankAwardedAt: Date;
    listType: 'CZYNNY' | 'WSPIERAJACY';
    homeChoragiewId: string;
    mainAssignmentLevel: 'HUFIEC' | 'CHORAGIEW' | 'GK' | 'WLADZE_NACZELNE' | 'POZA_PIONEM_WYCHOWAWCZYM';
    mainAssignmentUnitId?: string | null;
  }) {
    return this.prisma.instructorProfile.upsert({
      where: { personId },
      update: data,
      create: { personId, ...data },
    });
  }

  /**
   * Walidacja przed mianowaniem na funkcję wychowawczą (§7.3).
   * @throws 422 MINOR_PROTECTION_NOT_VERIFIED
   */
  async assertAppointable(personId: string): Promise<void> {
    const profile = await this.prisma.instructorProfile.findUnique({ where: { personId } });
    const error = checkAppointmentEligibility({
      minorProtectionValidUntil: profile?.minorProtectionValidUntil ?? null,
      standardsAcknowledgedAt: profile?.standardsAcknowledgedAt ?? null,
      now: new Date(),
    });
    if (error) {
      throw new UnprocessableEntityException({ code: error });
    }
  }

  /** Urlop instruktorski (§7.3): 1 miesiąc – 2 lata; zawiesza wymagalność spisu. */
  async grantLeave(personId: string, until: Date): Promise<void> {
    const min = new Date();
    min.setMonth(min.getMonth() + 1);
    const max = new Date();
    max.setFullYear(max.getFullYear() + 2);
    if (until < min || until > max) {
      throw new UnprocessableEntityException({ code: 'LEAVE_DURATION_OUT_OF_RANGE' });
    }
    await this.prisma.instructorProfile.update({
      where: { personId },
      data: { onLeaveUntil: until },
    });
  }

  /** Przeniesienie przynależności (§7.3) — proces dwustronny. */
  async requestTransfer(personId: string, toChoragiewId: string) {
    const profile = await this.prisma.instructorProfile.findUnique({ where: { personId } });
    if (!profile) throw new NotFoundException('Brak profilu instruktorskiego');
    if (profile.homeChoragiewId === toChoragiewId) {
      throw new ConflictException({ code: 'TRANSFER_SAME_CHORAGIEW' });
    }
    return this.prisma.transferRequest.create({
      data: {
        instructorPersonId: personId,
        fromChoragiewId: profile.homeChoragiewId,
        toChoragiewId,
      },
    });
  }

  /** Kolejne akceptacje: oddający → przyjmujący → rozliczenie z funkcji. */
  async advanceTransfer(
    transferId: string,
    step: 'FROM_APPROVED' | 'TO_APPROVED' | 'SETTLEMENT_CONFIRMED' | 'REJECTED',
  ) {
    const t = await this.prisma.transferRequest.findUnique({ where: { id: transferId } });
    if (!t || t.decidedAt) throw new NotFoundException('Wniosek nie istnieje albo zamknięty');
    const now = new Date();
    if (step === 'REJECTED') {
      return this.prisma.transferRequest.update({
        where: { id: transferId },
        data: { status: 'REJECTED', decidedAt: now },
      });
    }
    if (step === 'FROM_APPROVED' && t.status === 'PENDING_FROM') {
      return this.prisma.transferRequest.update({
        where: { id: transferId },
        data: { status: 'PENDING_TO', fromApprovedAt: now },
      });
    }
    if (step === 'TO_APPROVED' && t.status === 'PENDING_TO') {
      return this.prisma.transferRequest.update({
        where: { id: transferId },
        data: { status: 'PENDING_SETTLEMENT', toApprovedAt: now },
      });
    }
    if (step === 'SETTLEMENT_CONFIRMED' && t.status === 'PENDING_SETTLEMENT') {
      const updated = await this.prisma.transferRequest.update({
        where: { id: transferId },
        data: { status: 'APPROVED', settlementConfirmedAt: now, decidedAt: now },
      });
      await this.prisma.instructorProfile.update({
        where: { personId: t.instructorPersonId },
        data: { homeChoragiewId: t.toChoragiewId },
      });
      return updated;
    }
    throw new ConflictException({ code: 'TRANSFER_INVALID_STEP', current: t.status });
  }
}
