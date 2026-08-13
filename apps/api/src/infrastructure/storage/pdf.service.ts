import { existsSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

/** Wiersz sekcji dokumentu — nagłówek albo akapit. */
export interface PdfBlock {
  heading?: string;
  lines?: string[];
}

export interface PdfDocumentInput {
  title: string;
  subtitle?: string;
  /** Stopka z datą, numerem i danymi zatwierdzającego (§13.3). */
  footer?: string;
  blocks: PdfBlock[];
}

/**
 * Generowanie PDF-ów (rozkazy, plany pracy).
 *
 * Dwie rzeczy, które łatwo tu przeoczyć:
 *
 * 1. **Font.** Wbudowane fonty pdfkit (Helvetica i spółka) są kodowane
 *    WinAnsi, w którym nie ma ł, ą, ę, ś, ż, ź, ć ani ń. Bez osadzonego TTF
 *    polski tekst wychodzi z dziurami, i to bez żadnego błędu. Dlatego font
 *    jest wczytywany z `PDF_FONT_PATH` (obraz Dockera instaluje `font-dejavu`),
 *    a jego brak kończy się jawnym wyjątkiem — nie cichym psuciem dokumentów.
 * 2. **Paleta.** Dokumenty są ZAWSZE jasne, niezależnie od motywu aplikacji
 *    (§16.2). Generator nie czyta preferencji użytkownika i nie ma do nich
 *    dostępu — kolory są tu zapisane wprost i to jest celowe.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  private get fontPath(): string {
    return process.env.PDF_FONT_PATH || '/usr/share/fonts/dejavu/DejaVuSans.ttf';
  }

  private get boldFontPath(): string {
    return process.env.PDF_FONT_BOLD_PATH || '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf';
  }

  /** Czy da się wygenerować PDF w tym środowisku — dla `/admin/system-health`. */
  isAvailable(): boolean {
    return existsSync(this.fontPath);
  }

  /**
   * Renderuje dokument do bufora PDF.
   *
   * @param input - tytuł, podtytuł, bloki treści i stopka
   * @returns zawartość pliku PDF
   * @throws Error gdy brakuje pliku fontu — komunikat wskazuje zmienną do ustawienia
   */
  async render(input: PdfDocumentInput): Promise<Buffer> {
    if (!existsSync(this.fontPath)) {
      throw new Error(
        `Brak pliku fontu do generowania PDF (${this.fontPath}). ` +
          'Ustaw PDF_FONT_PATH na plik TTF z polskimi znakami albo zainstaluj pakiet font-dejavu.',
      );
    }
    const hasBold = existsSync(this.boldFontPath);

    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: input.title } });
    doc.registerFont('body', this.fontPath);
    doc.registerFont('bold', hasBold ? this.boldFontPath : this.fontPath);

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Jasna paleta na sztywno — patrz uwaga 2 w opisie klasy.
    const ink = '#0f172a';
    const muted = '#475569';

    doc.font('bold').fontSize(16).fillColor(ink).text(input.title);
    if (input.subtitle) {
      doc.moveDown(0.3).font('body').fontSize(10).fillColor(muted).text(input.subtitle);
    }
    doc.moveDown(1);

    for (const block of input.blocks) {
      if (block.heading) {
        doc.moveDown(0.5).font('bold').fontSize(11).fillColor(ink).text(block.heading);
        doc.moveDown(0.2);
      }
      for (const line of block.lines ?? []) {
        doc.font('body').fontSize(10).fillColor(ink).text(line, { align: 'left' });
      }
    }

    if (input.footer) {
      doc.moveDown(1.5).font('body').fontSize(8).fillColor(muted).text(input.footer);
    }

    doc.end();
    return done;
  }
}
