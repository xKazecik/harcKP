import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Źródło wartości ustawienia (§5): default w kodzie → baza → env (nadrzędne). */
export type SettingSource = 'default' | 'database' | 'env';

export interface ResolvedSetting {
  key: string;
  value: string;
  source: SettingSource;
  /** true gdy nadpisane zmienną środowiskową — edycja w panelu zwraca 409 SETTING_LOCKED_BY_ENV */
  isLocked: boolean;
}

/** Błąd rzucany przy próbie zapisu ustawienia zablokowanego przez env (§5). */
export class SettingLockedByEnvError extends Error {
  readonly code = 'SETTING_LOCKED_BY_ENV';
  constructor(public readonly key: string) {
    super(`Ustawienie ${key} jest nadpisane przez konfigurację serwera (zmienna: ${key})`);
    this.name = 'SettingLockedByEnvError';
  }
}

/**
 * Rejestr kluczy konfiguracyjnych z wartościami domyślnymi (poziom 1 z §5).
 * Nazwa zmiennej środowiskowej = klucz.
 */
const DEFAULTS: Record<string, string> = {
  APP_URL: 'http://localhost:3000',
  APP_NAME: 'HARC',
  DEFAULT_THEME: 'system',
  SCOUTING_YEAR_START: '09-01',
  INVITATION_TTL_HOURS: '168',
  INVITATION_RESEND_COOLDOWN_MINUTES: '15',
  ACCOUNT_ARCHIVE_TOMBSTONE_DOMAIN: 'archived.harc.invalid',
  PUBLIC_MAP_ENABLED: 'true',
  PUBLIC_MAP_URL: '/mapa-jednostek',
  REQUIRE_UNIT_CARD_APPROVAL: 'false',
  EXPORT_LINK_TTL_MINUTES: '30',
  DATA_RETENTION_MONTHS: '120',
  ALLOW_REGISTRATION: 'false',
};

/**
 * Trójpoziomowa konfiguracja (§5): default w kodzie → wartość w bazie
 * (AppSetting, edytowalna w panelu) → zmienna środowiskowa (NADRZĘDNA,
 * blokująca edycję — walidacja po stronie serwera, nie tylko w UI).
 */
@Injectable()
export class ConfigService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Zwraca ustawienie wraz ze źródłem i flagą blokady.
   *
   * @param key - klucz z rejestru DEFAULTS
   * @returns wartość, źródło ('default' | 'database' | 'env') i isLocked
   * @throws Error gdy klucz nie istnieje w rejestrze
   */
  async get(key: string): Promise<ResolvedSetting> {
    const def = DEFAULTS[key];
    if (def === undefined) {
      throw new Error(`Nieznany klucz konfiguracji: ${key}`);
    }
    const envValue = process.env[key];
    if (envValue !== undefined && envValue !== '') {
      return { key, value: envValue, source: 'env', isLocked: true };
    }
    if (this.prisma) {
      const row = await this.prisma.appSetting.findUnique({ where: { key } });
      if (row) return { key, value: row.value, source: 'database', isLocked: false };
    }
    return { key, value: def, source: 'default', isLocked: false };
  }

  /** Wszystkie ustawienia — podstawa GET /admin/settings (panel: etap 12). */
  async getAll(): Promise<ResolvedSetting[]> {
    return Promise.all(Object.keys(DEFAULTS).map((k) => this.get(k)));
  }

  /**
   * Zapisuje ustawienie na poziomie bazy.
   *
   * @throws SettingLockedByEnvError (→ 409) gdy klucz jest nadpisany przez env
   * @throws Error gdy klucz nie istnieje w rejestrze albo brak warstwy DB
   */
  async set(key: string, value: string, updatedByPersonId?: string): Promise<ResolvedSetting> {
    if (DEFAULTS[key] === undefined) {
      throw new Error(`Nieznany klucz konfiguracji: ${key}`);
    }
    const envValue = process.env[key];
    if (envValue !== undefined && envValue !== '') {
      throw new SettingLockedByEnvError(key);
    }
    if (!this.prisma) {
      throw new Error('Warstwa bazy danych niedostępna');
    }
    await this.prisma.appSetting.upsert({
      where: { key },
      update: { value, updatedByPersonId: updatedByPersonId ?? null },
      create: { key, value, updatedByPersonId: updatedByPersonId ?? null },
    });
    return { key, value, source: 'database', isLocked: false };
  }
}
