'use client';

/**
 * Pojedyncze pole ustawienia z zapisem inline (§5).
 *
 * Pole nadpisane zmienną środowiskową jest `readOnly`, wyszarzone i opatrzone
 * tooltipem. Ta blokada jest wyłącznie odzwierciedleniem stanu — autorytatywnie
 * odrzuca zapis API, zwracając 409 SETTING_LOCKED_BY_ENV.
 */
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '../../../actions';

const INITIAL: ActionResult = { ok: false };

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-sm" disabled={disabled || pending}>
      {pending ? '…' : 'Zapisz'}
    </button>
  );
}

export function InlineActionSetting({
  action,
  settingKey,
  value,
  locked,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  settingKey: string;
  value: string;
  locked: boolean;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const tooltip = locked
    ? `Nadpisane przez konfigurację serwera (zmienna: ${settingKey})`
    : undefined;

  return (
    <form action={formAction} className="row" style={{ gap: 6 }}>
      <input type="hidden" name="key" value={settingKey} />
      <input
        name="value"
        defaultValue={value}
        readOnly={locked}
        disabled={locked}
        title={tooltip}
        aria-describedby={locked ? `${settingKey}-locked` : undefined}
        style={{ fontSize: 'var(--text-sm)' }}
      />
      <SaveButton disabled={locked} />
      {locked && (
        <span id={`${settingKey}-locked`} className="xs muted">
          zablokowane
        </span>
      )}
      {state.message && (
        <span className={`xs ${state.ok ? 'muted' : ''}`} style={!state.ok ? { color: 'var(--danger)' } : undefined}>
          {state.message}
        </span>
      )}
    </form>
  );
}
