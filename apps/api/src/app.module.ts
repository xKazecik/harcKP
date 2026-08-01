import { Module } from '@nestjs/common';
import { HealthController } from './interface/health.controller';
import { UnitsController } from './interface/units/units.controller';
import { NomenclatureController } from './interface/nomenclature/nomenclature.controller';
import { PersonsController } from './interface/persons/persons.controller';
import { InvitationsController } from './interface/persons/invitations.controller';
import {
  InstructorsController,
  OrdersController,
  PlanningController,
  ProgressionController,
} from './interface/modules.controller';
import { AdminController, PublicMapController } from './interface/admin.controller';
import { DirectoryController } from './interface/directory.controller';
import { ConfigService } from './infrastructure/config/config.service';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaUnitRepository } from './infrastructure/units/prisma-unit.repository';
import { PrismaPersonRepository } from './infrastructure/persons/prisma-person.repository';
import { PrismaInvitationRepository } from './infrastructure/persons/prisma-invitation.repository';
import { KeycloakAdminClient } from './infrastructure/keycloak/keycloak-admin.client';
import { CryptoTokenService, PrismaAuditLog, SmtpMailer } from './infrastructure/persons/services';
import { UNIT_REPOSITORY } from './application/units/unit-repository.port';
import { CreateUnitUseCase } from './application/units/create-unit.usecase';
import { GetUnitTreeUseCase } from './application/units/get-unit-tree.usecase';
import {
  AUDIT_LOG,
  INVITATION_REPOSITORY,
  KEYCLOAK_ADMIN,
  MAILER,
  PERSON_REPOSITORY,
  TOKEN_SERVICE,
} from './application/persons/ports';
import { InvitePersonUseCase } from './application/persons/invite-person.usecase';
import { AcceptInvitationUseCase } from './application/persons/accept-invitation.usecase';
import { InvitationAdminUseCase } from './application/persons/invitation-admin.usecase';
import { ArchivePersonUseCase } from './application/persons/archive-person.usecase';
import { RestorePersonUseCase } from './application/persons/restore-person.usecase';
import { PersonProfileUseCase } from './application/persons/person-profile.usecase';
import { InstructorsService } from './application/instructors/instructors.service';
import { CreateInstructorUseCase } from './application/instructors/create-instructor.usecase';
import { AuthorizationService } from './application/authorization/authorization.service';
import { OrdersService } from './application/orders/orders.service';
import { ProgressionService } from './application/progression/progression.service';
import {
  CategorizationService,
  InstructorCensusService,
  UnitCensusService,
  WorkPlanService,
} from './application/planning/planning.services';

/** Moduł główny API HARC — etapy 1–12 (§3, Clean Architecture). */
@Module({
  controllers: [
    HealthController,
    UnitsController,
    NomenclatureController,
    PersonsController,
    InvitationsController,
    InstructorsController,
    OrdersController,
    ProgressionController,
    PlanningController,
    AdminController,
    PublicMapController,
    DirectoryController,
  ],
  providers: [
    PrismaService,
    ConfigService,
    { provide: UNIT_REPOSITORY, useClass: PrismaUnitRepository },
    { provide: PERSON_REPOSITORY, useClass: PrismaPersonRepository },
    { provide: INVITATION_REPOSITORY, useClass: PrismaInvitationRepository },
    { provide: KEYCLOAK_ADMIN, useClass: KeycloakAdminClient },
    { provide: MAILER, useClass: SmtpMailer },
    { provide: TOKEN_SERVICE, useClass: CryptoTokenService },
    { provide: AUDIT_LOG, useClass: PrismaAuditLog },
    CreateUnitUseCase,
    GetUnitTreeUseCase,
    InvitePersonUseCase,
    AcceptInvitationUseCase,
    InvitationAdminUseCase,
    ArchivePersonUseCase,
    RestorePersonUseCase,
    PersonProfileUseCase,
    InstructorsService,
    CreateInstructorUseCase,
    AuthorizationService,
    OrdersService,
    ProgressionService,
    InstructorCensusService,
    UnitCensusService,
    WorkPlanService,
    CategorizationService,
  ],
  exports: [ConfigService],
})
export class AppModule {}
