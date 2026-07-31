/**
 * Idempotentny seed słowników HARC (§2).
 *
 * Wczytuje pliki z `seeds/*.json` i upsertuje rekordy po kluczach naturalnych:
 * - DictionaryEntry: (dictionaryKey, code, version)
 * - Nomenclature:    (unitType, branch, roleKey)
 * - Competence:      (action, holderLevel, branch, version)
 *
 * Wielokrotne uruchomienie nie duplikuje danych. Zmiana treści wymagań
 * regulaminowych NIGDY nie nadpisuje istniejącej wersji — dodaje nową
 * (wyższy `version`), bo trwające karty prób rozliczane są wg starej (§2).
 *
 * @remarks Nazwy stopni, sprawności i wymagań pochodzą WYŁĄCZNIE z seedów,
 * nigdy z kodu (§21).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, type Branch, type UnitType, type InstructorRank } from '@prisma/client';

const prisma = new PrismaClient();
const seedsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'seeds');

interface DictionarySeedFile {
  dictionaryKey: string;
  description: string;
  sourceDocument: string;
  entries: Array<{
    code: string;
    version: number;
    labelPl: string;
    validFrom: string;
    validTo?: string;
    sourceClause?: string;
    payload: unknown;
  }>;
}

interface NomenclatureSeedFile {
  entries: Array<{ unitType: UnitType; branch: Branch; roleKey: string; label: string }>;
}

interface CompetenceSeedFile {
  entries: Array<{
    action: string;
    holderLevel: UnitType;
    branch?: Branch;
    targetScope: string;
    targetTypes: string[];
    requiresAdult: boolean;
    requiresMinorProtection: boolean;
    minimumInstructorRank?: InstructorRank;
    delegable: boolean;
    legalBasis: string;
    validFrom: string;
    validTo?: string;
    version?: number;
  }>;
}

function loadJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(join(seedsDir, fileName), 'utf-8')) as T;
}

/** Seeduje jeden plik słownikowy: nagłówek + wersjonowane wpisy. */
async function seedDictionaryFile(fileName: string): Promise<number> {
  const file = loadJson<DictionarySeedFile>(fileName);
  await prisma.dictionary.upsert({
    where: { key: file.dictionaryKey },
    update: { description: file.description },
    create: { key: file.dictionaryKey, description: file.description },
  });
  for (const e of file.entries) {
    await prisma.dictionaryEntry.upsert({
      where: {
        dictionaryKey_code_version: {
          dictionaryKey: file.dictionaryKey,
          code: e.code,
          version: e.version,
        },
      },
      update: {
        labelPl: e.labelPl,
        payload: e.payload as object,
        sourceDocument: file.sourceDocument,
        sourceClause: e.sourceClause ?? null,
      },
      create: {
        dictionaryKey: file.dictionaryKey,
        code: e.code,
        version: e.version,
        labelPl: e.labelPl,
        payload: e.payload as object,
        validFrom: new Date(e.validFrom),
        validTo: e.validTo ? new Date(e.validTo) : null,
        sourceDocument: file.sourceDocument,
        sourceClause: e.sourceClause ?? null,
      },
    });
  }
  return file.entries.length;
}

async function seedNomenclature(): Promise<number> {
  const file = loadJson<NomenclatureSeedFile>('nomenclature.json');
  for (const e of file.entries) {
    await prisma.nomenclature.upsert({
      where: {
        unitType_branch_roleKey: { unitType: e.unitType, branch: e.branch, roleKey: e.roleKey },
      },
      update: { label: e.label },
      create: e,
    });
  }
  return file.entries.length;
}

async function seedCompetences(): Promise<number> {
  const file = loadJson<CompetenceSeedFile>('competences.json');
  for (const e of file.entries) {
    const version = e.version ?? 1;
    const branch = e.branch ?? null;
    const existing = await prisma.competence.findFirst({
      where: { action: e.action, holderLevel: e.holderLevel, branch, version },
    });
    const data = {
      action: e.action,
      holderLevel: e.holderLevel,
      branch,
      targetScope: e.targetScope,
      targetTypes: e.targetTypes,
      requiresAdult: e.requiresAdult,
      requiresMinorProtection: e.requiresMinorProtection,
      minimumInstructorRank: e.minimumInstructorRank ?? null,
      delegable: e.delegable,
      legalBasis: e.legalBasis,
      validFrom: new Date(e.validFrom),
      validTo: e.validTo ? new Date(e.validTo) : null,
      version,
    };
    if (existing) {
      await prisma.competence.update({ where: { id: existing.id }, data });
    } else {
      await prisma.competence.create({ data });
    }
  }
  return file.entries.length;
}

async function main(): Promise<void> {
  const dictionaryFiles = [
    'ranks-harcerze.json',
    'ranks-harcerki.json',
    'zuchy.json',
    'instructor-ranks.json',
    'unit-categories.json',
    'order-sections.json',
    'social-platforms.json',
    'badges.json',
    'categorization-sheets.json',
  ];
  let total = 0;
  for (const f of dictionaryFiles) {
    const n = await seedDictionaryFile(f);
    console.log(`  ✓ ${f}: ${n} wpisów`);
    total += n;
  }
  total += await seedNomenclature();
  console.log('  ✓ nomenclature.json');
  total += await seedCompetences();
  console.log('  ✓ competences.json');
  console.log(`Seed zakończony: ${total} rekordów (idempotentnie).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
