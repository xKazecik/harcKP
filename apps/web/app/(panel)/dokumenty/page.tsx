/**
 * Dokumentacja renderowana wewnątrz aplikacji (§18).
 *
 * Pliki pochodzą z katalogu `docs/` w repozytorium — są wersjonowane razem
 * z kodem, więc opis nie rozjeżdża się z zachowaniem systemu.
 */
import { readdir } from 'node:fs/promises';
import { Card, Empty, PageHeader } from '../../components/ui';
import { DOCS_DIR, DOC_TITLES } from './docs';

export const dynamic = 'force-dynamic';

export default async function DocsPage() {
  let files: string[] = [];
  try {
    files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith('.md')).sort();
  } catch {
    files = [];
  }

  return (
    <>
      <PageHeader
        title="Dokumentacja"
        subtitle="Instrukcje użytkownika, administratora i mapowanie reguł na przepisy"
      />

      {files.length === 0 ? (
        <Card>
          <Empty
            icon="📚"
            title="Nie znaleziono plików dokumentacji"
            hint="Dokumentacja jest czytana z katalogu docs/ w repozytorium. W obrazie produkcyjnym katalog musi zostać skopiowany do warstwy runtime."
          />
        </Card>
      ) : (
        <div className="grid grid-3">
          {files.map((f) => {
            const slug = f.replace(/\.md$/, '');
            const meta = DOC_TITLES[slug];
            return (
              <a key={f} href={`/dokumenty/${slug}`} className="stat" style={{ gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 22 }} aria-hidden>
                  {meta?.icon ?? '📄'}
                </span>
                <strong>{meta?.title ?? slug}</strong>
                <span className="stat-hint">{meta?.desc ?? 'Dokument projektowy.'}</span>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
