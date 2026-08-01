'use server';

/**
 * Server Actions — mutacje wywoływane z formularzy.
 *
 * Każda akcja jedynie przekazuje dane do API; reguły domenowe i autoryzacja
 * (§10) egzekwowane są po stronie API, nigdy tutaj. Warstwa webowa nie
 * podejmuje decyzji o uprawnieniach — może co najwyżej ukryć przycisk.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '../lib/api';

/** Ujednolicony wynik akcji dla `useActionState`. */
export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

/** Tłumaczy kod błędu API na komunikat dla użytkownika. */
function explain(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { code?: string; message?: string; violation?: string } | null;
    const code = body?.code;
    switch (code) {
      case 'EMAIL_ALREADY_IN_USE':
        return 'Ten adres e-mail należy do aktywnego profilu. Podaj inny adres.';
      case 'UNIT_HIERARCHY_VIOLATION':
        return `Takie umocowanie w strukturze jest niedozwolone (${body?.violation ?? 'reguła hierarchii'}).`;
      case 'SETTING_LOCKED_BY_ENV':
        return 'To ustawienie jest nadpisane przez konfigurację serwera i nie da się go zmienić z panelu.';
      case 'FORBIDDEN':
        return 'Nie masz kompetencji do wykonania tej akcji w tej jednostce.';
      case 'MINOR_PROTECTION_NOT_VERIFIED':
        return 'Osoba nie ma ważnej weryfikacji ochrony małoletnich — mianowanie jest zablokowane.';
      case 'SUBJECT_UNAVAILABLE':
        return 'Nie można wykonać akcji na profilu archiwalnym.';
      case 'RETRY_BLOCKED':
        return 'Ponowne podejście jest zablokowane karencją po zamknięciu negatywnym.';
      default:
        if (err.status === 422) return `Dane nie przeszły walidacji (${code ?? '422'}).`;
        return body?.message ?? `Operacja nie powiodła się (HTTP ${err.status}).`;
    }
  }
  return 'Nie udało się połączyć z API. Spróbuj ponownie.';
}

const str = (fd: FormData, key: string): string => String(fd.get(key) ?? '').trim();
const opt = (fd: FormData, key: string): string | undefined => str(fd, key) || undefined;

/**
 * Przyjęcie do jednostki (§8.2, krok 1) — formularz ma DOKŁADNIE trzy pola.
 * Resztę profilu uzupełnia zapraszany w kreatorze.
 */
export async function invitePerson(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api('/persons/invite', {
      method: 'POST',
      body: JSON.stringify({
        firstName: str(fd, 'firstName'),
        lastName: str(fd, 'lastName'),
        email: str(fd, 'email'),
        unitId: str(fd, 'unitId'),
        branch: str(fd, 'branch'),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/czlonkowie');
  redirect('/czlonkowie');
}

/** Profil bez konta (§8.2) — pełnoprawny ewidencyjnie, bez logowania. */
export async function createPersonWithoutAccount(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await api('/persons/without-account', {
      method: 'POST',
      body: JSON.stringify({
        firstName: str(fd, 'firstName'),
        lastName: str(fd, 'lastName'),
        branch: str(fd, 'branch'),
        unitId: str(fd, 'unitId'),
        ...(opt(fd, 'birthDate') && { birthDate: str(fd, 'birthDate') }),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/czlonkowie');
  redirect('/czlonkowie');
}

/** Odnotowanie opiekuna i zgody (§7.2) — zdejmuje przypomnienie z profilu. */
export async function addGuardian(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const personId = str(fd, 'personId');
  try {
    await api(`/persons/${personId}/guardians`, {
      method: 'POST',
      body: JSON.stringify({
        fullName: str(fd, 'fullName'),
        phone: str(fd, 'phone'),
        address: str(fd, 'address'),
        ...(opt(fd, 'email') && { email: str(fd, 'email') }),
        ...(opt(fd, 'consentGivenAt') && { consentGivenAt: str(fd, 'consentGivenAt') }),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath(`/czlonkowie/${personId}`);
  return { ok: true, message: 'Opiekun zapisany.' };
}

/** Archiwizacja (§8.3) — nie kasuje danych, zwalnia adres e-mail. */
export async function archivePerson(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const personId = str(fd, 'personId');
  try {
    await api(`/persons/${personId}/archive`, {
      method: 'POST',
      body: JSON.stringify({
        reason: str(fd, 'reason'),
        ...(opt(fd, 'reasonText') && { reasonText: str(fd, 'reasonText') }),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/czlonkowie');
  redirect('/admin/nieaktywne');
}

/** Przywrócenie profilu (§8.5) — wymaga świadomie wpisanego, wolnego adresu. */
export async function restorePerson(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const personId = str(fd, 'personId');
  try {
    await api(`/persons/${personId}/restore`, {
      method: 'POST',
      body: JSON.stringify({
        newEmail: str(fd, 'newEmail'),
        confirmHistoricalEmail: fd.get('confirmHistoricalEmail') === 'on',
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/nieaktywne');
  return { ok: true, message: 'Profil przywrócony. Wysłano nowe zaproszenie.' };
}

/** Utworzenie jednostki (§6.2) — nazwa wyświetlana jest generowana. */
export async function createUnit(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api('/units', {
      method: 'POST',
      body: JSON.stringify({
        type: str(fd, 'type'),
        branch: str(fd, 'branch'),
        localityName: str(fd, 'localityName'),
        ...(opt(fd, 'parentId') && { parentId: str(fd, 'parentId') }),
        ...(opt(fd, 'number') && { number: str(fd, 'number') }),
        ...(opt(fd, 'properName') && { properName: str(fd, 'properName') }),
        ...(opt(fd, 'patron') && { patron: str(fd, 'patron') }),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/jednostki');
  redirect('/jednostki');
}

/**
 * Wizytówka jednostki (§15) — komendant edytuje w dowolnym momencie.
 * O publikacji decyduje sam komendant, bez akceptacji jednostki nadrzędnej.
 */
export async function updateUnitCard(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const unitId = str(fd, 'unitId');
  const lat = Number(str(fd, 'lat'));
  const lng = Number(str(fd, 'lng'));
  const hasPlace = Number.isFinite(lat) && Number.isFinite(lng) && str(fd, 'address');

  try {
    await api(`/units/${unitId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(opt(fd, 'description') !== undefined && { description: str(fd, 'description') || null }),
        ...(str(fd, 'publicEmail') ? { publicEmail: str(fd, 'publicEmail') } : { publicEmail: null }),
        isPubliclyVisible: fd.get('isPubliclyVisible') === 'on',
        locationPrecision: str(fd, 'locationPrecision') || 'EXACT',
        ...(hasPlace
          ? {
              meetingPlace: {
                lat,
                lng,
                address: str(fd, 'address'),
                ...(opt(fd, 'meetingTimes') && { meetingTimes: str(fd, 'meetingTimes') }),
              },
            }
          : {}),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/jednostka');
  return { ok: true, message: 'Wizytówka zapisana.' };
}

/**
 * Przyjęcie instruktora i wpis na listę (§7.3).
 *
 * Kompetencja ADMIT_INSTRUCTOR należy do poziomu chorągwi i wyżej — API odrzuci
 * żądanie od drużynowego albo hufcowego, nawet gdyby dotarł do formularza.
 */
export async function createInstructor(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api('/instructors', {
      method: 'POST',
      body: JSON.stringify({
        firstName: str(fd, 'firstName'),
        lastName: str(fd, 'lastName'),
        ...(opt(fd, 'email') && { email: str(fd, 'email') }),
        branch: str(fd, 'branch'),
        homeChoragiewId: str(fd, 'homeChoragiewId'),
        rank: str(fd, 'rank'),
        rankAwardedAt: str(fd, 'rankAwardedAt'),
        listType: str(fd, 'listType'),
        mainAssignmentLevel: str(fd, 'mainAssignmentLevel'),
        ...(opt(fd, 'mainAssignmentUnitId') && {
          mainAssignmentUnitId: str(fd, 'mainAssignmentUnitId'),
        }),
        ...(opt(fd, 'instructorPledgeDate') && {
          instructorPledgeDate: str(fd, 'instructorPledgeDate'),
        }),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/instruktorzy');
  redirect('/instruktorzy');
}

/** Rozpoczęcie karty stopnia/sprawności (§12.1). */
export async function startProgression(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api('/progression/start', {
      method: 'POST',
      body: JSON.stringify({
        personId: str(fd, 'personId'),
        unitId: str(fd, 'unitId'),
        kind: str(fd, 'kind'),
        targetCode: str(fd, 'targetCode'),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/progresja');
  return { ok: true, message: 'Karta otwarta.' };
}

/** Harcerz zgłasza wykonanie zadania z komentarzem (§12.5). */
export async function submitRequirement(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/progression/requirements/${str(fd, 'requirementId')}/submit`, {
      method: 'POST',
      body: JSON.stringify({ comment: str(fd, 'comment') }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath(`/progresja/${str(fd, 'instanceId')}`);
  return { ok: true, message: 'Zgłoszenie wysłane do drużynowego.' };
}

/** Drużynowy zalicza zadanie. */
export async function verifyRequirement(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/progression/requirements/${str(fd, 'requirementId')}/verify`, { method: 'POST' });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/progresja');
  revalidatePath(`/progresja/${str(fd, 'instanceId')}`);
  return { ok: true, message: 'Zadanie zaliczone.' };
}

/**
 * Wycofanie z wyczynu (§12.2) — akcja DOZWOLONA i NIEOCENIAJĄCA.
 * Harcerz może się wycofać na każdym etapie bez konsekwencji.
 */
export async function withdrawFeat(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/progression/requirements/${str(fd, 'requirementId')}/withdraw-feat`, {
      method: 'POST',
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath(`/progresja/${str(fd, 'instanceId')}`);
  return { ok: true, message: 'Wycofano z wyczynu.' };
}

/** Zatwierdzenie warunków bezpieczeństwa wyczynu (§12.2). */
export async function approveFeat(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/progression/requirements/${str(fd, 'requirementId')}/approve-feat`, {
      method: 'POST',
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath(`/progresja/${str(fd, 'instanceId')}`);
  return { ok: true, message: 'Warunki bezpieczeństwa zatwierdzone.' };
}

/** Utworzenie szkicu rozkazu (§11.1). */
export async function createOrder(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  let created: { id: string } | undefined;
  try {
    created = await api<{ id: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        unitId: str(fd, 'unitId'),
        number: str(fd, 'number'),
        issuedAt: new Date(str(fd, 'issuedAt')).toISOString(),
        place: str(fd, 'place'),
        ...(opt(fd, 'contentText') && { contentText: str(fd, 'contentText') }),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/rozkazy');
  redirect(`/rozkazy/${created.id}`);
}

/** Publikacja rozkazu — od tej chwili pozycje wywołują skutki ewidencyjne. */
export async function publishOrder(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = str(fd, 'orderId');
  try {
    await api(`/orders/${id}/publish`, { method: 'POST' });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath(`/rozkazy/${id}`);
  return { ok: true, message: 'Rozkaz opublikowany.' };
}

/** Dodanie pozycji do rozkazu (§11.2). */
export async function addOrderItem(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = str(fd, 'orderId');
  try {
    await api(`/orders/${id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        section: str(fd, 'section'),
        type: str(fd, 'type'),
        effectiveDate: new Date(str(fd, 'effectiveDate')).toISOString(),
        ...(opt(fd, 'subjectPersonId') && { subjectPersonId: str(fd, 'subjectPersonId') }),
        ...(opt(fd, 'subjectUnitId') && { subjectUnitId: str(fd, 'subjectUnitId') }),
        payload: opt(fd, 'note') ? { note: str(fd, 'note') } : {},
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath(`/rozkazy/${id}`);
  return { ok: true, message: 'Pozycja dodana.' };
}

/** Zapis szkicu planu pracy (§13.3). */
export async function saveWorkPlan(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const unitId = str(fd, 'unitId');
  const year = str(fd, 'year').replace('/', '-');
  try {
    await api(`/planning/work-plans/${unitId}/${year}`, {
      method: 'POST',
      body: JSON.stringify({
        content: {
          goals: str(fd, 'goals')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          serviceField: str(fd, 'serviceField'),
          camp: { planned: fd.get('campPlanned') === 'on', location: str(fd, 'campLocation') },
          declaredCategory: str(fd, 'declaredCategory'),
        },
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/plan-pracy');
  return { ok: true, message: 'Plan zapisany jako szkic.' };
}

/** Złożenie planu do zatwierdzenia przez jednostkę nadrzędną. */
export async function submitWorkPlan(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const unitId = str(fd, 'unitId');
  const year = str(fd, 'year').replace('/', '-');
  try {
    await api(`/planning/work-plans/${unitId}/${year}/submit`, { method: 'POST' });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/plan-pracy');
  return { ok: true, message: 'Plan złożony do zatwierdzenia.' };
}

/** Decyzja jednostki nadrzędnej o planie pracy (§13.3). */
export async function decideWorkPlan(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const unitId = str(fd, 'unitId');
  const year = str(fd, 'year').replace('/', '-');
  try {
    await api(`/planning/work-plans/${unitId}/${year}/decide`, {
      method: 'POST',
      body: JSON.stringify({
        decision: str(fd, 'decision'),
        ...(opt(fd, 'notes') && { notes: str(fd, 'notes') }),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/plan-pracy');
  return { ok: true, message: 'Decyzja zapisana.' };
}

/** Arkusz kategoryzacji drużyny (§13.4). */
export async function saveCategorization(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const unitId = str(fd, 'unitId');
  const year = str(fd, 'year').replace('/', '-');
  try {
    await api(`/planning/categorization/${unitId}/${year}`, {
      method: 'POST',
      body: JSON.stringify({
        declaredCategory: str(fd, 'declaredCategory'),
        answers: { note: str(fd, 'note') },
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/kategoryzacja');
  return { ok: true, message: 'Arkusz zapisany.' };
}

/** Deklaracja spisowa instruktora (§13.1). */
export async function submitCensus(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/planning/census/instructors/${str(fd, 'campaignId')}/declare`, {
      method: 'POST',
      body: JSON.stringify({
        declaredListType: str(fd, 'declaredListType'),
        requestedAction: str(fd, 'requestedAction'),
        feePaidConfirmed: fd.get('feePaidConfirmed') === 'on',
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/spis');
  return { ok: true, message: 'Deklaracja spisowa złożona.' };
}

/** Otwarcie kampanii spisowej na dany rok (§13.1, §13.2). */
export async function openCensus(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const kind = str(fd, 'kind') === 'UNITS' ? 'units' : 'instructors';
  try {
    await api(`/planning/census/${kind}/${str(fd, 'year')}/open`, { method: 'POST' });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/spis');
  return { ok: true, message: 'Kampania spisowa otwarta.' };
}

/** Zmiana ustawienia w panelu (§5) — pola z env są zablokowane po stronie API. */
export async function updateSetting(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/admin/settings/${encodeURIComponent(str(fd, 'key'))}`, {
      method: 'PUT',
      body: JSON.stringify({ value: str(fd, 'value') }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/ustawienia');
  return { ok: true, message: 'Ustawienie zapisane.' };
}

/** Ponowne wysłanie zaproszenia — z cooldownem po stronie API (§8.2). */
export async function resendInvitation(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/invitations/${str(fd, 'invitationId')}/resend`, { method: 'POST' });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/zaproszenia');
  return { ok: true, message: 'Zaproszenie wysłane ponownie.' };
}

/** Unieważnienie zaproszenia przez komendanta (§8.2). */
export async function revokeInvitation(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/invitations/${str(fd, 'invitationId')}/revoke`, { method: 'POST' });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/zaproszenia');
  return { ok: true, message: 'Zaproszenie unieważnione.' };
}
