/**
 * Kontrolery etapów 4–8. Autoryzacja: nagłówki X-Person-Id / X-Root (dev);
 * guard OIDC wchodzi w miejsce nagłówków bez zmiany sygnatur (etap 12 infra).
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { AddOrderItemSchema, CreateOrderSchema } from '@harc/contracts';
import { ZodValidationPipe } from './zod-validation.pipe.js';
import { InstructorsService } from '../application/instructors/instructors.service.js';
import { CreateInstructorUseCase } from '../application/instructors/create-instructor.usecase.js';
import { AuthorizationService } from '../application/authorization/authorization.service.js';
import { OrdersService } from '../application/orders/orders.service.js';
import { ProgressionService } from '../application/progression/progression.service.js';
import {
  CategorizationService,
  InstructorCensusService,
  UnitCensusService,
  WorkPlanService,
} from '../application/planning/planning.services.js';

const isRoot = (h?: string): boolean => h === 'true';

/** Przyjęcie instruktora i wpis na listę (§7.3, §11.2 ENROLL_ON_INSTRUCTOR_LIST). */
const CreateInstructorSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  branch: z.enum(['HARCERZE', 'HARCERKI']),
  homeChoragiewId: z.string().uuid(),
  rank: z.enum(['PRZEWODNIK', 'PODHARCMISTRZ', 'HARCMISTRZ']),
  rankAwardedAt: z.string().date(),
  listType: z.enum(['CZYNNY', 'WSPIERAJACY']),
  mainAssignmentLevel: z.enum([
    'HUFIEC',
    'CHORAGIEW',
    'GK',
    'WLADZE_NACZELNE',
    'POZA_PIONEM_WYCHOWAWCZYM',
  ]),
  mainAssignmentUnitId: z.string().uuid().optional(),
  instructorPledgeDate: z.string().date().optional(),
});

@Controller('instructors')
export class InstructorsController {
  constructor(
    private readonly service: InstructorsService,
    private readonly createInstructor: CreateInstructorUseCase,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * Przyjmuje instruktora: zakłada osobę (z kontem albo bez) i profil RSI.
   *
   * Kompetencja `ADMIT_INSTRUCTOR` należy do poziomu chorągwi i wyżej (§10.2) —
   * drużynowy ani hufcowy nie przyjmują instruktorów. Root i sysadmin przechodzą
   * przez tę samą ścieżkę autoryzacji, bez wyjątku w kontrolerze.
   *
   * @throws 403 FORBIDDEN gdy aktor nie ma kompetencji w tej chorągwi
   * @throws 409 EMAIL_ALREADY_IN_USE gdy adres należy do aktywnego profilu
   */
  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(CreateInstructorSchema))
    body: z.infer<typeof CreateInstructorSchema>,
    @Headers('x-person-id') actorId: string,
    @Headers('x-root') root: string,
  ) {
    await this.authz.require(actorId, isRoot(root), 'ADMIT_INSTRUCTOR', body.homeChoragiewId);
    return this.createInstructor.execute({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      branch: body.branch,
      homeChoragiewId: body.homeChoragiewId,
      rank: body.rank,
      rankAwardedAt: new Date(body.rankAwardedAt),
      listType: body.listType,
      mainAssignmentLevel: body.mainAssignmentLevel,
      mainAssignmentUnitId: body.mainAssignmentUnitId,
      ...(body.instructorPledgeDate && {
        instructorPledgeDate: new Date(body.instructorPledgeDate),
      }),
      createdByPersonId: actorId,
    });
  }

  @Get(':personId')
  get(@Param('personId', ParseUUIDPipe) personId: string) {
    return this.service.getProfile(personId);
  }

  @Post(':personId/leave')
  grantLeave(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body(new ZodValidationPipe(z.object({ until: z.string().date() }))) body: { until: string },
  ) {
    return this.service.grantLeave(personId, new Date(body.until));
  }

  @Post(':personId/transfer')
  @HttpCode(201)
  requestTransfer(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body(new ZodValidationPipe(z.object({ toChoragiewId: z.string().uuid() })))
    body: { toChoragiewId: string },
  ) {
    return this.service.requestTransfer(personId, body.toChoragiewId);
  }

  @Post('transfers/:id/advance')
  advanceTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          step: z.enum(['FROM_APPROVED', 'TO_APPROVED', 'SETTLEMENT_CONFIRMED', 'REJECTED']),
        }),
      ),
    )
    body: { step: 'FROM_APPROVED' | 'TO_APPROVED' | 'SETTLEMENT_CONFIRMED' | 'REJECTED' },
  ) {
    return this.service.advanceTransfer(id, body.step);
  }
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly authz: AuthorizationService) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(CreateOrderSchema)) body: z.infer<typeof CreateOrderSchema>,
    @Headers('x-person-id') actorId: string,
    @Headers('x-root') root: string,
  ) {
    await this.authz.require(actorId, isRoot(root), 'ISSUE_ORDER', body.unitId);
    return this.orders.createDraft({ ...body, issuerPersonId: actorId });
  }

  @Post(':id/items')
  @HttpCode(201)
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AddOrderItemSchema)) body: z.infer<typeof AddOrderItemSchema>,
    @Headers('x-person-id') actorId: string,
    @Headers('x-root') root: string,
  ) {
    return this.orders.addItem(id, actorId, isRoot(root), body);
  }

  @Post(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.publish(id);
  }

  @Post(':id/correct')
  correct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({ revertItemIds: z.array(z.string().uuid()), correctionOrderId: z.string().uuid() }),
      ),
    )
    body: { revertItemIds: string[]; correctionOrderId: string },
  ) {
    return this.orders.correct(id, body.revertItemIds, body.correctionOrderId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(id);
  }

  @Get()
  list(@Query('unitId') unitId: string) {
    return this.orders.list(unitId);
  }
}

@Controller('progression')
export class ProgressionController {
  constructor(private readonly service: ProgressionService) {}

  @Post('start')
  @HttpCode(201)
  start(
    @Body(
      new ZodValidationPipe(
        z.object({
          personId: z.string().uuid(),
          unitId: z.string().uuid(),
          kind: z.enum(['RANK', 'BADGE', 'ZUCH_STAR', 'INSTRUCTOR_RANK']),
          targetCode: z.string().min(1),
        }),
      ),
    )
    body: Parameters<ProgressionService['startPath']>[0],
  ) {
    return this.service.startPath(body);
  }

  @Get('person/:personId')
  forPerson(@Param('personId', ParseUUIDPipe) personId: string) {
    return this.service.forPerson(personId);
  }

  @Get('unit/:unitId/pending')
  pending(@Param('unitId', ParseUUIDPipe) unitId: string) {
    return this.service.pendingForUnit(unitId);
  }

  @Post('requirements/:id/submit')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({ comment: z.string().max(2000), attachments: z.array(z.string()).optional() }),
      ),
    )
    body: { comment: string; attachments?: string[] },
  ) {
    return this.service.submitCompletion(id, body);
  }

  @Post('requirements/:id/verify')
  verify(@Param('id', ParseUUIDPipe) id: string, @Headers('x-person-id') actorId: string) {
    return this.service.verify(id, actorId);
  }

  @Post('requirements/:id/approve-feat')
  approveFeat(@Param('id', ParseUUIDPipe) id: string, @Headers('x-person-id') actorId: string) {
    return this.service.approveFeat(id, actorId);
  }

  @Post('requirements/:id/withdraw-feat')
  withdrawFeat(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.withdrawFromFeat(id);
  }

  @Post(':id/transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          to: z.enum(['OPEN', 'CLOSED_POSITIVE', 'CLOSED_NEGATIVE', 'DISCONTINUED', 'AWARDED', 'ABANDONED']),
          orderItemId: z.string().uuid().optional(),
          retryBlockedUntil: z.string().date().optional(),
        }),
      ),
    )
    body: { to: never; orderItemId?: string; retryBlockedUntil?: string },
  ) {
    return this.service.transition(id, body.to, {
      ...(body.orderItemId && { orderItemId: body.orderItemId }),
      ...(body.retryBlockedUntil && { retryBlockedUntil: new Date(body.retryBlockedUntil) }),
    });
  }
}

@Controller('planning')
export class PlanningController {
  constructor(
    private readonly instructorCensus: InstructorCensusService,
    private readonly unitCensus: UnitCensusService,
    private readonly workPlans: WorkPlanService,
    private readonly categorization: CategorizationService,
    private readonly authz: AuthorizationService,
  ) {}

  @Post('census/instructors/:year/open')
  openInstructorCensus(@Param('year') year: string) {
    return this.instructorCensus.openCampaign(Number(year));
  }

  @Post('census/instructors/:campaignId/declare')
  declare(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Headers('x-person-id') actorId: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          declaredListType: z.enum(['CZYNNY', 'WSPIERAJACY']),
          requestedAction: z.enum(['ENROLL', 'LEAVE', 'END_SERVICE']),
          declaredAssignment: z.record(z.unknown()).optional(),
          feePaidConfirmed: z.boolean(),
        }),
      ),
    )
    body: Parameters<InstructorCensusService['submitDeclaration']>[2],
  ) {
    return this.instructorCensus.submitDeclaration(campaignId, actorId, body);
  }

  @Get('census/instructors/:campaignId/status/:personId')
  censusStatus(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('personId', ParseUUIDPipe) personId: string,
  ) {
    return this.instructorCensus.computedStatus(campaignId, personId);
  }

  @Post('census/units/:year/open')
  openUnitCensus(@Param('year') year: string) {
    return this.unitCensus.openCampaign(Number(year));
  }

  @Post('work-plans/:unitId/:year')
  async upsertPlan(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Param('year') year: string,
    @Body(new ZodValidationPipe(z.object({ content: z.record(z.unknown()) })))
    body: { content: Record<string, unknown> },
  ) {
    return this.workPlans.upsertDraft(unitId, year.replace('-', '/'), body.content);
  }

  @Post('work-plans/:unitId/:year/submit')
  submitPlan(@Param('unitId', ParseUUIDPipe) unitId: string, @Param('year') year: string) {
    return this.workPlans.submit(unitId, year.replace('-', '/'));
  }

  @Post('work-plans/:unitId/:year/decide')
  async decidePlan(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Param('year') year: string,
    @Headers('x-person-id') actorId: string,
    @Headers('x-root') root: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          decision: z.enum(['APPROVED', 'REJECTED', 'RETURNED_FOR_CORRECTION']),
          notes: z.string().max(5000).optional(),
        }),
      ),
    )
    body: { decision: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION'; notes?: string },
  ) {
    await this.authz.require(actorId, isRoot(root), 'APPROVE_WORK_PLAN', unitId);
    return this.workPlans.decide(unitId, year.replace('-', '/'), actorId, body.decision, body.notes);
  }

  @Post('categorization/:unitId/:year')
  upsertSheet(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Param('year') year: string,
    @Body(
      new ZodValidationPipe(
        z.object({
          declaredCategory: z.enum(['POLOWA', 'LESNA', 'PUSZCZANSKA']),
          answers: z.record(z.unknown()),
        }),
      ),
    )
    body: { declaredCategory: 'POLOWA' | 'LESNA' | 'PUSZCZANSKA'; answers: Record<string, unknown> },
  ) {
    return this.categorization.upsertSheet(unitId, year.replace('-', '/'), body);
  }
}
