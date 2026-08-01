/**
 * Klient API HARC — wyłącznie po stronie serwera (RSC i route handlery).
 *
 * Tożsamość aktora jedzie w nagłówkach X-Person-Id / X-Root, które API czyta
 * w kontrolerach. Nagłówki są ustawiane TYLKO tutaj, na podstawie sesji
 * odczytanej z ciasteczka httpOnly — przeglądarka nie ma jak ich podrobić,
 * bo nie rozmawia z API bezpośrednio.
 *
 * @remarks TODO(etap 12): gdy API dostanie guard OIDC, w miejsce nagłówków
 * wejdzie `Authorization: Bearer <access_token>` bez zmian w wywołaniach.
 */
import { getSession, actorPersonId } from './session';

export const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wywołuje API z tożsamością zalogowanego użytkownika.
 *
 * @param path - ścieżka względem korzenia API, np. `/directory/units`
 * @param init - standardowe opcje fetch; `cache: 'no-store'` domyślnie, bo
 *   dane ewidencyjne zmieniają się w trakcie sesji
 * @returns zdeserializowana odpowiedź
 * @throws ApiError gdy API zwróci status spoza zakresu 2xx
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession();
  const personId = actorPersonId(session);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(personId && { 'X-Person-Id': personId }),
      ...(session?.isRoot && { 'X-Root': 'true' }),
      ...init?.headers,
    },
  });

  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, body, `${init?.method ?? 'GET'} ${path} → HTTP ${res.status}`);
  }
  return body as T;
}

/**
 * Wariant tolerujący błąd — dla fragmentów strony, które mogą się nie załadować
 * bez psucia całego widoku (np. kafelek statystyk obok listy).
 *
 * @returns dane albo `fallback`, gdy wywołanie się nie powiodło
 */
export async function apiSafe<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    return await api<T>(path, init);
  } catch {
    return fallback;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
