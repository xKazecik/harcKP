import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { CompleteProfileSchema, GuardianInputSchema } from '@harc/contracts';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  AcceptInvitationUseCase,
  InvalidInvitationTokenError,
} from '../../application/persons/accept-invitation.usecase.js';
import { InvitationAdminUseCase } from '../../application/persons/invitation-admin.usecase.js';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../application/persons/ports.js';

const PasswordSchema = z.object({ password: z.string().min(12) });

/**
 * Publiczny kreator zaproszenia (§8.2) + panel zaproszeń komendanta.
 *
 * Błędy tokenu są neutralne (jeden komunikat, 400) — bez ujawniania, czy
 * konto istnieje.
 */
@Controller()
export class InvitationsController {
  constructor(
    private readonly accept: AcceptInvitationUseCase,
    private readonly admin: InvitationAdminUseCase,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
  ) {}

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((err) => {
      if (err instanceof InvalidInvitationTokenError) {
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    });
  }

  // --- Kreator (publiczny, bez logowania) ---------------------------------

  @Get('public/invitations/:token')
  verify(@Param('token') token: string): Promise<{ firstName: string }> {
    return this.wrap(async () => {
      const { firstName } = await this.accept.verify(token);
      return { firstName };
    });
  }

  /** Krok 1 — e-mail Keycloak z akcją UPDATE_PASSWORD. */
  @Post('public/invitations/:token/password-email')
  @HttpCode(202)
  requestPassword(@Param('token') token: string): Promise<void> {
    return this.wrap(() => this.accept.requestPasswordSetup(token));
  }

  /** Krok 1 — tryb awaryjny (SMTP tylko po stronie aplikacji). */
  @Post('public/invitations/:token/password')
  @HttpCode(204)
  setPassword(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(PasswordSchema)) body: { password: string },
  ): Promise<void> {
    return this.wrap(() => this.accept.setPasswordFallback(token, body.password));
  }

  /** Krok 2 — profil. */
  @Post('public/invitations/:token/profile')
  @HttpCode(204)
  completeProfile(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(CompleteProfileSchema)) body: unknown,
  ): Promise<void> {
    return this.wrap(() =>
      this.accept.completeProfile(token, body as Parameters<AcceptInvitationUseCase['completeProfile']>[1]),
    );
  }

  /** Krok 3 — opiekun (nieblokujący; pominięcie → przypomnienie dla drużynowego). */
  @Post('public/invitations/:token/guardian')
  @HttpCode(204)
  addGuardian(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(GuardianInputSchema)) body: unknown,
  ): Promise<void> {
    return this.wrap(() =>
      this.accept.addGuardian(token, body as Parameters<AcceptInvitationUseCase['addGuardian']>[1]),
    );
  }

  /** Krok 4 — aktywacja konta. */
  @Post('public/invitations/:token/finish')
  finish(@Param('token') token: string): Promise<{ consentStatus: string }> {
    return this.wrap(() => this.accept.finish(token));
  }

  // --- Panel komendanta ----------------------------------------------------

  @Get('invitations')
  list(
    @Query('status') status?: 'pending' | 'expired',
  ): ReturnType<InvitationRepository['list']> {
    return this.invitations.list({
      pending: status === 'pending',
      expired: status === 'expired',
    });
  }

  @Post('invitations/:id/resend')
  @HttpCode(202)
  resend(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-person-id') actorId: string,
  ): Promise<void> {
    return this.admin.resend(id, actorId ?? 'system');
  }

  @Post('invitations/:id/revoke')
  @HttpCode(204)
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-person-id') actorId: string,
  ): Promise<void> {
    return this.admin.revoke(id, actorId ?? 'system');
  }
}
