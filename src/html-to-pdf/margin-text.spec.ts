import { BadRequestException } from '@nestjs/common';
import { PDFDocument, PDFPage, StandardFonts } from 'pdf-lib';
import { addMarginTexts, normalizeMarginText } from './margin-text';

describe('PDF margin texts', () => {
  afterEach(() => jest.restoreAllMocks());

  async function source() {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    pdf.addPage([420, 595]);
    return Buffer.from(await pdf.save());
  }

  it('normalizes optional text to a single line without interpreting HTML', () => {
    expect(normalizeMarginText(undefined, 'leftMarginText')).toBeUndefined();
    expect(normalizeMarginText(' \n\t ', 'leftMarginText')).toBeUndefined();
    expect(normalizeMarginText(' CHASSI: 123\n PLACA: ABC1D23 ', 'leftMarginText'))
      .toBe('CHASSI: 123 PLACA: ABC1D23');
    expect(normalizeMarginText('<b>APROVADO</b>', 'rightMarginText')).toBe('<b>APROVADO</b>');
  });

  it.each([null, 123, false, [], {}])('rejects non-string value %p', (value) => {
    expect(() => normalizeMarginText(value, 'rightMarginText')).toThrow(BadRequestException);
    expect(() => normalizeMarginText(value, 'rightMarginText')).toThrow('rightMarginText');
  });

  it('returns the exact original buffer when neither side is supplied', async () => {
    const bytes = await source();
    const load = jest.spyOn(PDFDocument, 'load');
    expect(await addMarginTexts(bytes)).toBe(bytes);
    expect(load).not.toHaveBeenCalled();
  });

  it('centers 9 pt rotated text 5 mm inward from each edge on every page', async () => {
    const draw = jest.spyOn(PDFPage.prototype, 'drawText');
    const left = 'CHASSI: 9BW12345678901234 | PLACA: ABC1D23';
    const right = 'APROVADO COM OBSERVAÇÕES';
    const output = await addMarginTexts(await source(), left, right);
    const pdf = await PDFDocument.load(output);
    expect(pdf.getPageCount()).toBe(2);
    expect(draw).toHaveBeenCalledTimes(4);
    for (const [index, [text, options]] of draw.mock.calls.entries()) {
      const { width, height } = pdf.getPage(index % 2).getSize();
      const isLeft = index < 2;
      expect(text).toBe(isLeft ? left : right);
      expect(options?.rotate).toEqual({ type: 'degrees', angle: isLeft ? 90 : -90 });
      expect(options?.size).toBe(9);
      const font = options!.font!;
      const size = options!.size!;
      const length = font.widthOfTextAtSize(text, size);
      const ascent = font.heightAtSize(size, { descender: false });
      const descent = font.heightAtSize(size) - ascent;
      const x = options!.x!;
      const y = options!.y!;
      const nearEdge = isLeft ? x - ascent : width - x - ascent;
      const farEdge = isLeft ? x + descent : width - x + descent;
      expect(nearEdge).toBeGreaterThan(10);
      expect((nearEdge + farEdge) / 2).toBeCloseTo(5 * 72 / 25.4);
      expect(isLeft ? y + length / 2 : y - length / 2).toBeCloseTo(height / 2);
      expect(isLeft ? y : y - length).toBeGreaterThanOrEqual(12);
      expect(isLeft ? y + length : y).toBeLessThanOrEqual(height - 12);
    }
  });

  it.each(['left', 'right'])('supports only the %s side', async (side) => {
    const draw = jest.spyOn(PDFPage.prototype, 'drawText');
    await addMarginTexts(await source(), side === 'left' ? 'PLACA' : undefined,
      side === 'right' ? 'APROVADO' : undefined);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw.mock.calls.every(([text]) => text === (side === 'left' ? 'PLACA' : 'APROVADO'))).toBe(true);
  });

  it('shrinks long text without dropping below 4 pt', async () => {
    const draw = jest.spyOn(PDFPage.prototype, 'drawText');
    await addMarginTexts(await source(), 'W'.repeat(150));
    const sizes = draw.mock.calls.map(([, options]) => options!.size!);
    expect(sizes.every((size) => size >= 4 && size < 9)).toBe(true);
    expect(sizes[1]).toBeLessThan(sizes[0]);
  });

  it('rejects text that cannot fit, identifying its field', async () => {
    await expect(addMarginTexts(await source(), undefined, 'W'.repeat(1000)))
      .rejects.toThrow('rightMarginText é longo demais');
  });

  it('supports Portuguese accents and rejects unsupported Unicode with HTTP 400', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    expect(() => font.encodeText('APROVADO COM OBSERVAÇÕES — ação')).not.toThrow();
    await expect(addMarginTexts(await source(), 'CHASSI 🚗')).rejects.toThrow(BadRequestException);
    await expect(addMarginTexts(await source(), 'CHASSI 🚗')).rejects.toThrow('leftMarginText contém caracteres');
  });
});