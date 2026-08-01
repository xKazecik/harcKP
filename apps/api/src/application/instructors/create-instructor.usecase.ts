import { Inject, Injectable } from '@nestjs/common';
import type { Branch, InstructorRank } from '@harc/domain';
import { PERSON_REPOSITORY, type PersonRepository } from '../persons/ports.js';
import { InvitePersonUseCase } from '../persons/invite-person.usecase.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { InstructorsService } from './instructors.service.js';

export interface CreateInstructorInput {
  firstName: string;
  lastName: string;
  /** Gdy podany — osoba dostaje zaproszenie i konto; gdy brak — profil bez konta. */
  email?: string | undefined;
  branch: Branch;
  homeChoragiewId: string;
  rank: InstructorRank;
  rankAwardedAt: Date;
  listType: 'CZYNNY' | 'WSPIERAJACY';
  mainAssignmentLevel: 'HUFIEC' | 'CHORAGIEW' | 'GK' | 'WLADZE_NACZELNE' | 'POZA_PIONEM_WYCHOWAWCZYM';
  mainAssignmentUnitId?: string | undefined;
  instructorPledgeDate?: Date | undefined;
  createdByPersonId: string;
}

/**
 * Przyjęcie instruktora i wpis na listę (§7.3) w jednym kroku.
 *
 * Łączy dwie istniejące operacje, zamiast dublować ich logikę: założenie osoby
 * (zaproszenie z kontem albo profil bez konta, §8.2) i utworzenie profilu RSI.
 *
 * @remarks Zobowiązanie Instruktorskie jest osobnym zdarzeniem ewidencyjnym
 * (§12.4) — tutaj zapisujemy wyłącznie jego datę, jeśli została podana.
 * Formalne przyjęcie i wpis na listę należą do zwierzchnika i wymagają rozkazu;
 * ten use case odwzorowuje skutek ewidencyjny, nie zastępuje rozkazu.
 */
@Injectable()
export class CreateInstructorUseCase {
  constructor(
    @Inject(PERSON_REPOSITORY) private readonly persons: PersonRepository,
    private readonly invite: InvitePersonUseCase,
    private readonly instructors: InstructorsService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: CreateInstructorInput): Promise<{ personId: string; invited: boolean }> {
    // Przydział służbowy albo — gdy go nie podano — chorągiew przynależności.
    const unitId = input.mainAssignmentUnitId ?? input.homeChoragiewId;

    let personId: string;
    let invited = false;

    if (input.email) {
      const result = await this.invite.execute({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        branch: input.branch,
        unitId,
        invitedByPersonId: input.createdByPersonId,
      });
      personId = result.person.id;
      invited = true;
    } else {
      // Profil bez konta (§8.2) — pełnoprawny ewidencyjnie, bez logowania.
      const person = await this.persons.create({
        firstName: input.firstName,
        lastName: input.lastName,
        email: null,
        branch: input.branch,
        status: 'ACTIVE',
        invitedToUnitId: unitId,
      });
      personId = person.id;
    }

    // Instruktor jest osobą pełnoletnią po Zobowiązaniu — kategoria członkostwa
    // musi to odzwierciedlać, inaczej spisy i filtry policzą go jako uczestnika.
    await this.prisma.person.update({
      where: { id: personId },
      data: {
        membershipCategory: 'INSTRUKTOR',
        ...(input.instructorPledgeDate && { instructorPledgeDate: input.instructorPledgeDate }),
      },
    });

    await this.prisma.unitMembership.create({ data: { unitId, personId } });

    await this.instructors.upsertProfile(personId, {
      rank: input.rank,
      rankAwardedAt: input.rankAwardedAt,
      listType: input.listType,
      homeChoragiewId: input.homeChoragiewId,
      mainAssignmentLevel: input.mainAssignmentLevel,
      mainAssignmentUnitId: input.mainAssignmentUnitId ?? null,
    });

    return { personId, invited };
  }
}
