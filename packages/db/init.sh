#!/bin/sh
# =============================================================================
# HARC — inicjalizacja bazy przy starcie środowiska (§4).
#
# Uruchamiane przez usługę `init` w docker-compose PRZED api i web, dzięki czemu
# `docker compose up` wystarcza do uzyskania działającej instancji — administrator
# nie musi wykonywać żadnego polecenia ręcznie.
#
# Skrypt jest IDEMPOTENTNY: przy każdym starcie doprowadza bazę do stanu
# oczekiwanego przez aplikację i nie duplikuje danych.
#
# Kolejność ma znaczenie:
#   1. schemat            — bez tabel nie zadziała nic;
#   2. indeksy częściowe  — reguła unikalności e-maila (§8.4) niewyrażalna w Prismie;
#   3. słowniki           — reguły ZHR są danymi, nie kodem (§2);
#   4. bootstrap          — korzenie drzewa jednostek + profil konta administratora;
#   5. dane demo          — wyłącznie gdy SEED_DEMO=true.
# =============================================================================
set -e

cd "$(dirname "$0")"
BIN=./node_modules/.bin

# Bez --accept-data-loss celowo: gdyby zmiana schematu wymagała skasowania
# danych, start ma się zatrzymać z czytelnym błędem, a nie po cichu je usunąć.
echo "[init] 1/4 schemat bazy"
"$BIN/prisma" db push --schema prisma/schema.prisma --skip-generate

echo "[init] 2/4 indeksy częściowe"
"$BIN/prisma" db execute --schema prisma/schema.prisma --file prisma/sql/partial-indexes.sql

echo "[init] 3/4 słowniki"
"$BIN/tsx" prisma/seed.ts

echo "[init] 4/4 jednostki korzeniowe i konto administratora"
"$BIN/tsx" prisma/bootstrap.ts

if [ "$SEED_DEMO" = "true" ]; then
  echo "[init] + dane demonstracyjne (SEED_DEMO=true)"
  "$BIN/tsx" prisma/demo.ts
fi

echo "[init] gotowe — baza zainicjalizowana"
