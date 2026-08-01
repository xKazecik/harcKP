'use client';

/**
 * Formularz oparty na Server Action, z komunikatem błędu przy polach
 * i blokadą przycisku na czas wysyłki (§16.3: walidacja inline, komunikaty
 * powiązane z formularzem przez aria-describedby).
 */
import { useActionState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '../actions';

const INITIAL: ActionResult = { ok: false };

function SubmitButton({ label, variant = 'primary' }: { label: string; variant?: 'primary' | 'default' | 'danger' }) {
  const { pending } = useFormStatus();
  const cls = variant === 'primary' ? 'btn btn-primary' : variant === 'danger' ? 'btn btn-danger' : 'btn';
  return (
    <button type="submit" className={cls} disabled={pending}>
      {pending ? 'Zapisywanie…' : label}
    </button>
  );
}

export function ActionForm({
  action,
  submitLabel,
  variant = 'primary',
  children,
  extraActions,
  successHint,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  variant?: 'primary' | 'default' | 'danger' | undefined;
  children: ReactNode;
  extraActions?: ReactNode | undefined;
  successHint?: string | undefined;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction}>
      {state.message && (
        <div
          id="form-status"
          className={`alert alert-${state.ok ? 'success' : 'danger'}`}
          role={state.ok ? 'status' : 'alert'}
        >
          <div>{state.message}</div>
        </div>
      )}
      {state.ok && successHint && <p className="small muted">{successHint}</p>}

      {children}

      <div className="btn-row">
        <SubmitButton label={submitLabel} variant={variant} />
        {extraActions}
      </div>
    </form>
  );
}

/** Pole tekstowe z etykietą i podpowiedzią. */
export function Field({
  name,
  label,
  hint,
  type = 'text',
  required = false,
  defaultValue,
  placeholder,
  disabled = false,
}: {
  name: string;
  label: string;
  hint?: string | undefined;
  type?: string | undefined;
  required?: boolean | undefined;
  defaultValue?: string | number | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const id = `f-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** Pole wielowierszowe. */
export function TextArea({
  name,
  label,
  hint,
  rows = 4,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string | undefined;
  rows?: number | undefined;
  defaultValue?: string | undefined;
  placeholder?: string | undefined;
}) {
  const id = `f-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** Lista wyboru. */
export function Select({
  name,
  label,
  hint,
  options,
  defaultValue,
  required = false,
  allowEmpty,
}: {
  name: string;
  label: string;
  hint?: string | undefined;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string | undefined;
  required?: boolean | undefined;
  allowEmpty?: string | undefined;
}) {
  const id = `f-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
      >
        {allowEmpty && <option value="">{allowEmpty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** Pole wyboru tak/nie. */
export function Checkbox({
  name,
  label,
  hint,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  hint?: string | undefined;
  defaultChecked?: boolean | undefined;
}) {
  const id = `f-${name}`;
  return (
    <div className="field">
      <label className="checkbox" htmlFor={id}>
        <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} />
        <span>{label}</span>
      </label>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** Przycisk wywołujący akcję bez własnych pól (np. „Opublikuj"). */
export function InlineAction({
  action,
  label,
  variant = 'default',
  hidden,
  confirm,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  label: string;
  variant?: 'primary' | 'default' | 'danger' | undefined;
  hidden: Record<string, string>;
  confirm?: string | undefined;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const cls = variant === 'primary' ? 'btn btn-primary btn-sm' : variant === 'danger' ? 'btn btn-danger btn-sm' : 'btn btn-sm';
  return (
    <form
      action={formAction}
      style={{ display: 'inline' }}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={cls} title={state.message}>
        {label}
      </button>
    </form>
  );
}
