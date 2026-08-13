/**
 * Podgląd pojedynczego dokumentu z katalogu `docs/`.
 *
 * Renderer jest celowo minimalny (nagłówki, listy, tabele, kod) — dokumentacja
 * projektowa nie potrzebuje pełnego Markdowna, a brak zewnętrznej biblioteki
 * upraszcza obraz produkcyjny.
 */
import Link from 'next/link';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { notFound } from 'next/navigation';
import { Card, PageHeader } from '../../../components/ui';
import { DOCS_DIR, DOC_TITLES } from '../docs';

export const dynamic = 'force-dynamic';

/** Zamienia podzbiór Markdowna na elementy Reacta. */
function render(md: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const lines = md.split('\n');
  let listBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCode = false;
  let tableBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul key={key} style={{ paddingLeft: '1.2rem' }}>
        {listBuffer.map((li, i) => (
          <li key={i}>{inline(li)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  const flushTable = (key: string) => {
    if (tableBuffer.length < 2) {
      tableBuffer = [];
      return;
    }
    const cells = (row: string) =>
      row
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
    const head = cells(tableBuffer[0]!);
    const body = tableBuffer.slice(2).map(cells);
    out.push(
      <div className="table-wrap" key={key} style={{ margin: 'var(--space-4) 0' }}>
        <table className="data">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i}>{inline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => (
                  <td key={j}>{inline(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    tableBuffer = [];
  };

  lines.forEach((line, idx) => {
    if (line.startsWith('```')) {
      if (inCode) {
        out.push(
          <pre
            key={`c${idx}`}
            style={{
              background: 'var(--surface-sunken)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius)',
              overflowX: 'auto',
              fontSize: 'var(--text-sm)',
            }}
          >
            <code>{codeBuffer.join('\n')}</code>
          </pre>,
        );
        codeBuffer = [];
      }
      inCode = !inCode;
      return;
    }
    if (inCode) {
      codeBuffer.push(line);
      return;
    }

    if (line.trim().startsWith('|')) {
      tableBuffer.push(line.trim());
      return;
    }
    flushTable(`t${idx}`);

    if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ''));
      return;
    }
    flushList(`l${idx}`);

    if (line.startsWith('#### ')) out.push(<h4 key={idx} style={{ marginTop: 'var(--space-4)' }}>{inline(line.slice(5))}</h4>);
    else if (line.startsWith('### ')) out.push(<h3 key={idx} style={{ marginTop: 'var(--space-5)' }}>{inline(line.slice(4))}</h3>);
    else if (line.startsWith('## ')) out.push(<h2 key={idx} style={{ marginTop: 'var(--space-5)' }}>{inline(line.slice(3))}</h2>);
    else if (line.startsWith('# ')) out.push(<h1 key={idx}>{inline(line.slice(2))}</h1>);
    else if (line.trim() === '---') out.push(<hr key={idx} style={{ border: 0, borderTop: '1px solid var(--border)', margin: 'var(--space-5) 0' }} />);
    else if (line.trim() !== '') out.push(<p key={idx}>{inline(line)}</p>);
  });

  flushList('l-end');
  flushTable('t-end');
  return out;
}

/** Formatowanie w linii: **pogrubienie**, `kod`, [link](url). */
function inline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) parts.push(<code className="mono" key={key++}>{tok.slice(1, -1)}</code>);
    else {
      const label = tok.slice(1, tok.indexOf(']'));
      const href = tok.slice(tok.indexOf('(') + 1, -1);
      parts.push(
        <a key={key++} href={href}>
          {label}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Zabezpieczenie przed wyjściem poza katalog docs/.
  const safe = basename(slug).replace(/[^a-z0-9-]/gi, '');
  if (!safe) notFound();

  let content: string;
  try {
    content = await readFile(join(DOCS_DIR, `${safe}.md`), 'utf8');
  } catch {
    notFound();
  }

  const meta = DOC_TITLES[safe];

  return (
    <>
      <PageHeader
        title={meta?.title ?? safe}
        subtitle={meta?.desc}
        actions={
          <Link className="btn" href="/dokumenty">
            Wszystkie dokumenty
          </Link>
        }
      />
      <Card>
        <article style={{ maxWidth: '80ch' }}>{render(content)}</article>
      </Card>
    </>
  );
}
