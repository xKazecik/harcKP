/**
 * @harc/contracts — schematy Zod i typy współdzielone (§3).
 *
 * Wyłącznie barrel re-eksportów. Definicje schematów żyją w modułach
 * tematycznych; schematy bazowe w common.ts. Index nie definiuje niczego,
 * dzięki czemu moduły mogą importować z common.js bez cyklu importów.
 */
export * from './common.js';
export * from './units.js';
export * from './persons.js';
export * from './orders.js';
