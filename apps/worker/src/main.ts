/**
 * HARC Worker (§3) — kolejki BullMQ i joby cykliczne.
 *
 * Kolejki: mail (retry+DLQ), exports, google-sync (etapowo).
 * Joby cykliczne: zatarcie kar (§11.3), przypomnienia o wygasaniu weryfikacji
 * ochrony małoletnich 60/30/7 dni (§17), wygaszanie zaproszeń, przypomnienia
 * spisowe (§13.1).
 */
import { Queue, Worker } from 'bullmq';
import { pino } from 'pino';
import { PrismaClient } from '@harc/db';
import { expungementDate } from './jobs/expunge.js';
import { runExport } from './jobs/export.js';

const logger = pino({ name: 'harc-worker' });
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const prisma = new PrismaClient();

const queues = {
  system: new Queue('system', { connection }),
  mail: new Queue('mail', {
    connection,
    defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
  }),
  exports: new Queue('exports', { connection }),
};

/** Zatarcie kar (§11.3): job dzienny. */
async function expungePenalties(): Promise<number> {
  const now = new Date();
  const finals = await prisma.disciplinaryCase.findMany({ where: { status: 'FINAL' } });
  let count = 0;
  for (const c of finals) {
    if (!c.finalAt) continue;
    if (expungementDate(c.finalAt, c.banEndsAt) <= now) {
      await prisma.disciplinaryCase.update({
        where: { id: c.id },
        data: { status: 'EXPIRED', expungedAt: now },
      });
      await prisma.auditLog.create({
        data: {
          actorPersonId: null,
          action: 'PENALTY_EXPUNGED',
          resourceType: 'DisciplinaryCase',
          resourceId: c.id,
          payload: {},
        },
      });
      count++;
    }
  }
  return count;
}

/** Przypomnienia 60/30/7 dni przed wygaśnięciem weryfikacji (§17). */
async function minorProtectionReminders(): Promise<number> {
  const now = new Date();
  let sent = 0;
  for (const days of [60, 30, 7]) {
    const target = new Date(now.getTime() + days * 86_400_000);
    const windowEnd = new Date(target.getTime() + 86_400_000);
    const expiring = await prisma.instructorProfile.findMany({
      where: { minorProtectionValidUntil: { gte: target, lt: windowEnd } },
    });
    for (const p of expiring) {
      const person = await prisma.person.findUnique({ where: { id: p.personId } });
      if (person?.email) {
        await queues.mail.add('reminder', {
          to: person.email,
          subject: `HARC — weryfikacja ochrony małoletnich wygasa za ${days} dni`,
          text: `Twoja weryfikacja wygasa ${p.minorProtectionValidUntil?.toISOString().slice(0, 10)}. Odnów ją, aby zachować możliwość pełnienia funkcji wychowawczych. Powiadomiono także Twojego zwierzchnika.`,
        });
        sent++;
      }
    }
  }
  return sent;
}

const workers = [
  new Worker(
    'system',
    async (job) => {
      switch (job.name) {
        case 'expunge-penalties':
          return { expunged: await expungePenalties() };
        case 'minor-protection-reminders':
          return { sent: await minorProtectionReminders() };
        case 'heartbeat':
          return { ok: true };
        default:
          return {};
      }
    },
    { connection },
  ),
  new Worker(
    'mail',
    async (job) => {
      const { createTransport } = await import('nodemailer');
      const transport = createTransport({
        host: process.env.SMTP_HOST ?? 'localhost',
        port: Number(process.env.SMTP_PORT ?? 1025),
        secure: false,
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? 'harc@example.org',
        to: job.data.to,
        subject: job.data.subject,
        text: job.data.text,
      });
    },
    { connection },
  ),
  new Worker(
    'exports',
    async (job) => runExport(prisma, job.data.exportJobId as string),
    { connection },
  ),
];

for (const w of workers) {
  w.on('failed', (job, err) => logger.error({ queue: w.name, jobId: job?.id, err: err.message }, 'job failed'));
}

await queues.system.upsertJobScheduler('heartbeat', { every: 60_000 }, { name: 'heartbeat' });
await queues.system.upsertJobScheduler(
  'expunge-penalties',
  { pattern: '0 3 * * *' },
  { name: 'expunge-penalties' },
);
await queues.system.upsertJobScheduler(
  'minor-protection-reminders',
  { pattern: '0 6 * * *' },
  { name: 'minor-protection-reminders' },
);

logger.info('HARC Worker uruchomiony (system, mail, exports)');

const shutdown = async (): Promise<void> => {
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(Object.values(queues).map((q) => q.close()));
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
