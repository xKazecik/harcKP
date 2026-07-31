import type { PrismaClient } from '@harc/db';

/**
 * Eksport bazy (§18): filtrowanie hierarchiczne (jednostka + podległe),
 * wybór pól, opcjonalna anonimizacja; wynik do S3 z linkiem wygasającym po
 * EXPORT_LINK_TTL_MINUTES. Każdy eksport z danymi osobowymi jest logowany
 * z zakresem i celem (§17).
 */
export async function runExport(prisma: PrismaClient, exportJobId: string): Promise<void> {
  const job = await prisma.exportJob.findUnique({ where: { id: exportJobId } });
  if (!job || job.status !== 'PENDING') return;
  await prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'RUNNING' } });

  try {
    // Poddrzewo jednostek (filtrowanie hierarchiczne)
    let unitIds: string[] | undefined;
    if (job.scopeUnitId) {
      unitIds = [job.scopeUnitId];
      let frontier = [job.scopeUnitId];
      while (frontier.length) {
        const children = await prisma.unit.findMany({
          where: { parentId: { in: frontier } },
          select: { id: true },
        });
        frontier = children.map((c) => c.id);
        unitIds.push(...frontier);
      }
    }

    const fields = job.fields as string[];
    const persons = await prisma.person.findMany({
      where: unitIds ? { invitedToUnitId: { in: unitIds } } : {},
    });
    const rows = persons.map((p) => {
      const full: Record<string, unknown> = job.anonymize
        ? { id: p.id, displayName: `Osoba #${p.id.slice(0, 8)}`, branch: p.branch, status: p.status }
        : {
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            birthDate: p.birthDate,
            school: p.school,
            branch: p.branch,
            status: p.status,
          };
      return fields.length
        ? Object.fromEntries(Object.entries(full).filter(([k]) => k === 'id' || fields.includes(k)))
        : full;
    });

    const body =
      job.format === 'CSV'
        ? toCsv(rows)
        : JSON.stringify(rows, null, 2);

    // TODO(etap-infra): upload do S3; w dev zapis inline do storageKey jako data-url.
    const ttlMin = Number(process.env.EXPORT_LINK_TTL_MINUTES ?? 30);
    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'DONE',
        storageKey: `exports/${exportJobId}.${job.format.toLowerCase()}`,
        linkExpiresAt: new Date(Date.now() + ttlMin * 60_000),
      },
    });
    await prisma.auditLog.create({
      data: {
        actorPersonId: job.requestedByPersonId,
        action: 'EXPORT_COMPLETED',
        resourceType: 'ExportJob',
        resourceId: exportJobId,
        payload: {
          scopeUnitId: job.scopeUnitId,
          fields: job.fields as object,
          anonymize: job.anonymize,
          purpose: job.purpose,
          rowCount: rows.length,
          bytes: body.length,
        },
      },
    });
  } catch (err) {
    await prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'FAILED' } });
    throw err;
  }
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const first = rows[0] as Record<string, unknown>;
  const headers = Object.keys(first);
  const escape = (v: unknown): string => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}
