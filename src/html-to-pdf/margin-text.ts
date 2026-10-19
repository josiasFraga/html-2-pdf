import { BadRequestException } from '@nestjs/common';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Overlay center, measured from the physical edge. Does not reserve HTML space.
const SIDE_TEXT_CENTER = 5 * 72 / 25.4; // 5 mm in PDF points
const END_CLEARANCE = 12;
const FONT_SIZE = 9;
const MIN_FONT_SIZE = 4;

export function normalizeMarginText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} deve ser uma string.`);
  }
  return value.replace(/\s+/gu, ' ').trim() || undefined;
}

export async function addMarginTexts(
  bytes: Buffer,
  leftMarginText?: string,
  rightMarginText?: string,
): Promise<Buffer> {
  if (!leftMarginText && !rightMarginText) return bytes;

  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const [field, text] of [
    ['leftMarginText', leftMarginText],
    ['rightMarginText', rightMarginText],
  ] as const) {
    if (!text) continue;
    let unitWidth: number;
    try {
      unitWidth = font.widthOfTextAtSize(text, 1);
    } catch {
      throw new BadRequestException(`${field} contém caracteres não suportados pela fonte Helvetica (WinAnsi).`);
    }

    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      const size = Math.min(FONT_SIZE, (height - 2 * END_CLEARANCE) / unitWidth);
      if (size < MIN_FONT_SIZE) {
        throw new BadRequestException(`${field} é longo demais para a lateral da página (fonte mínima: 4 pt).`);
      }
      const length = unitWidth * size;
      const ascent = font.heightAtSize(size, { descender: false });
      const descent = font.heightAtSize(size) - ascent;
      // Offset the baseline so the ascent/descent box is centered 5 mm inward.
      const baseline = SIDE_TEXT_CENTER + (ascent - descent) / 2;
      const left = field === 'leftMarginText';
      page.drawText(text, {
        font,
        size,
        color: rgb(0, 0, 0),
        rotate: degrees(left ? 90 : -90),
        x: left ? baseline : width - baseline,
        y: left ? (height - length) / 2 : (height + length) / 2,
      });
    }
  }
  return Buffer.from(await pdf.save());
}