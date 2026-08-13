import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Magazyn dokumentów w S3 (dev: MinIO).
 *
 * Po wycofaniu integracji z Google (decyzja 2026-08-13) S3 jest **jedynym**
 * miejscem składowania: PDF-y rozkazów, zatwierdzone plany pracy, załączniki
 * do zgłoszeń progresji i paczki eksportów.
 *
 * @remarks Dokumenty organizacji są niezmienialne (§8.6: „rozkaz jest
 * dokumentem organizacji i nie podlega edycji"). Klucze zawierają rok i UUID,
 * więc kolejna publikacja nigdy nie nadpisuje poprzedniej — sprostowanie
 * tworzy nowy obiekt, a stary zostaje.
 */
@Injectable()
export class S3StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private client: S3Client | null = null;

  /**
   * Zakłada bucket przy starcie, żeby środowisko dev wstawało jednym
   * poleceniem (§4) — MinIO startuje pusty, a bez bucketa pierwsza publikacja
   * rozkazu kończyłaby się `NoSuchBucket`.
   *
   * @remarks Niepowodzenie nie przerywa startu: brak S3 ma degradować
   * generowanie dokumentów, a nie wywracać całe API. Stan widać
   * w `/admin/system-health`.
   */
  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  private get bucket(): string {
    return process.env.S3_BUCKET || 'harc';
  }

  /**
   * Leniwie tworzony klient — dzięki temu brak konfiguracji S3 nie wywraca
   * startu aplikacji, tylko te operacje, które faktycznie sięgają po pliki.
   */
  private get s3(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
        region: process.env.S3_REGION || 'us-east-1',
        // MinIO wymaga adresowania path-style (bucket w ścieżce, nie w hoście).
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY || 'harc',
          secretAccessKey: process.env.S3_SECRET_KEY || 'harc-dev-secret',
        },
      });
    }
    return this.client;
  }

  /**
   * Zapewnia istnienie bucketa. Idempotentne.
   *
   * @remarks W devie MinIO startuje pusty, więc pierwsza publikacja rozkazu
   * padłaby na `NoSuchBucket`. W produkcji bucket zwykle istnieje i tworzony
   * jest przez administratora — wtedy `HeadBucket` przechodzi i nic się nie dzieje.
   */
  async ensureBucket(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Utworzono bucket ${this.bucket}`);
      } catch (err) {
        this.logger.warn(`Nie udało się utworzyć bucketa ${this.bucket}: ${String(err)}`);
      }
    }
  }

  /**
   * Zapisuje obiekt i zwraca jego klucz.
   *
   * @param key - klucz obiektu, np. `orders/2026/{uuid}.pdf`
   * @param body - zawartość
   * @param contentType - typ MIME zapisywany w metadanych
   * @returns klucz, pod którym obiekt jest dostępny
   * @throws Error gdy zapis się nie powiedzie
   */
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.ensureBucket();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  /**
   * Wygasający link do pobrania obiektu.
   *
   * @param key - klucz obiektu
   * @param ttlMinutes - ważność linku; domyślnie `EXPORT_LINK_TTL_MINUTES` (§18)
   * @returns podpisany URL
   */
  async signedUrl(key: string, ttlMinutes?: number): Promise<string> {
    const ttl = ttlMinutes ?? Number(process.env.EXPORT_LINK_TTL_MINUTES ?? 30);
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttl * 60,
    });
  }

  /** Pobiera obiekt do bufora (np. przy serwowaniu PDF-u przez API). */
  async get(key: string): Promise<Buffer> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  /** Czy warstwa plików odpowiada — dla `/admin/system-health` (§18). */
  async isHealthy(): Promise<boolean> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
