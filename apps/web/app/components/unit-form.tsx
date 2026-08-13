'use client';

/**
 * Formularz nowej jednostki (§6.2) z filtrowaniem jednostek nadrzędnych.
 *
 * Lista rodziców zawęża się do tych, które przejdą walidację `validateUnitParent`
 * z @harc/domain — tej samej funkcji, której używa API. Reguła hierarchii nie
 * jest tu powielana, więc alias statutowy (Namiestnictwo = Chorągiew, Związek
 * Drużyn = Hufiec) działa automatycznie, bez dodatkowych warunków (§6.1).
 *
 * Filtr jest wygodą, nie zabezpieczeniem — ostateczną decyzję i tak podejmuje
 * API, zwracając 422 przy błędnym umocowaniu.
 */
import { useMemo, useState } from 'react';
import { validateUnitParent, type Branch, type UnitType } from '@harc/domain';
import { createUnit, type ActionResult } from '../actions';
import { ActionForm, Field } from './action-form';

export interface ParentOption {
  id: string;
  displayName: string;
  type: string;
  branch: string;
}

const UNIT_TYPES: Array<{ value: UnitType; label: string }> = [
  { value: 'CHORAGIEW', label: 'Chorągiew' },
  { value: 'NAMIESTNICTWO', label: 'Namiestnictwo (alias chorągwi)' },
  { value: 'HUFIEC', label: 'Hufiec' },
  { value: 'ZWIAZEK_DRUZYN', label: 'Związek drużyn (alias hufca)' },
  { value: 'DRUZYNA', label: 'Drużyna' },
  { value: 'DRUZYNA_WEDROWNICZA', label: 'Drużyna wędrownicza' },
  { value: 'GROMADA', label: 'Gromada' },
  { value: 'SAMODZIELNY_ZASTEP', label: 'Samodzielny zastęp' },
  { value: 'SZCZEP', label: 'Szczep' },
  { value: 'KRAG_HARCERSTWA_STARSZEGO', label: 'Krąg harcerstwa starszego' },
  { value: 'KRAG_INSTRUKTORSKI', label: 'Krąg instruktorski' },
];

/** Czytelne wyjaśnienie, dlaczego lista rodziców jest pusta. */
const MISSING_PARENT_HINT: Record<string, string> = {
  CHORAGIEW: 'Chorągiew podlega organizacji. Jednostki korzeniowe zakłada usługa init przy starcie środowiska.',
  NAMIESTNICTWO: 'Namiestnictwo podlega organizacji — tak samo jak chorągiew.',
  HUFIEC: 'Hufiec podlega chorągwi. Utwórz najpierw chorągiew w tej gałęzi.',
  ZWIAZEK_DRUZYN: 'Związek drużyn podlega chorągwi — tak samo jak hufiec.',
  DRUZYNA: 'Drużyna podlega hufcowi. Utwórz najpierw hufiec w tej gałęzi.',
  DRUZYNA_WEDROWNICZA: 'Drużyna wędrownicza podlega hufcowi.',
  GROMADA: 'Gromada podlega hufcowi.',
  SAMODZIELNY_ZASTEP: 'Samodzielny zastęp podlega bezpośrednio hufcowi.',
  SZCZEP: 'Szczep jest jednostką poziomą przypisaną do hufca.',
  KRAG_HARCERSTWA_STARSZEGO: 'Krąg może być umocowany przy hufcu, chorągwi albo organizacji.',
  KRAG_INSTRUKTORSKI: 'Krąg może być umocowany przy hufcu, chorągwi albo organizacji.',
};

export function NewUnitForm({ units }: { units: ParentOption[] }) {
  const [type, setType] = useState<UnitType>('CHORAGIEW');
  const [branch, setBranch] = useState<Branch>('HARCERZE');

  const parents = useMemo(
    () =>
      units.filter(
        (u) =>
          validateUnitParent({
            childType: type,
            childBranch: branch,
            parentType: u.type as UnitType,
            parentBranch: u.branch as Branch,
          }) === null,
      ),
    [units, type, branch],
  );

  return (
    <ActionForm action={createUnit as (p: ActionResult, fd: FormData) => Promise<ActionResult>} submitLabel="Utwórz jednostkę">
      <div className="field">
        <label htmlFor="f-type">
          Typ jednostki<span aria-hidden> *</span>
        </label>
        <select
          id="f-type"
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value as UnitType)}
        >
          {UNIT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-branch">
          Gałąź<span aria-hidden> *</span>
        </label>
        <select
          id="f-branch"
          name="branch"
          required
          value={branch}
          onChange={(e) => setBranch(e.target.value as Branch)}
        >
          <option value="HARCERZE">Harcerze (OH-y)</option>
          <option value="HARCERKI">Harcerki (OH-ek)</option>
        </select>
        <span className="hint">
          Jednostka nadrzędna musi być z tej samej gałęzi — lista poniżej uwzględnia ten warunek.
        </span>
      </div>

      {parents.length > 0 ? (
        <div className="field">
          <label htmlFor="f-parentId">
            Jednostka nadrzędna<span aria-hidden> *</span>
          </label>
          <select id="f-parentId" name="parentId" required>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
          <span className="hint">
            Pokazane są wyłącznie jednostki, pod którymi wybrany typ może zostać umocowany.
          </span>
        </div>
      ) : (
        <div className="alert alert-warning">
          <div>
            <div className="alert-title">Brak jednostki nadrzędnej dla tego wyboru</div>
            <div className="small">{MISSING_PARENT_HINT[type] ?? 'Utwórz najpierw jednostkę wyższego poziomu.'}</div>
          </div>
        </div>
      )}

      <div className="field-row">
        <Field name="number" label="Numer" placeholder="np. 1" />
        <Field
          name="localityName"
          label="Przymiotnik miejscowy"
          required
          placeholder="np. Sucholeska"
        />
      </div>
      <div className="field-row">
        <Field name="properName" label="Nazwa własna" placeholder="np. Grań" />
        <Field name="patron" label="Patron" placeholder="np. rtm. Witolda Pileckiego" />
      </div>
    </ActionForm>
  );
}
