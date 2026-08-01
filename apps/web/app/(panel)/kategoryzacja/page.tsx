/**
 * Kategoryzacja drużyn (§13.4) — cykl roku harcerskiego.
 *
 * Kategorię przyznaje rozkazem odpowiedni poziom: polową hufcowy, leśną
 * komendant chorągwi, puszczańską Naczelnik. Arkusz wymagań jest słownikiem
 * wersjonowanym, wypełnianym na bieżąco przez drużynowego.
 */
import { apiSafe } from '../../../lib/api';
import { requireSession } from '../../../lib/session';
import { getActiveUnitId } from '../../../lib/context';
import { saveCategorization } from '../../actions';
import { ActionForm, Select, TextArea } from '../../components/action-form';
import { Alert, Card, Empty, PageHeader } from '../../components/ui';
import { scoutingYear } from '../../../lib/format';

export const dynamic = 'force-dynamic';

export default async function CategorizationPage() {
  const session = await requireSession();
  const me = await apiSafe<{ units: Array<{ id: string; displayName: string }>; isSysadmin: boolean }>(
    `/directory/me?sub=${encodeURIComponent(session.sub)}`,
    { units: [], isSysadmin: false },
  );
  const canSeeAll = session.isRoot || me.isSysadmin;
  const units = canSeeAll
    ? await apiSafe<Array<{ id: string; displayName: string }>>('/directory/units', [])
    : me.units;
  const activeUnitId = await getActiveUnitId(units as never);
  const unitName = units.find((u) => u.id === activeUnitId)?.displayName ?? '';
  const year = scoutingYear();

  const sheets = await apiSafe<Array<{ code: string; labelPl: string }>>(
    '/directory/dictionary/unit_categories',
    [],
  );

  if (!activeUnitId) {
    return (
      <>
        <PageHeader title="Kategoryzacja" />
        <Card>
          <Empty
            icon="🏕"
            title="Wybierz jednostkę"
            hint="Kategoryzacja dotyczy konkretnej drużyny. Wybierz ją przełącznikiem kontekstu."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Kategoryzacja" subtitle={`${unitName} · rok harcerski ${year}`} />

      <div className="grid grid-2">
        <Card title="Arkusz kategoryzacyjny">
          <ActionForm action={saveCategorization} submitLabel="Zapisz arkusz">
            <input type="hidden" name="unitId" value={activeUnitId} />
            <input type="hidden" name="year" value={year} />
            <Select
              name="declaredCategory"
              label="Deklarowana kategoria"
              required
              options={[
                { value: 'POLOWA', label: 'Polowa — przyznaje hufcowy' },
                { value: 'LESNA', label: 'Leśna — przyznaje komendant chorągwi' },
                { value: 'PUSZCZANSKA', label: 'Puszczańska — przyznaje Naczelnik' },
              ]}
              hint="Poziom przyznający wynika z kategorii, nie z miejsca jednostki w drzewie."
            />
            <TextArea
              name="note"
              label="Notatka do arkusza"
              rows={4}
              hint="Arkusz wypełnia się na bieżąco przez cały rok, a nie jednorazowo przed wizytacją."
            />
          </ActionForm>
        </Card>

        <div className="stack">
          <Alert tone="info" title="Jak przebiega kategoryzacja">
            Drużynowy wypełnia arkusz w ciągu roku, przełożony przeprowadza wizytację i wydaje
            opinię, a kategorię nadaje rozkaz właściwego poziomu. Zdobycie kategorii bywa celem
            wpisanym do planu pracy — to dwa powiązane, ale osobne procesy.
          </Alert>

          <Card title="Kategorie w słowniku">
            {sheets.length === 0 ? (
              <p className="small muted mb-0">
                Słownik kategorii nie został załadowany. Uruchom seed słowników, żeby wczytać
                aktualną wersję arkusza wraz z odwołaniem do źródłowego regulaminu.
              </p>
            ) : (
              <ul className="small" style={{ paddingLeft: '1.1rem', margin: 0 }}>
                {sheets.map((s) => (
                  <li key={s.code}>
                    <strong>{s.labelPl}</strong> <code className="mono xs">{s.code}</code>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
