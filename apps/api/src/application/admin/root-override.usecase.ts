import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@harc/db';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AUDIT_LOG, type AuditLogPort } from '../persons/ports.js';

/** Wspólne dla każdej operacji trybu roota. */
interface RootAction {
  actorPersonId: string;
  /** Powód wpisywany do audit logu — pole obowiązkowe (walidacja w kontrolerze). */
  reason: string;
  /**
   * Świadome pominięcie walidacji domenowych (wiek, ochrona małoletnich,
   * wymóg opiekuna przy p.o.). Domyślnie `false`.
   */
  force?: boolean;
}

export interface AppointFunctionInput extends RootAction {
  unitId: string;
  personId: string;
  roleKey: string;
  isActing?: boolean;
  guardianInstructorId?: string | null;
}

export interface EndFunctionInput extends RootAction {
  leadershipId: string;
}

export interface PatchUnitInput extends RootAction {
  unitId: string;
  data: Record<string, unknown>;
}

export interface PatchPersonInput extends RootAction {
  personId: string;
  data: Record<string, unknown>;
}

/** Pola jednostki, które root może zmieniać bezpośrednio. */
const UNIT_WRITABLE = new Set([
  'type',
  'branch',
  'parentId',
  'number',
  'localityName',
  'properName',
  'patron',
  'isProbationary',
  'probationEndsAt',
  'status',
  'categoryId',
  'description',
  'publicEmail',
  'locationPrecision',
  'isPubliclyVisible',
]);

/** Pola osoby, które root może zmieniać bezpośrednio. */
const PERSON_WRITABLE = new Set([
  'firstName',
  'lastName',
  'birthDate',
  'school',
  'phone',
  'branch',
  'crossNumber',
  'promiseDate',
  'instructorPledgeDate',
  'membershipCategory',
  'membershipStartedAt',
  'membershipEndedAt',
  'status',
]);

/**
 * Tryb roota (§10.1) — zmiany poza normalnym trybem pracy systemu.
 *
 * Root może wprowadzić dowolną zmianę bezpośrednio, w szczególności **nadać
 * i odebrać funkcję bez wydawania rozkazu**. Zwykła ścieżka prowadzi wyłącznie
 * przez opublikowany rozkaz (`OrdersService`), co jest właściwe dla pracy
 * organizacji, ale bezużyteczne przy porządkowaniu danych, naprawie pomyłki
 * czy odblokowaniu jednostki bez komendanta.
 *
 * Trzy zasady, które ten moduł utrzymuje mimo pełni uprawnień:
 *
 * 1. **Każda operacja ma powód i ślad.** §10.3 zakazuje cichych obejść przy
 *    subsydiarności; tryb roota jest obejściem silniejszym, więc tym bardziej
 *    nie może być niewidoczny. Powód nie blokuje operacji — tylko ją opisuje.
 * 2. **Pominięcie walidacji jest jawne.** Bez `force` root dostaje normalny
 *    błąd walidacyjny. Dzięki temu w audycie widać różnicę między poprawianiem
 *    literówki a mianowaniem osoby bez ważnej ochrony małoletnich.
 * 3. **Opublikowane rozkazy pozostają nietknięte.** §8.6: rozkaz jest
 *    dokumentem organizacji i nie podlega edycji — sprostowanie idzie osobnym
 *    rozkazem. Tu nie ma operacji, która by je nadpisywała.
 */
@Injectable()
export class RootOverrideUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  /**
   * Zapisuje operację trybu roota w audit logu.
   *
   * @param action - operacja, powód i flaga `force`
   * @param operation - nazwa operacji, np. `APPOINT_FUNCTION`
   * @param resourceType - encja, której dotyczy
   * @param resourceId - identyfikator encji
   * @param before - stan przed zmianą (null przy tworzeniu)
   * @param after - stan po zmianie
   */
  private async record(
    action: RootAction,
    operation: string,
    resourceType: string,
    resourceId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await this.audit.record({
      actorPersonId: action.actorPersonId,
      action: 'ROOT_OVERRIDE',
      resourceType,
      resourceId,
      payload: {
        operation,
        reason: action.reason,
        forced: action.force === true,
        before,
        after,
      },
    });
  }

  /** Odsiewa pola spoza białej listy — bez tego można by podmienić np. `id`. */
  private pick(data: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([k]) => allowed.has(k)));
  }

  /**
   * Nadaje funkcję w jednostce BEZ rozkazu (§10.1).
   *
   * @param input - jednostka, osoba, funkcja i powód
   * @returns utworzony rekord `UnitLeadership` z `appointedByOrderId = null`
   * @throws NotFoundException gdy jednostka albo osoba nie istnieje
   * @throws UnprocessableEntityException gdy p.o. nie ma opiekuna, a nie użyto `force`
   *
   * @remarks `appointedByOrderId` pozostaje puste i to jest właściwy zapis
   * stanu faktycznego: mianowania nie było w żadnym rozkazie. Dzięki temu
   * w historii funkcji widać, które wpisy mają umocowanie w dokumencie,
   * a które powstały interwencją administratora.
   */
  async appointFunction(input: AppointFunctionInput) {
    const [unit, person] = await Promise.all([
      this.prisma.unit.findUnique({ where: { id: input.unitId } }),
      this.prisma.person.findUnique({ where: { id: input.personId } }),
    ]);
    if (!unit) throw new NotFoundException('Jednostka nie istnieje');
    if (!person) throw new NotFoundException('Osoba nie istnieje');

    // §7.4: p.o. wymaga opiekuna. Root może to pominąć, ale świadomie.
    if (input.isActing && !input.guardianInstructorId && !input.force) {
      throw new NotFoundException({
        code: 'GUARDIAN_REQUIRED_FOR_ACTING',
        message:
          'Pełniący obowiązki wymaga wskazania opiekuna. Aby pominąć, powtórz z force = true.',
      });
    }

    const created = await this.prisma.unitLeadership.create({
      data: {
        unitId: input.unitId,
        personId: input.personId,
        roleKey: input.roleKey,
        isActing: input.isActing ?? false,
        guardianInstructorId: input.guardianInstructorId ?? null,
        // Świadomie null — mianowanie poza rozkazem (§10.1).
        appointedByOrderId: null,
      },
    });

    await this.record(input, 'APPOINT_FUNCTION', 'UnitLeadership', created.id, null, {
      unitId: input.unitId,
      personId: input.personId,
      roleKey: input.roleKey,
      isActing: created.isActing,
      withoutOrder: true,
    });
    return created;
  }

  /**
   * Kończy pełnienie funkcji BEZ rozkazu.
   *
   * @param input - identyfikator wpisu i powód
   * @returns zaktualizowany rekord z ustawionym `validTo`
   * @throws NotFoundException gdy wpis nie istnieje lub już zakończony
   */
  async endFunction(input: EndFunctionInput) {
    const existing = await this.prisma.unitLeadership.findUnique({
      where: { id: input.leadershipId },
    });
    if (!existing || existing.validTo) throw new NotFoundException('Funkcja nie istnieje');

    const updated = await this.prisma.unitLeadership.update({
      where: { id: input.leadershipId },
      data: { validTo: new Date() },
    });

    await this.record(input, 'END_FUNCTION', 'UnitLeadership', updated.id, existing, {
      validTo: updated.validTo,
      withoutOrder: true,
    });
    return updated;
  }

  /**
   * Dowolna edycja jednostki, łącznie ze statusem i kategorią.
   *
   * @param input - jednostka, zmieniane pola i powód
   * @returns zaktualizowana jednostka
   * @throws NotFoundException gdy jednostka nie istnieje
   */
  async patchUnit(input: PatchUnitInput) {
    const before = await this.prisma.unit.findUnique({ where: { id: input.unitId } });
    if (!before) throw new NotFoundException('Jednostka nie istnieje');

    const data = this.pick(input.data, UNIT_WRITABLE);
    const after = await this.prisma.unit.update({
      where: { id: input.unitId },
      data: data as Prisma.UnitUpdateInput,
    });

    await this.record(input, 'PATCH_UNIT', 'Unit', input.unitId, before, {
      changed: Object.keys(data),
      values: data,
    });
    return after;
  }

  /**
   * Dowolna edycja osoby, łącznie z kategorią członkostwa i statusem.
   *
   * @param input - osoba, zmieniane pola i powód
   * @returns zaktualizowany profil
   * @throws NotFoundException gdy osoba nie istnieje
   *
   * @remarks Adres e-mail celowo NIE jest edytowalny tą drogą. Zmiana adresu
   * musi przejść przez `ChangeEmailUseCase`, bo wymaga synchronizacji
   * z Keycloak w ustalonej kolejności (§9.6) — bezpośredni zapis do bazy
   * rozjechałby tożsamość i odciął użytkownika od logowania.
   */
  async patchPerson(input: PatchPersonInput) {
    const before = await this.prisma.person.findUnique({ where: { id: input.personId } });
    if (!before) throw new NotFoundException('Osoba nie istnieje');

    const data = this.pick(input.data, PERSON_WRITABLE);
    const after = await this.prisma.person.update({
      where: { id: input.personId },
      data: data as Prisma.PersonUpdateInput,
    });

    await this.record(input, 'PATCH_PERSON', 'Person', input.personId, before, {
      changed: Object.keys(data),
      values: data,
    });
    return after;
  }
}
