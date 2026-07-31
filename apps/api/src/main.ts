/**
 * Punkt wejścia API HARC (NestJS 11).
 *
 * Etap 1: bootstrap + /health + /ready + szkielet ConfigService.
 * Clean Architecture (domain → application → infrastructure → interface)
 * rozwijana od etapu 2.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`HARC API nasłuchuje na :${port}`);
}

void bootstrap();
