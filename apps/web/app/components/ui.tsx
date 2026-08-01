/**
 * Wspólne komponenty prezentacyjne (§16.1).
 *
 * Wszystkie są serwerowe i bezstanowe. Kolory wyłącznie przez klasy oparte
 * na tokenach — żaden komponent nie zapisuje wartości koloru wprost (§21).
 */
import type { ReactNode } from 'react';
import { labelOf, type DictionaryName, type Tone } from '../../lib/labels';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'badge',
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  danger: 'badge badge-danger',
  info: 'badge badge-info',
  accent: 'badge badge-accent',
};

/** Odznaka statusu na podstawie słownika etykiet. */
export function StatusBadge({
  dictionary,
  value,
}: {
  dictionary: DictionaryName;
  value: string | null | undefined;
}) {
  const { label, tone } = labelOf(dictionary, value);
  return <span className={TONE_CLASS[tone]}>{label}</span>;
}

/** Nagłówek strony z opisem i miejscem na akcje. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="btn-row">{actions}</div>}
    </div>
  );
}

/** Karta z opcjonalnym nagłówkiem i akcją w prawym rogu. */
export function Card({
  title,
  action,
  children,
  footer,
  bodyless = false,
}: {
  title?: string | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  /** Gdy treścią jest tabela — bez paddingu, żeby wiersze dotykały krawędzi. */
  bodyless?: boolean | undefined;
}) {
  return (
    <section className="card">
      {title && (
        <div className="card-header">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {bodyless ? children : <div className="card-body">{children}</div>}
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

/**
 * Pusty stan (§16.3) — ZAWSZE z konkretną podpowiedzią, co zrobić dalej.
 * Samo „Brak danych" jest niedopuszczalne.
 */
export function Empty({
  icon = '📭',
  title,
  hint,
  action,
}: {
  icon?: string | undefined;
  title: string;
  hint: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{hint}</p>
      {action}
    </div>
  );
}

/** Kafelek liczbowy dashboardu. */
export function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  href?: string | undefined;
}) {
  const inner = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  );
  return href ? (
    <a className="stat" href={href}>
      {inner}
    </a>
  ) : (
    <div className="stat">{inner}</div>
  );
}

/** Komunikat kontekstowy. */
export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger' | undefined;
  title?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <div>
        {title && <div className="alert-title">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Pasek postępu karty progresji. */
export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Postęp: ${value} z ${max}`}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Zakładki wewnątrz sekcji. */
export function Tabs({
  items,
  active,
}: {
  items: Array<{ label: string; href: string }>;
  active: string;
}) {
  return (
    <nav className="tabs" aria-label="Sekcje">
      {items.map((t) => (
        <a key={t.href} href={t.href} className="tab" aria-current={t.href === active ? 'page' : undefined}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

/** Lista definicji — profile i wizytówki. */
export function DefinitionList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="dl">
      {items.map(([term, value], i) => (
        <div key={`${term}-${i}`} style={{ display: 'contents' }}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
