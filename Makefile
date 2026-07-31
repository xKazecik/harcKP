# HARC — polecenia developerskie
.PHONY: dev seed test lint migrate realm-export down

## Uruchamia pełne środowisko dev (Postgres, Redis, Keycloak+realm, MailHog, MinIO, aplikacje)
dev:
	docker compose up --build -d
	@echo "web: http://localhost:3000 | api: http://localhost:3001 | keycloak: http://localhost:8080 | mailhog: http://localhost:8025"

## Migracje + indeksy częściowe (nie wyrażalne w Prisma) + generacja klienta
migrate:
	pnpm --filter @harc/db exec prisma migrate dev
	pnpm --filter @harc/db exec prisma db execute --file prisma/sql/partial-indexes.sql
	pnpm --filter @harc/db exec prisma generate

## Idempotentny seed słowników (§2)
seed:
	pnpm --filter @harc/db run seed

test:
	pnpm test

lint:
	pnpm lint && pnpm format:check

## Eksport aktualnego realmu z działającego kontenera do infra/keycloak/
realm-export:
	docker compose exec keycloak /opt/keycloak/bin/kc.sh export --realm harc --file /tmp/realm-export.json --users skip
	docker compose cp keycloak:/tmp/realm-export.json infra/keycloak/realm-export.json

down:
	docker compose down
