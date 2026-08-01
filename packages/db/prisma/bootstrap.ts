/**
 * Bootstrap instalacji HARC — dane, bez których świeża instancja nie działa.
 *
 * Tworzy:
 * 1. dwie jednostki korzeniowe `ORGANIZACJA` (Harcerek i Harcerzy) — całe
 *    drzewo jednostek musi mieć się o co zaczepić (§6.1);
 * 2. profil `Person` dla kont wskazanych w `ROOT_BOOTSTRAP_SUBS` — użytkownik
 *    Keycloak bez rekordu Person nie ma w aplikacji tożsamości, więc nie widzi
 *    kontekstu jednostki ani własnego profilu.
 *
 * Uprawnienie ROOT **nie jest tu nadawane** — pochodzi wyłącznie z claimu
 * `groups` Keycloak (§9.4). Skrypt celowo nie tworzy `AdminGrant SYSADMIN`,
 * bo pierwszy taki wpis trwale wyłącza ścieżkę bootstrapową.
 *
 * Idempotentny: wielokrotne uruchomienie nie duplikuje rekordów.
 *
 * @remarks To NIE są dane demonstracyjne — te są w `prisma/demo.ts`.
 */
import { PrismaClient, type Branch } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Korzenie drzewa: po jednej organizacji na gałąź (§6.1).
 *
 * `localityName` jest puste celowo — nazwa wyświetlana jednostki jest
 * GENEROWANA (§6.2), a dla typu ORGANIZACJA sama etykieta typu ("Organizacja
 * Harcerzy") jest pełną nazwą. Wpisanie jej w localityName dałoby duplikat.
 */
const ORGANIZATIONS: Array<{ branch: Branch; localityName: string; label: string }> = [
  { branch: 'HARCERKI', localityName: '', label: 'Organizacja Harcerek' },
  { branch: 'HARCERZE', localityName: '', label: 'Organizacja Harcerzy' },
];

/**
 * Zakłada jednostki korzeniowe, jeśli jeszcze nie istnieją.
 *
 * @returns mapa `branch → Unit.id` korzenia
 */
async function ensureOrganizations(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const org of ORGANIZATIONS) {
    const existing = await prisma.unit.findFirst({
      where: { type: 'ORGANIZACJA', branch: org.branch },
    });
    if (existing) {
      ids[org.branch] = existing.id;
      console.log(`  = ${org.label} (istnieje)`);
      continue;
    }
    const created = await prisma.unit.create({
      data: {
        type: 'ORGANIZACJA',
        branch: org.branch,
        localityName: org.localityName,
        status: 'ACTIVE',
      },
    });
    ids[org.branch] = created.id;
    console.log(`  + ${org.label}`);
  }
  return ids;
}

/**
 * Tworzy profil osoby dla konta bootstrapowego, jeśli go brakuje.
 *
 * @param sub - UUID użytkownika Keycloak (`username`, §9.3)
 * @param rootUnitId - jednostka, w której osadzony jest profil
 */
async function ensureBootstrapPerson(sub: string, rootUnitId: string): Promise<void> {
  const existing = await prisma.person.findFirst({
    where: { OR: [{ keycloakUserId: sub }, { id: sub }] },
  });
  if (existing) {
    console.log(`  = profil konta ${sub.slice(0, 8)}… (istnieje)`);
    return;
  }

  const person = await prisma.person.create({
    data: {
      id: sub,
      keycloakUserId: sub,
      status: 'ACTIVE',
      firstName: process.env.ROOT_BOOTSTRAP_FIRST_NAME ?? 'Administrator',
      lastName: process.env.ROOT_BOOTSTRAP_LAST_NAME ?? 'Systemu',
      email: process.env.ROOT_BOOTSTRAP_EMAIL ?? null,
      branch: 'HARCERZE',
      membershipCategory: 'INSTRUKTOR',
      invitedToUnitId: rootUnitId,
    },
  });
  await prisma.unitMembership.create({ data: { unitId: rootUnitId, personId: person.id } });
  console.log(`  + profil konta ${sub.slice(0, 8)}…`);
}

async function main(): Promise<void> {
  console.log('Bootstrap HARC:');
  const orgIds = await ensureOrganizations();

  const subs = (process.env.ROOT_BOOTSTRAP_SUBS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (subs.length === 0) {
    console.log('  ! ROOT_BOOTSTRAP_SUBS puste — pomijam profile kont bootstrapowych');
  }
  for (const sub of subs) {
    await ensureBootstrapPerson(sub, orgIds.HARCERZE!);
  }

  console.log('Bootstrap zakończony (idempotentnie).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
