import { Injectable } from '@nestjs/common';
import type { KeycloakAdminPort } from '../../application/persons/ports.js';

/**
 * Klient Keycloak Admin API (§9.2) na natywnym fetch.
 *
 * Uwierzytelnienie: client_credentials klientem harc-admin, którego konto
 * serwisowe ma WYŁĄCZNIE role manage-users, view-users, query-users,
 * query-groups — nigdy realm-admin.
 *
 * @remarks Token jest cache'owany do ~30 s przed wygaśnięciem. Operacje są
 * idempotentne tam, gdzie Keycloak na to pozwala; retry/DLQ zapewni kolejka
 * (etap 9) — tu tylko czyste wywołania.
 */
@Injectable()
export class KeycloakAdminClient implements KeycloakAdminPort {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  /**
   * Adres issuera używany do wywołań serwer→serwer.
   *
   * @remarks `KEYCLOAK_ISSUER_URL` jest adresem dla PRZEGLĄDARKI (w devie
   * `localhost:8080`) i wewnątrz kontenera wskazywałby na sam kontener API.
   * Dlatego kanał backchannel ma własną zmienną `KEYCLOAK_ISSUER_INTERNAL_URL`
   * (w compose: `http://keycloak:8080/realms/harc`), analogicznie do tego, jak
   * robi to `apps/web`. Poza kontenerami obie wartości są takie same.
   */
  private get issuer(): string {
    // Celowo sprawdzamy prawdziwość, nie tylko null/undefined: w .env zmienna
    // bywa obecna, ale pusta (poza Dockerem), a `??` przepuściłoby pusty string.
    return (
      process.env.KEYCLOAK_ISSUER_INTERNAL_URL ||
      process.env.KEYCLOAK_ISSUER_URL ||
      'http://localhost:8080/realms/harc'
    );
  }

  private get baseUrl(): string {
    // https://host/realms/harc → https://host/admin/realms/harc
    return this.issuer.replace('/realms/', '/admin/realms/');
  }

  private get tokenUrl(): string {
    return `${this.issuer}/protocol/openid-connect/token`;
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.accessToken;
    }
    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'harc-admin',
        client_secret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ?? '',
      }),
    });
    if (!res.ok) throw new Error(`Keycloak token: HTTP ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Keycloak Admin API ${method} ${path}: HTTP ${res.status}`);
    }
    return res;
  }

  async createUser(personId: string, email: string): Promise<string> {
    const res = await this.request('POST', '/users', {
      username: personId,
      email,
      enabled: true,
      emailVerified: false,
    });
    if (res.status === 409) throw new Error('Keycloak: użytkownik już istnieje');
    // Location: .../users/{id}
    const location = res.headers.get('location');
    if (location) return location.split('/').pop() as string;
    // Fallback: wyszukanie po username
    const found = await this.request('GET', `/users?username=${personId}&exact=true`);
    const users = (await found.json()) as Array<{ id: string }>;
    const user = users[0];
    if (!user) throw new Error('Keycloak: nie odnaleziono utworzonego użytkownika');
    return user.id;
  }

  async isEmailTaken(email: string): Promise<boolean> {
    const res = await this.request(
      'GET',
      `/users?email=${encodeURIComponent(email)}&exact=true`,
    );
    const users = (await res.json()) as Array<{ id: string; enabled: boolean }>;
    return users.some((u) => u.enabled);
  }

  async sendSetPasswordEmail(keycloakUserId: string, redirectUri: string): Promise<void> {
    const clientId = process.env.KEYCLOAK_WEB_CLIENT_ID ?? 'harc-web';
    await this.request(
      'PUT',
      `/users/${keycloakUserId}/execute-actions-email?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`,
      ['UPDATE_PASSWORD'],
    );
  }

  async resetPassword(keycloakUserId: string, password: string): Promise<void> {
    await this.request('PUT', `/users/${keycloakUserId}/reset-password`, {
      type: 'password',
      value: password,
      temporary: false,
    });
  }

  async archiveUser(keycloakUserId: string, tombstoneEmail: string): Promise<void> {
    await this.request('PUT', `/users/${keycloakUserId}`, {
      enabled: false,
      email: tombstoneEmail,
      emailVerified: false,
    });
    await this.request('POST', `/users/${keycloakUserId}/logout`);
    // Usunięcie poświadczeń (§8.3 pkt 3)
    const res = await this.request('GET', `/users/${keycloakUserId}/credentials`);
    if (res.ok) {
      const creds = (await res.json()) as Array<{ id: string }>;
      for (const c of creds) {
        await this.request('DELETE', `/users/${keycloakUserId}/credentials/${c.id}`);
      }
    }
  }

  async restoreUser(keycloakUserId: string, newEmail: string): Promise<void> {
    await this.request('PUT', `/users/${keycloakUserId}`, {
      enabled: true,
      email: newEmail,
      emailVerified: false,
    });
  }

  /**
   * Zmiana adresu w Keycloak (§9.6).
   *
   * @remarks Wykonywana PRZED zapisem w bazie aplikacji. Keycloak wymusza
   * unikalność adresu w realmie, więc to on jest wąskim gardłem — jeśli
   * odrzuci zmianę, w bazie nie zapisujemy niczego i użytkownik zachowuje
   * poprzedni, działający adres logowania.
   */
  async updateEmail(keycloakUserId: string, newEmail: string): Promise<void> {
    await this.request('PUT', `/users/${keycloakUserId}`, {
      email: newEmail,
      emailVerified: false,
    });
  }

  /** Wysyła VERIFY_EMAIL na adres aktualnie zapisany w Keycloak (§9.6). */
  async sendVerifyEmail(keycloakUserId: string): Promise<void> {
    const clientId = process.env.KEYCLOAK_WEB_CLIENT_ID ?? 'harc-web';
    await this.request(
      'PUT',
      `/users/${keycloakUserId}/execute-actions-email?client_id=${clientId}`,
      ['VERIFY_EMAIL'],
    );
  }
}
