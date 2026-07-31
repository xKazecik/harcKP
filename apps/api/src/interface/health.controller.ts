import { Controller, Get } from '@nestjs/common';

/**
 * Sondy żywotności i gotowości (§3 — obserwowalność).
 *
 * @remarks /ready w etapie 2 zacznie sprawdzać połączenie z bazą i Redisem;
 * na razie zwraca stan procesu, żeby HEALTHCHECK kontenera działał od pierwszego
 * uruchomienia.
 */
@Controller()
export class HealthController {
  /**
   * Sonda żywotności procesu.
   * @returns status "ok" i znacznik czasu
   */
  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Sonda gotowości do przyjmowania ruchu.
   * @returns status "ok" (etap 2: weryfikacja zależności)
   */
  @Get('ready')
  ready(): { status: string } {
    return { status: 'ok' };
  }
}
