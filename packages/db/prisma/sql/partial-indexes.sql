-- §8.4 — unikalność adresu e-mail WYŁĄCZNIE wśród osób INVITED i ACTIVE.
-- Egzekwowana w PostgreSQL, nie w kodzie aplikacji.
-- historicalEmail celowo NIE ma ograniczenia unikalności (wspólna skrzynka rodzeństwa).
-- Wykonywane przez `prisma db execute` w ramach `make migrate` (idempotentne).

CREATE UNIQUE INDEX IF NOT EXISTS person_active_email_unique
  ON "Person" (lower(email))
  WHERE status IN ('INVITED', 'ACTIVE') AND email IS NOT NULL;
