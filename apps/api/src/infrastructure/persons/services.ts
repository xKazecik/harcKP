import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuditLogPort, MailerPort, TokenService } from '../../application/persons/ports.js';

/**
 * Tokeny zaproszeń (§8.2): 32 bajty losowe (base64url), w bazie wyłącznie
 * SHA-256.
 */
@Injectable()
export class CryptoTokenService implements TokenService {
  generate(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

/**
 * Mailer SMTP (dev: MailHog). Wysyłka przejdzie przez kolejkę BullMQ z retry
 * i DLQ w etapie 9 — port pozostanie ten sam.
 */
@Injectable()
export class SmtpMailer implements MailerPort {
  async send(to: string, subject: string, textBody: string): Promise<void> {
    const { createTransport } = await import('nodemailer');
    const transport = createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? 'harc@example.org',
      to,
      subject,
      text: textBody,
    });
  }
}

/** Audit log (§17/§18) — wyłącznie INSERT; brak UPDATE/DELETE w całym kodzie. */
@Injectable()
export class PrismaAuditLog implements AuditLogPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: Parameters<AuditLogPort['record']>[0]): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorPersonId: entry.actorPersonId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        payload: entry.payload as object,
      },
    });
  }
}
