import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Wpuszcza wyłącznie ROOT-a (§9.4, §10.1).
 *
 * @remarks Uprawnienie ROOT pochodzi z przynależności do grupy Keycloak
 * wskazanej przez `KEYCLOAK_ROOT_GROUP` i jest wyliczane przy każdym logowaniu
 * z claimu `groups`. Warstwa webowa przekłada je na nagłówek `X-Root`, którego
 * przeglądarka nie ma jak podrobić — nie rozmawia z API bezpośrednio, a
 * nagłówki ustawia serwer Next.js na podstawie ciasteczka httpOnly.
 *
 * Guard jest jednym punktem egzekwowania dla całego kontrolera trybu roota —
 * celowo, żeby nie rozsypywać sprawdzeń `if (isRoot)` po endpointach, gdzie
 * łatwo któryś pominąć.
 *
 * TODO(etap 12): po wprowadzeniu guarda OIDC czytać claim `groups` wprost
 * z tokenu Bearer zamiast z nagłówka.
 */
@Injectable()
export class RootOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.header('x-root') !== 'true') {
      throw new ForbiddenException({ code: 'ROOT_REQUIRED' });
    }
    return true;
  }
}
