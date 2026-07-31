/**
 * HARC Worker — procesy w tle (BullMQ, §3).
 *
 * Etap 1: szkielet z kolejką "system" i jobem heartbeat, żeby infrastruktura
 * kolejek była zweryfikowana od pierwszego uruchomienia. Kolejne etapy dodadzą:
 * synchronizację Google, generowanie PDF, eksporty, e-maile, joby cykliczne
 * (zatarcie kar, wygasanie weryfikacji, przypomnienia spisowe).
 */
import { Queue, Worker } from 'bullmq';
import { pino } from 'pino';

const logger = pino({ name: 'harc-worker' });
const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };

const systemQueue = new Queue('system', { connection });

const worker = new Worker(
  'system',
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'przetwarzam job');
    return { ok: true };
  },
  { connection },
);

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, 'job zakończony błędem');
});

/** Heartbeat co 60 s — potwierdza działanie kolejek w /health etapu 2. */
await systemQueue.upsertJobScheduler('heartbeat', { every: 60_000 }, { name: 'heartbeat' });

logger.info('HARC Worker uruchomiony (kolejka: system)');

const shutdown = async (): Promise<void> => {
  await worker.close();
  await systemQueue.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
