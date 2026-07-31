import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@harc/db';

/**
 * Pojedyncze połączenie Prisma dla całego API.
 *
 * @remarks Repozytoria (infrastructure) są JEDYNĄ warstwą, która go używa —
 * use case'y widzą wyłącznie porty (Clean Architecture, §3). Separacja branch
 * (§10.5) będzie wymuszana w repozytoriach, nie w kontrolerach.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
