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
      case 'SYSADMIN_CANNOT_MANAGE_SYSADMIN':
        return 'Sysadmin nie może nadawać ani odbierać roli sysadmina — robi to wyłącznie root.';
      case 'CANNOT_MANAGE_OWN_GRANTS':
        return 'Nie możesz zmieniać własnych uprawnień. Poproś o to root lub inną osobę uprawnioną.';
      case 'OUTSIDE_ADMIN_SCOPE':
        return 'Ta jednostka jest poza Twoim zasięgiem administracyjnym.';
      case 'NO_ADMIN_AUTHORITY':
        return 'Nie masz uprawnień do zarządzania rolami administracyjnymi.';
      case 'UNIT_REQUIRED_FOR_UNIT_ADMIN':
        return 'Rola administratora jednostki wymaga wskazania jednostki.';
      case 'GRANT_ALREADY_ACTIVE':
        return 'To uprawnienie już obowiązuje.';
      case 'ACTION_NOT_DELEGABLE':
        return 'Tej kompetencji nie da się delegować — wynika wprost z funkcji.';
      case 'DELEGATOR_LACKS_COMPETENCE':
        return 'Nie możesz delegować kompetencji, której sam nie masz w tej jednostce.';
      case 'EXPIRY_REQUIRED':
      case 'EXPIRY_IN_PAST':
        return 'Delegacja musi mieć datę wygaśnięcia w przyszłości.';
      case 'NOT_DELEGATION_OWNER':
        return 'Delegację może odwołać tylko osoba, która ją nadała.';
      case 'IDENTITY_PROVIDER_UNAVAILABLE':
        return 'Serwer logowania jest chwilowo niedostępny, więc nic nie zostało zmienione. Twój dotychczasowy adres nadal działa — otwórz link ponownie za chwilę.';
      case 'INVALID_OR_EXPIRED_TOKEN':
        return 'Link jest nieprawidłowy albo stracił ważność. Zgłoś zmianę ponownie.';
      case 'EMAIL_UNCHANGED':
        return 'To jest Twój obecny adres — nie ma czego zmieniać.';
      case 'PROFILE_NOT_ACTIVE':
        return 'Zmiana adresu jest możliwa tylko dla aktywnego profilu.';
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

/**
 * Zgłoszenie zmiany własnego adresu e-mail (§9.6).
 *
 * Link potwierdzający idzie na NOWY adres — stary działa do czasu kliknięcia,
 * więc pomyłka w pisowni nie odcina użytkownika od logowania.
 */
export async function requestEmailChange(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await api('/persons/me/email-change', {
      method: 'POST',
      body: JSON.stringify({ newEmail: str(fd, 'newEmail') }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/profil');
  return { ok: true, message: 'Link potwierdzający wysłany na nowy adres.' };
}

/** Anulowanie oczekującego żądania zmiany adresu (§9.6). */
export async function cancelEmailChange(
  _prev: ActionResult,
  _fd: FormData,
): Promise<ActionResult> {
  try {
    await api('/persons/me/email-change/cancel', { method: 'POST' });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/profil');
  return { ok: true, message: 'Zmiana adresu anulowana.' };
}

/** Nadanie roli administracyjnej (§10.1) — regułę wymusza domena, nie ten formularz. */
export async function grantAdminRole(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const role = str(fd, 'role');
  try {
    await api('/admin/admin-grants', {
      method: 'POST',
      body: JSON.stringify({
        targetPersonId: str(fd, 'targetPersonId'),
        role,
        unitId: role === 'UNIT_ADMIN' ? opt(fd, 'unitId') : null,
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/role');
  return { ok: true, message: 'Uprawnienie nadane.' };
}

/** Odebranie roli administracyjnej — zapis `revokedAt`, rekord zostaje (§18). */
export async function revokeAdminRole(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/admin/admin-grants/${str(fd, 'grantId')}/revoke`, { method: 'POST' });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/role');
  return { ok: true, message: 'Uprawnienie odebrane.' };
}

/** Delegacja pojedynczej kompetencji funkcyjnemu (§10.4). */
export async function grantDelegation(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const expires = str(fd, 'expiresAt');
  if (!expires) {
    return {
      ok: false,
      message: 'Podaj datę wygaśnięcia — delegacja bezterminowa jest niedopuszczalna.',
      fieldErrors: { expiresAt: 'Wymagane' },
    };
  }
  try {
    await api('/admin/delegations', {
      method: 'POST',
      body: JSON.stringify({
        toPersonId: str(fd, 'toPersonId'),
        action: str(fd, 'action'),
        unitId: str(fd, 'unitId'),
        // <input type="date"> daje samą datę — delegacja wygasa na koniec dnia.
        expiresAt: new Date(`${expires}T23:59:59Z`).toISOString(),
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/role');
  return { ok: true, message: 'Delegacja nadana.' };
}

/** Odwołanie delegacji przed terminem (§10.4). */
export async function revokeDelegation(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/admin/delegations/${str(fd, 'delegationId')}/revoke`, { method: 'POST' });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/role');
  return { ok: true, message: 'Delegacja odwołana.' };
}

/**
 * Tryb roota: nadanie funkcji BEZ rozkazu (§10.1).
 *
 * Powód jest wymagany i trafia do audit logu jako `ROOT_OVERRIDE`.
 */
export async function rootAppointFunction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await api('/root/leadership', {
      method: 'POST',
      body: JSON.stringify({
        unitId: str(fd, 'unitId'),
        personId: str(fd, 'personId'),
        roleKey: str(fd, 'roleKey') || 'LEADER',
        isActing: fd.get('isActing') === 'on',
        ...(opt(fd, 'guardianInstructorId') && {
          guardianInstructorId: str(fd, 'guardianInstructorId'),
        }),
        reason: str(fd, 'reason'),
        force: fd.get('force') === 'on',
      }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/root');
  return { ok: true, message: 'Funkcja nadana poza rozkazem. Operacja zapisana w audycie.' };
}

/** Tryb roota: zwolnienie z funkcji BEZ rozkazu (§10.1). */
export async function rootEndFunction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await api(`/root/leadership/${str(fd, 'leadershipId')}/end`, {
      method: 'POST',
      body: JSON.stringify({ reason: str(fd, 'reason') || 'Zwolnienie w trybie roota' }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/root');
  return { ok: true, message: 'Funkcja zakończona. Operacja zapisana w audycie.' };
}

/** Tryb roota: dowolna edycja jednostki (§10.1). */
export async function rootPatchUnit(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(str(fd, 'data') || '{}') as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      message: 'Pole „zmiany" musi być poprawnym JSON-em, np. {"status":"ACTIVE"}.',
      fieldErrors: { data: 'Niepoprawny JSON' },
    };
  }
  try {
    await api(`/root/units/${str(fd, 'unitId')}`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: str(fd, 'reason'), force: fd.get('force') === 'on', data }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/root');
  return { ok: true, message: 'Jednostka zmieniona. Operacja zapisana w audycie.' };
}

/** Tryb roota: dowolna edycja osoby (§10.1). */
export async function rootPatchPerson(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(str(fd, 'data') || '{}') as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      message: 'Pole „zmiany" musi być poprawnym JSON-em, np. {"school":"SP 12"}.',
      fieldErrors: { data: 'Niepoprawny JSON' },
    };
  }
  try {
    await api(`/root/persons/${str(fd, 'personId')}`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: str(fd, 'reason'), force: fd.get('force') === 'on', data }),
    });
  } catch (err) {
    return { ok: false, message: explain(err) };
  }
  revalidatePath('/admin/root');
  return { ok: true, message: 'Profil zmieniony. Operacja zapisana w audycie.' };
}
