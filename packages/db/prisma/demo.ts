/**
 * Dane demonstracyjne HARC — przykładowa struktura do zapoznania się z systemem.
 *
 * NIE są to dane produkcyjne ani wymagane do działania aplikacji. Instalacja
 * produkcyjna uruchamia wyłącznie `seed` (słowniki) i `bootstrap` (korzenie
 * drzewa + konto administratora).
 *
 * Wszystkie osoby są fikcyjne. Skrypt jest idempotentny — rozpoznaje własne
 * rekordy po naturalnych kluczach i nie duplikuje ich przy ponownym uruchomieniu.
 *
 * Usunięcie danych demo: `pnpm --filter @harc/db run demo:clear`.
 *
 * @remarks Nazwy stopni i sprawności pochodzą ze słowników (§2, §21) — skrypt
 * odczytuje `DictionaryEntry`, nigdy nie wpisuje wymagań do kodu.
 */
import { PrismaClient, type Branch, type UnitType } from '@prisma/client';

const prisma = new PrismaClient();

/** Znacznik w opisie jednostki pozwalający czysto usunąć dane demo. */
const DEMO_TAG = '[demo]';

interface UnitSpec {
  key: string;
  type: UnitType;
  branch: Branch;
  parentKey?: string;
  number?: string;
  localityName: string;
  properName?: string;
  patron?: string;
  description?: string;
  publicly?: boolean;
  meetingPlace?: { lat: number; lng: number; address: string; meetingTimes: string };
}

/** Przykładowa struktura: dwie gałęzie, po jednej chorągwi i hufcu. */
const UNITS: UnitSpec[] = [
  {
    key: 'chor-m',
    type: 'CHORAGIEW',
    branch: 'HARCERZE',
    localityName: 'Pomorska',
    description: `${DEMO_TAG} Chorągiew demonstracyjna.`,
  },
  {
    key: 'hufiec-m',
    type: 'HUFIEC',
    branch: 'HARCERZE',
    parentKey: 'chor-m',
    localityName: 'Bydgoski',
    description: `${DEMO_TAG} Hufiec demonstracyjny.`,
  },
  {
    key: 'druzyna-m',
    type: 'DRUZYNA',
    branch: 'HARCERZE',
    parentKey: 'hufiec-m',
    number: '1',
    localityName: 'Sucholeska',
    properName: 'Grań',
    patron: 'rtm. Witolda Pileckiego',
    description: `${DEMO_TAG} Drużyna działa przy Szkole Podstawowej nr 4. Zbiórki w każdy piątek.`,
    publicly: true,
    meetingPlace: {
      lat: 53.1235,
      lng: 18.0084,
      address: 'ul. Harcerska 4, Bydgoszcz',
      meetingTimes: 'Piątki 18:00–20:00',
    },
  },
  {
    key: 'gromada-m',
    type: 'GROMADA',
    branch: 'HARCERZE',
    parentKey: 'hufiec-m',
    number: '3',
    localityName: 'Bydgoska',
    properName: 'Leśne Skrzaty',
    description: `${DEMO_TAG} Gromada zuchów.`,
    publicly: true,
    meetingPlace: {
      lat: 53.1305,
      lng: 18.0201,
      address: 'ul. Zuchowa 12, Bydgoszcz',
      meetingTimes: 'Środy 17:00–18:30',
    },
  },
  {
    key: 'chor-z',
    type: 'CHORAGIEW',
    branch: 'HARCERKI',
    localityName: 'Pomorska',
    description: `${DEMO_TAG} Chorągiew demonstracyjna.`,
  },
  {
    key: 'hufiec-z',
    type: 'HUFIEC',
    branch: 'HARCERKI',
    parentKey: 'chor-z',
    localityName: 'Bydgoski',
    description: `${DEMO_TAG} Hufiec demonstracyjny.`,
  },
  {
    key: 'druzyna-z',
    type: 'DRUZYNA',
    branch: 'HARCERKI',
    parentKey: 'hufiec-z',
    number: '2',
    localityName: 'Bydgoska',
    properName: 'Watra',
    description: `${DEMO_TAG} Drużyna harcerek.`,
    publicly: true,
    meetingPlace: {
      lat: 53.1189,
      lng: 18.0027,
      address: 'ul. Świętojańska 8, Bydgoszcz',
      meetingTimes: 'Wtorki 17:30–19:30',
    },
  },
];

interface PersonSpec {
  key: string;
  firstName: string;
  lastName: string;
  branch: Branch;
  unitKey: string;
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  category: 'UCZESTNIK' | 'HARCERZ_STARSZY' | 'INSTRUKTOR';
  school?: string;
  crossNumber?: string;
  promise?: string;
  leads?: boolean;
  isActing?: boolean;
  instructor?: { rank: 'PRZEWODNIK' | 'PODHARCMISTRZ' | 'HARCMISTRZ'; listType: 'CZYNNY' | 'WSPIERAJACY' };
  zastep?: string;
  rankAwarded?: string;
  rankInProgress?: string;
}

const PEOPLE: PersonSpec[] = [
  // Kadra męska
  {
    key: 'hm-chor',
    firstName: 'Wojciech',
    lastName: 'Zawadzki',
    branch: 'HARCERZE',
    unitKey: 'chor-m',
    birthYear: 1985,
    category: 'INSTRUKTOR',
    leads: true,
    instructor: { rank: 'HARCMISTRZ', listType: 'CZYNNY' },
  },
  {
    key: 'phm-hufiec',
    firstName: 'Michał',
    lastName: 'Dąbrowski',
    branch: 'HARCERZE',
    unitKey: 'hufiec-m',
    birthYear: 1992,
    category: 'INSTRUKTOR',
    leads: true,
    instructor: { rank: 'PODHARCMISTRZ', listType: 'CZYNNY' },
  },
  {
    key: 'pwd-druzynowy',
    firstName: 'Jakub',
    lastName: 'Nowicki',
    branch: 'HARCERZE',
    unitKey: 'druzyna-m',
    birthYear: 2001,
    category: 'INSTRUKTOR',
    leads: true,
    instructor: { rank: 'PRZEWODNIK', listType: 'CZYNNY' },
    crossNumber: 'KH-10231',
  },
  {
    key: 'gromadowy',
    firstName: 'Tomasz',
    lastName: 'Wiśniewski',
    branch: 'HARCERZE',
    unitKey: 'gromada-m',
    birthYear: 1999,
    category: 'INSTRUKTOR',
    leads: true,
    instructor: { rank: 'PRZEWODNIK', listType: 'CZYNNY' },
  },
  // Harcerze — drużyna męska
  {
    key: 'h1',
    firstName: 'Antoni',
    lastName: 'Kowalczyk',
    branch: 'HARCERZE',
    unitKey: 'druzyna-m',
    birthYear: 2012,
    birthMonth: 3,
    birthDay: 14,
    category: 'UCZESTNIK',
    school: 'SP nr 4 w Bydgoszczy',
    zastep: 'Rysie',
    promise: '2024-06-12',
    crossNumber: 'KH-20114',
    rankAwarded: 'MLODZIK',
    rankInProgress: 'WYWIADOWCA',
  },
  {
    key: 'h2',
    firstName: 'Stanisław',
    lastName: 'Lewandowski',
    branch: 'HARCERZE',
    unitKey: 'druzyna-m',
    birthYear: 2011,
    birthMonth: 9,
    birthDay: 2,
    category: 'UCZESTNIK',
    school: 'SP nr 4 w Bydgoszczy',
    zastep: 'Rysie',
    promise: '2023-06-20',
    rankAwarded: 'WYWIADOWCA',
    rankInProgress: 'CWIK',
  },
  {
    key: 'h3',
    firstName: 'Franciszek',
    lastName: 'Zieliński',
    branch: 'HARCERZE',
    unitKey: 'druzyna-m',
    birthYear: 2013,
    birthMonth: 1,
    birthDay: 25,
    category: 'UCZESTNIK',
    school: 'SP nr 12 w Bydgoszczy',
    zastep: 'Wilki',
    rankInProgress: 'MLODZIK',
  },
  {
    key: 'h4',
    firstName: 'Ignacy',
    lastName: 'Szymański',
    branch: 'HARCERZE',
    unitKey: 'druzyna-m',
    birthYear: 2010,
    birthMonth: 5,
    birthDay: 8,
    category: 'UCZESTNIK',
    school: 'SP nr 4 w Bydgoszczy',
    zastep: 'Wilki',
    promise: '2022-06-18',
    rankAwarded: 'CWIK',
  },
  {
    key: 'h5',
    firstName: 'Bartosz',
    lastName: 'Adamczyk',
    branch: 'HARCERZE',
    unitKey: 'druzyna-m',
    birthYear: 2006,
    birthMonth: 11,
    birthDay: 30,
    category: 'HARCERZ_STARSZY',
    zastep: 'Rysie',
    promise: '2019-06-14',
    rankAwarded: 'HARCERZ_ORLI',
  },
  // Zuchy
  {
    key: 'z1',
    firstName: 'Leon',
    lastName: 'Mazur',
    branch: 'HARCERZE',
    unitKey: 'gromada-m',
    birthYear: 2017,
    birthMonth: 4,
    birthDay: 3,
    category: 'UCZESTNIK',
    school: 'SP nr 12 w Bydgoszczy',
  },
  {
    key: 'z2',
    firstName: 'Nikodem',
    lastName: 'Sikora',
    branch: 'HARCERZE',
    unitKey: 'gromada-m',
    birthYear: 2016,
    birthMonth: 8,
    birthDay: 19,
    category: 'UCZESTNIK',
    school: 'SP nr 12 w Bydgoszczy',
  },
  // Kadra i harcerki — gałąź żeńska
  {
    key: 'hm-chor-z',
    firstName: 'Katarzyna',
    lastName: 'Górska',
    branch: 'HARCERKI',
    unitKey: 'chor-z',
    birthYear: 1987,
    category: 'INSTRUKTOR',
    leads: true,
    instructor: { rank: 'HARCMISTRZ', listType: 'CZYNNY' },
  },
  {
    key: 'phm-hufiec-z',
    firstName: 'Agnieszka',
    lastName: 'Pawlak',
    branch: 'HARCERKI',
    unitKey: 'hufiec-z',
    birthYear: 1994,
    category: 'INSTRUKTOR',
    leads: true,
    instructor: { rank: 'PODHARCMISTRZ', listType: 'CZYNNY' },
  },
  {
    key: 'druzynowa',
    firstName: 'Maria',
    lastName: 'Krawczyk',
    branch: 'HARCERKI',
    unitKey: 'druzyna-z',
    birthYear: 2003,
    category: 'INSTRUKTOR',
    leads: true,
    instructor: { rank: 'PRZEWODNIK', listType: 'CZYNNY' },
  },
  {
    key: 'hk1',
    firstName: 'Zofia',
    lastName: 'Wróbel',
    branch: 'HARCERKI',
    unitKey: 'druzyna-z',
    birthYear: 2011,
    birthMonth: 2,
    birthDay: 11,
    category: 'UCZESTNIK',
    school: 'SP nr 31 w Bydgoszczy',
    zastep: 'Sasanki',
    promise: '2023-06-10',
    rankAwarded: 'OCHOTNICZKA',
    rankInProgress: 'TROPICIELKA',
  },
  {
    key: 'hk2',
    firstName: 'Julia',
    lastName: 'Baran',
    branch: 'HARCERKI',
    unitKey: 'druzyna-z',
    birthYear: 2012,
    birthMonth: 7,
    birthDay: 22,
    category: 'UCZESTNIK',
    school: 'SP nr 31 w Bydgoszczy',
    zastep: 'Sasanki',
    rankInProgress: 'OCHOTNICZKA',
  },
  {
    key: 'hk3',
    firstName: 'Hanna',
    lastName: 'Czarnecka',
    branch: 'HARCERKI',
    unitKey: 'druzyna-z',
    birthYear: 2009,
    birthMonth: 10,
    birthDay: 5,
    category: 'UCZESTNIK',
    school: 'II LO w Bydgoszczy',
    zastep: 'Jarzębiny',
    promise: '2021-06-15',
    rankAwarded: 'SAMARYTANKA',
  },
];

const unitIds = new Map<string, string>();
const personIds = new Map<string, string>();

/** Znajduje albo zakłada jednostkę wg naturalnego klucza (typ, gałąź, nazwa). */
async function upsertUnit(spec: UnitSpec, rootIds: Record<string, string>): Promise<void> {
  const parentId = spec.parentKey ? unitIds.get(spec.parentKey)! : rootIds[spec.branch]!;
  const existing = await prisma.unit.findFirst({
    where: {
      type: spec.type,
      branch: spec.branch,
      localityName: spec.localityName,
      properName: spec.properName ?? null,
      parentId,
    },
  });
  if (existing) {
    unitIds.set(spec.key, existing.id);
    return;
  }
  const created = await prisma.unit.create({
    data: {
      type: spec.type,
      branch: spec.branch,
      parentId,
      number: spec.number ?? null,
      localityName: spec.localityName,
      properName: spec.properName ?? null,
      patron: spec.patron ?? null,
      description: spec.description ?? null,
      status: 'ACTIVE',
      isPubliclyVisible: spec.publicly ?? false,
      meetingPlace: spec.meetingPlace ?? undefined,
      publicEmail: spec.publicly ? `${spec.key}@example.org` : null,
      socialLinks: spec.publicly ? [{ platform: 'FACEBOOK', url: 'https://facebook.com/zhr' }] : undefined,
    },
  });
  unitIds.set(spec.key, created.id);
}

/** Zakłada osobę wraz z członkostwem, funkcją i profilem instruktorskim. */
async function upsertPerson(spec: PersonSpec): Promise<void> {
  const unitId = unitIds.get(spec.unitKey)!;
  const existing = await prisma.person.findFirst({
    where: { firstName: spec.firstName, lastName: spec.lastName, invitedToUnitId: unitId },
  });
  if (existing) {
    personIds.set(spec.key, existing.id);
    return;
  }

  const birthDate = spec.birthYear
    ? new Date(Date.UTC(spec.birthYear, (spec.birthMonth ?? 6) - 1, spec.birthDay ?? 15))
    : null;

  const person = await prisma.person.create({
    data: {
      firstName: spec.firstName,
      lastName: spec.lastName,
      branch: spec.branch,
      // Profil bez konta (§8.2) — pełnoprawny ewidencyjnie, bez logowania.
      status: 'ACTIVE',
      email: null,
      birthDate,
      school: spec.school ?? null,
      crossNumber: spec.crossNumber ?? null,
      promiseDate: spec.promise ? new Date(spec.promise) : null,
      membershipCategory: spec.category,
      invitedToUnitId: unitId,
    },
  });
  personIds.set(spec.key, person.id);

  await prisma.unitMembership.create({ data: { unitId, personId: person.id } });

  if (spec.leads) {
    await prisma.unitLeadership.create({
      data: { unitId, personId: person.id, isActing: spec.isActing ?? false },
    });
  }

  if (spec.instructor) {
    // Chorągiew przynależności — najbliższa chorągiew w gałęzi osoby (§7.3).
    const choragiewId = unitIds.get(spec.branch === 'HARCERZE' ? 'chor-m' : 'chor-z')!;
    const inTwoYears = new Date();
    inTwoYears.setFullYear(inTwoYears.getFullYear() + 2);
    await prisma.instructorProfile.create({
      data: {
        personId: person.id,
        rank: spec.instructor.rank,
        rankAwardedAt: new Date('2023-09-01'),
        listType: spec.instructor.listType,
        homeChoragiewId: choragiewId,
        mainAssignmentLevel: 'HUFIEC',
        mainAssignmentUnitId: unitId,
        // §17: wyłącznie daty weryfikacji, nigdy treść zaświadczeń.
        minorProtectionVerifiedAt: new Date('2025-09-01'),
        minorProtectionValidUntil: inTwoYears,
        standardsAcknowledgedAt: new Date('2025-09-01'),
      },
    });
    await prisma.person.update({
      where: { id: person.id },
      data: { instructorPledgeDate: new Date('2023-09-01') },
    });
  }

  if (spec.zastep) {
    let zastep = await prisma.zastep.findFirst({ where: { unitId, name: spec.zastep } });
    zastep ??= await prisma.zastep.create({ data: { unitId, name: spec.zastep } });
    await prisma.zastepMembership.create({ data: { zastepId: zastep.id, personId: person.id } });
  }

  await prisma.personalEventLog.create({
    data: {
      personId: person.id,
      eventType: 'ADMITTED',
      occurredAt: new Date('2024-09-01'),
      payload: { unitId, note: 'Przyjęcie do jednostki (dane demonstracyjne)' },
    },
  });
}

/**
 * Karty progresji — wymagania czytane ze słownika wersjonowanego (§2).
 * Karta przechowuje `requirementSetVersionId` konkretnej wersji regulaminu.
 */
async function createProgression(spec: PersonSpec): Promise<void> {
  const personId = personIds.get(spec.key);
  if (!personId) return;
  const unitId = unitIds.get(spec.unitKey)!;
  const dictKey = spec.branch === 'HARCERZE' ? 'ranks_harcerze' : 'ranks_harcerki';

  for (const [code, status] of [
    [spec.rankAwarded, 'AWARDED'],
    [spec.rankInProgress, 'OPEN'],
  ] as const) {
    if (!code) continue;
    const entry = await prisma.dictionaryEntry.findFirst({
      where: { dictionaryKey: dictKey, code },
      orderBy: { version: 'desc' },
    });
    if (!entry) continue;

    const already = await prisma.progressionInstance.findFirst({
      where: { personId, kind: 'RANK', targetCode: code },
    });
    if (already) continue;

    const payload = entry.payload as { requirements?: Array<{ code: string; area?: string; description: string; isFeat?: boolean }> };
    const reqs = payload.requirements ?? [];

    const instance = await prisma.progressionInstance.create({
      data: {
        personId,
        unitId,
        kind: 'RANK',
        branch: spec.branch,
        targetCode: code,
        requirementSetVersionId: entry.id,
        status,
      },
    });

    // Karta w toku: część wymagań zweryfikowana, jedno zgłoszone do akceptacji.
    await Promise.all(
      reqs.map((r, idx) =>
        prisma.progressionRequirement.create({
          data: {
            instanceId: instance.id,
            code: r.code,
            areaCode: r.area ?? null,
            description: r.description,
            isFeat: r.isFeat ?? false,
            status:
              status === 'AWARDED'
                ? 'VERIFIED'
                : idx === 0
                  ? 'SUBMITTED'
                  : idx < 3
                    ? 'VERIFIED'
                    : 'PENDING',
            ...(status !== 'AWARDED' && idx === 0
              ? {
                  evidence: { comment: 'Zrobione na ostatniej zbiórce, zdjęcia w załączniku.', attachments: [] },
                  submittedAt: new Date(),
                }
              : {}),
          },
        }),
      ),
    );
  }
}

/** Przykładowy rozkaz drużynowego z pozycjami (§11). */
async function createOrders(): Promise<void> {
  const unitId = unitIds.get('druzyna-m');
  const issuer = personIds.get('pwd-druzynowy');
  if (!unitId || !issuer) return;

  const existing = await prisma.order.findFirst({ where: { unitId, number: 'L. 1/2026' } });
  if (existing) return;

  const order = await prisma.order.create({
    data: {
      unitId,
      issuerPersonId: issuer,
      number: 'L. 1/2026',
      issuedAt: new Date('2026-01-15'),
      place: 'Bydgoszcz',
      status: 'PUBLISHED',
      contentText: 'Rozkaz demonstracyjny — dane przykładowe.',
    },
  });

  const subject = personIds.get('h1');
  if (subject) {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        section: '5.1',
        type: 'AWARD_RANK',
        subjectPersonId: subject,
        payload: { rankCode: 'MLODZIK' },
        effectiveDate: new Date('2026-01-15'),
      },
    });
    await prisma.unitLogbookEntry.create({
      data: {
        unitId,
        entryType: 'AWARD_RANK',
        payload: { personId: subject, rankCode: 'MLODZIK' },
        occurredAt: new Date('2026-01-15'),
      },
    });
  }
}

/** Plan pracy drużyny w roku harcerskim (§13.3). */
async function createWorkPlan(): Promise<void> {
  const unitId = unitIds.get('druzyna-m');
  if (!unitId) return;
  const year = '2026/2027';
  const existing = await prisma.workPlan.findFirst({ where: { unitId, scoutingYear: year } });
  if (existing) return;
  await prisma.workPlan.create({
    data: {
      unitId,
      scoutingYear: year,
      status: 'SUBMITTED',
      submittedAt: new Date(),
      content: {
        goals: [
          'Zdobycie kategorii polowej przez drużynę',
          'Każdy harcerz z otwartą kartą stopnia',
          'Udział całej drużyny w obozie letnim',
        ],
        calendar: [
          { date: '2026-09-12', title: 'Zbiórka rozpoczynająca rok harcerski' },
          { date: '2026-11-11', title: 'Służba przy obchodach Święta Niepodległości' },
          { date: '2027-01-20', title: 'Biwak zimowy' },
        ],
        camp: { planned: true, location: 'Bory Tucholskie', term: 'lipiec 2027' },
        serviceField: 'Pomoc w miejskim schronisku dla zwierząt',
        declaredCategory: 'POLOWA',
      },
    },
  });
}

async function main(): Promise<void> {
  console.log('Dane demonstracyjne HARC:');

  const roots: Record<string, string> = {};
  for (const branch of ['HARCERZE', 'HARCERKI'] as Branch[]) {
    const root = await prisma.unit.findFirst({ where: { type: 'ORGANIZACJA', branch } });
    if (!root) {
      console.error('  ! Brak jednostek korzeniowych — uruchom najpierw: pnpm --filter @harc/db run bootstrap');
      process.exit(1);
    }
    roots[branch] = root.id;
  }

  for (const u of UNITS) await upsertUnit(u, roots);
  console.log(`  + jednostki: ${UNITS.length}`);

  for (const p of PEOPLE) await upsertPerson(p);
  console.log(`  + osoby: ${PEOPLE.length}`);

  for (const p of PEOPLE) await createProgression(p);
  console.log('  + karty stopni');

  await createOrders();
  await createWorkPlan();
  console.log('  + rozkaz i plan pracy');

  console.log('Dane demonstracyjne gotowe (idempotentnie).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
