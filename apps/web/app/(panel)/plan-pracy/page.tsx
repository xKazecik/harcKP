/**
 * Plan pracy jednostki (§13.3) — rok harcerski 1.09–31.08.
 *
 * Workflow: DRAFT → SUBMITTED → RETURNED_FOR_CORRECTION → APPROVED | REJECTED.
 * Zatwierdza jednostka nadrzędna; dla drużyny — hufcowy. Po zatwierdzeniu
 * powstaje niezmienialna kopia PDF.
 *
 * To ODRĘBNY proces od spisu i kategoryzacji — nie łączymy ich w jeden
 * formularz, bo mają różne cykle i różnych decydentów (§13).
 */
import { apiSafe } from '../../../lib/api';
import { requireSession } from '../../../lib/session';
import { getActiveUnitId } from '../../../lib/context';
import { decideWorkPlan, saveWorkPlan, submitWorkPlan } from '../../actions';
import { ActionForm, Checkbox, Field, InlineAction, Select, TextArea } from '../../components/action-form';
import { Alert, Card, Empty, PageHeader, StatusBadge } from '../../components/ui';
import { scoutingYear } from '../../../lib/format';

export const dynamic = 'force-dynamic';

interface UnitContext {
  unit: { id: string; displayName: string; type: string };
  stats: { workPlanStatus: string | null; workPlanYear: string | null };
}

export default async function WorkPlanPage() {
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

  const ctx = activeUnitId
    ? await apiSafe<UnitContext | null>(`/directory/units/${activeUnitId}/context`, null)
    : null;

  const year = scoutingYear();

  if (!ctx) {
    return (
      <>
        <PageHeader title="Plan pracy" />
        <Card>
          <Empty
            icon="🗓"
            title="Wybierz jednostkę"
            hint="Plan pracy jest składany przez konkretną jednostkę. Wybierz ją przełącznikiem kontekstu."
          />
        </Card>
      </>
    );
  }

  const status = ctx.stats.workPlanStatus;
  const planYear = ctx.stats.workPlanYear ?? year;
  const editable = !status || status === 'DRAFT' || status === 'RETURNED_FOR_CORRECTION';

  return (
    <>
      <PageHeader
        title="Plan pracy"
        subtitle={`${ctx.unit.displayName} · rok harcerski ${planYear}`}
        actions={
          status ? <StatusBadge dictionary="workPlanStatus" value={status} /> : undefined
        }
      />

      {status === 'RETURNED_FOR_CORRECTION' && (
        <Alert tone="warning" title="Plan wrócił do poprawy">
          Jednostka nadrzędna odesłała plan z uwagami. Popraw treść i złóż go ponownie —
          numeracja i historia decyzji zostają zachowane.
        </Alert>
      )}

      {status === 'APPROVED' && (
        <Alert tone="success" title="Plan zatwierdzony">
          Powstała niezmienialna kopia PDF z datą, numerem i danymi zatwierdzającego.
          Późniejsze zmiany w kalendarzu nie modyfikują zatwierdzonej wersji.
        </Alert>
      )}

      <div className="grid grid-2">
        <Card title={editable ? 'Treść planu' : 'Treść planu (tylko podgląd)'}>
          {editable ? (
            <ActionForm
              action={saveWorkPlan}
              submitLabel="Zapisz szkic"
              extraActions={
                <InlineAction
                  action={submitWorkPlan}
                  label="Złóż do zatwierdzenia"
                  variant="primary"
                  hidden={{ unitId: ctx.unit.id, year: planYear }}
                  confirm="Po złożeniu planu nie da się go edytować do czasu decyzji jednostki nadrzędnej. Kontynuować?"
                />
              }
            >
              <input type="hidden" name="unitId" value={ctx.unit.id} />
              <input type="hidden" name="year" value={planYear} />
              <TextArea
                name="goals"
                label="Cele na rok harcerski"
                rows={5}
                hint="Jeden cel w wierszu."
                placeholder={'Zdobycie kategorii polowej\nKażdy harcerz z otwartą kartą stopnia'}
              />
              <Field
                name="serviceField"
                label="Pole służby"
                placeholder="np. pomoc w schronisku dla zwierząt"
              />
              <div className="field-row">
                <Field name="campLocation" label="Planowany obóz — miejsce" />
                <Select
                  name="declaredCategory"
                  label="Deklarowana kategoria"
                  options={[
                    { value: 'POLOWA', label: 'Polowa' },
                    { value: 'LESNA', label: 'Leśna' },
                    { value: 'PUSZCZANSKA', label: 'Puszczańska' },
                  ]}
                  allowEmpty="— nie deklaruję —"
                />
              </div>
              <Checkbox name="campPlanned" label="Jednostka planuje obóz w tym roku" />
            </ActionForm>
          ) : (
            <Empty
              icon="🔒"
              title="Plan jest w obiegu"
              hint="Plan złożony do zatwierdzenia jest zablokowany do edycji. Odblokuje się, gdy jednostka nadrzędna odeśle go do poprawy."
            />
          )}
        </Card>

        <div className="stack">
          <Card title="Decyzja jednostki nadrzędnej">
            {status === 'SUBMITTED' ? (
              <ActionForm action={decideWorkPlan} submitLabel="Zapisz decyzję">
                <input type="hidden" name="unitId" value={ctx.unit.id} />
                <input type="hidden" name="year" value={planYear} />
                <Select
                  name="decision"
                  label="Decyzja"
                  required
                  options={[
                    { value: 'APPROVED', label: 'Zatwierdzam' },
                    { value: 'RETURNED_FOR_CORRECTION', label: 'Zwracam do poprawy' },
                    { value: 'REJECTED', label: 'Odrzucam' },
                  ]}
                />
                <TextArea name="notes" label="Uwagi" rows={3} />
              </ActionForm>
            ) : (
              <p className="small muted mb-0">
                Decyzję podejmuje jednostka nadrzędna po złożeniu planu. Dla drużyny jest to
                hufcowy. Formularz decyzji pojawi się tutaj, gdy plan będzie miał status
                „Złożony”, a Ty będziesz mieć kompetencję APPROVE_WORK_PLAN dla tej jednostki.
              </p>
            )}
          </Card>

          <Alert tone="info" title="Widoczność planów">
            Jednostki nadrzędne widzą plany wszystkich jednostek podległych. Jednostki równoległe —
            nie. Zdobycie kategorii można wpisać jako cel; oceniane jest osobnym arkuszem
            kategoryzacji.
          </Alert>
        </div>
      </div>
    </>
  );
}
