/**
 * Ustawienia (§5) — trzy poziomy: domyślna w kodzie → baza → zmienna środowiskowa.
 *
 * Pole ze źródłem `env` jest wyszarzone i tylko do odczytu, z informacją którą
 * zmienną nadpisano. Blokada jest egzekwowana także po stronie API (409
 * SETTING_LOCKED_BY_ENV) — UI jedynie ją odzwierciedla.
 */
import { apiSafe } from '../../../../lib/api';
import { updateSetting } from '../../../actions';
import { InlineActionSetting } from './setting-form';
import { Alert, Card, Empty, PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

interface Setting {
  key: string;
  value: string;
  source: 'default' | 'database' | 'env';
  isLocked: boolean;
}

export default async function SettingsPage() {
  const settings = await apiSafe<Setting[]>('/admin/settings', []);
  const locked = settings.filter((s) => s.isLocked).length;

  return (
    <>
      <PageHeader
        title="Ustawienia"
        subtitle={`${settings.length} kluczy · ${locked} nadpisanych przez serwer`}
        actions={
          <a className="btn" href="/admin">
            Wróć do panelu
          </a>
        }
      />

      <Alert tone="info" title="Kolejność źródeł">
        Wartość domyślna z kodu jest nadpisywana przez wartość z bazy, a ta przez zmienną
        środowiskową. Zmienna środowiskowa wygrywa zawsze — pola z tym źródłem są zablokowane
        i próba zapisu zostanie odrzucona przez API, nie tylko ukryta w interfejsie.
      </Alert>

      <Card bodyless>
        {settings.length === 0 ? (
          <Empty
            icon="⚙"
            title="Brak kluczy konfiguracyjnych"
            hint="ConfigService nie zwrócił żadnego klucza. Sprawdź, czy API działa i czy zmienne środowiskowe zostały wczytane."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Klucz</th>
                  <th>Wartość</th>
                  <th>Źródło</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.key}>
                    <td>
                      <code className="mono">{s.key}</code>
                    </td>
                    <td style={{ minWidth: 260 }}>
                      <InlineActionSetting
                        action={updateSetting}
                        settingKey={s.key}
                        value={s.value}
                        locked={s.isLocked}
                      />
                    </td>
                    <td>
                      <span
                        className={
                          s.source === 'env'
                            ? 'badge badge-warning'
                            : s.source === 'database'
                              ? 'badge badge-accent'
                              : 'badge'
                        }
                      >
                        {s.source === 'env'
                          ? 'zmienna serwera'
                          : s.source === 'database'
                            ? 'baza'
                            : 'domyślna'}
                      </span>
                    </td>
                    <td className="xs muted">
                      {s.isLocked ? `Nadpisane przez konfigurację serwera (${s.key})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
