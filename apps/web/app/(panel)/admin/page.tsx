/**
 * Panel administracyjny (§18) — rozdzielacz do sekcji.
 */
import Link from 'next/link';
import { apiSafe } from '../../../lib/api';
import { Card, PageHeader, Stat } from '../../components/ui';

export const dynamic = 'force-dynamic';

interface Health {
  database: string;
  pendingExports: number;
  pendingApprovals: number;
  timestamp: string;
}

const SECTIONS = [
  {
    href: '/admin/ustawienia',
    icon: '⚙',
    title: 'Ustawienia',
    desc: 'Trzy poziomy konfiguracji: domyślna → baza → zmienna środowiskowa. Pola nadpisane przez serwer są zablokowane.',
  },
  {
    href: '/admin/slowniki',
    icon: '📖',
    title: 'Słowniki',
    desc: 'Wersjonowane katalogi stopni, sprawności, kompetencji i nomenklatury wraz z odwołaniem do źródłowego przepisu.',
  },
  {
    href: '/admin/uprawnienia',
    icon: '🔐',
    title: 'Uprawnienia efektywne',
    desc: 'Co dana osoba może zrobić w danej jednostce i skąd to uprawnienie wynika.',
  },
  {
    href: '/admin/zaproszenia',
    icon: '✉',
    title: 'Zaproszenia',
    desc: 'Oczekujące i wygasłe zaproszenia, ponowna wysyłka z cooldownem, unieważnienie.',
  },
  {
    href: '/admin/nieaktywne',
    icon: '🗄',
    title: 'Nieaktywne profile',
    desc: 'Osoby archiwalne z pełną historią i możliwością przywrócenia na nowy adres e-mail.',
  },
  {
    href: '/admin/audit',
    icon: '🧾',
    title: 'Audit log',
    desc: 'Pełny, niemodyfikowalny rejestr operacji z filtrowaniem.',
  },
];

export default async function AdminPage() {
  const health = await apiSafe<Health | null>('/admin/system-health', null);

  return (
    <>
      <PageHeader
        title="Panel administracyjny"
        subtitle="Konfiguracja, słowniki, uprawnienia i rejestry"
        actions={
          <Link className="btn" href="/dokumenty">
            Dokumentacja
          </Link>
        }
      />

      {health && (
        <div className="grid grid-4 mb-5">
          <Stat
            label="Baza danych"
            value={health.database === 'ok' ? 'OK' : 'Błąd'}
            hint="połączenie Prisma"
          />
          <Stat label="Eksporty w kolejce" value={health.pendingExports} />
          <Stat
            label="Oczekujące kontrasygnaty"
            value={health.pendingApprovals}
            hint="akcje p.o. do zatwierdzenia"
          />
          <Stat label="Stan na" value={new Date(health.timestamp).toLocaleTimeString('pl-PL')} />
        </div>
      )}

      <div className="grid grid-3">
        {SECTIONS.map((s) => (
          <a key={s.href} href={s.href} className="stat" style={{ gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 22 }} aria-hidden>
              {s.icon}
            </span>
            <strong>{s.title}</strong>
            <span className="stat-hint">{s.desc}</span>
          </a>
        ))}
      </div>

      <div style={{ marginTop: 'var(--space-5)' }}>
        <Card title="Eksport danych">
          <p className="small muted mb-0">
            Eksport z filtrowaniem hierarchicznym („wybierz jednostkę wraz ze wszystkimi
            podległymi”), wyborem zakresu pól i opcją anonimizacji jest generowany asynchronicznie
            przez workera; link wygasa po czasie z konfiguracji. Każdy eksport zawierający dane
            osobowe trafia do audit logu wraz z zakresem i celem — dlatego cel jest polem
            obowiązkowym.
          </p>
        </Card>
      </div>
    </>
  );
}
