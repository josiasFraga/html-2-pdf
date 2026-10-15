import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFPage, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import puppeteer, { Browser, PDFOptions } from 'puppeteer';
import { HtmlToPdfOptions, HtmlToPdfService } from './html-to-pdf.service';

function operators(page: PDFPage): string {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray
    ? contents.asArray().map((ref) => page.doc.context.lookup(ref))
    : [contents];
  return streams.map((stream) => {
    if (!(stream instanceof PDFRawStream)) throw new Error('Expected a native PDF content stream');
    return Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
  }).join('\n');
}

function textRuns(page: PDFPage) {
  const fonts = page.node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const maps = new Map<string, Map<number, string>>();
  for (const [name, ref] of fonts.entries()) {
    const font = page.doc.context.lookup(ref, PDFDict);
    const cmap = font.lookup(PDFName.of('ToUnicode'));
    if (!(cmap instanceof PDFRawStream)) throw new Error('Expected Chromium Unicode font mapping');
    const source = Buffer.from(decodePDFRawStream(cmap).decode()).toString('latin1');
    const chars = new Map<number, string>();
    for (const section of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const match of section[1].matchAll(/<([\dA-F]+)>\s*<([\dA-F]+)>/gi)) {
        chars.set(parseInt(match[1], 16), String.fromCharCode(parseInt(match[2], 16)));
      }
    }
    for (const section of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const match of section[1].matchAll(/<([\dA-F]+)>\s*<([\dA-F]+)>\s*<([\dA-F]+)>/gi)) {
        const first = parseInt(match[1], 16);
        const last = parseInt(match[2], 16);
        const unicode = parseInt(match[3], 16);
        for (let code = first; code <= last; code++) chars.set(code, String.fromCharCode(unicode + code - first));
      }
    }
    maps.set(name.toString(), chars);
  }
  return Array.from(operators(page).matchAll(/BT([\s\S]*?)ET/g), (block) => {
    const font = block[1].match(/(\/F\d+) ([\d.]+) Tf/);
    const matrix = block[1].match(/1 0 0 -1 ([-\d.]+) ([-\d.]+) Tm/);
    let text = '';
    for (const encoded of block[1].matchAll(/<([\dA-F]+)>/gi)) {
      for (let offset = 0; offset < encoded[1].length; offset += 4) {
        text += maps.get(font?.[1] ?? '')?.get(parseInt(encoded[1].slice(offset, offset + 4), 16)) ?? '?';
      }
    }
    return { text, fontSize: Number(font?.[2]), x: Number(matrix?.[1]), y: Number(matrix?.[2]) };
  });
}

// Chromium prints the document body in the first top-level graphics block,
// then native templates in a separate one. Compare all drawing operators,
// not just DOM measurements: this includes scaling, paths, images and text.
function bodyDrawing(page: PDFPage): string {
  const lines = operators(page).split('\n');
  let depth = 0;
  let started = false;
  const result: string[] = [];
  for (const line of lines) {
    result.push(line);
    if (line.trim() === 'q') { depth++; started = true; }
    if (line.trim() === 'Q') depth--;
    if (started && depth === 0) break;
  }
  return result.join('\n').replace(/\/(F|G|X|Im)\d+/g, '/$1_RESOURCE');
}

describe('Native PDF rendering compatibility', () => {
  let browser: Browser;
  const header = '<div style="font-size:11px;text-align:center">HEADER</div>';
  const footer = '<div style="font-size:10px;text-align:center">FOOTER <span class="pageNumber"></span>/<span class="totalPages"></span></div>';

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }, 30000);
  afterAll(async () => { await browser?.close(); });

  async function render(html: string, options: HtmlToPdfOptions = {}, templates = { header, footer }) {
    const service = new HtmlToPdfService();
    jest.spyOn(service as unknown as { getBrowser(): Promise<Browser> }, 'getBrowser').mockResolvedValue(browser);
    const page = await browser.newPage();
    const newPage = jest.spyOn(browser, 'newPage').mockResolvedValueOnce(page);
    const print = page.pdf.bind(page);
    const prints: PDFOptions[] = [];
    const markup: string[] = [];
    jest.spyOn(page, 'pdf').mockImplementation(async (printOptions) => {
      prints.push(printOptions ?? {});
      markup.push(await page.content());
      return print(printOptions);
    });
    try {
      const bytes = await service.htmlToPdf(html, templates.header, templates.footer, options);
      return { bytes, pdf: await PDFDocument.load(bytes), prints, markup };
    } finally {
      newPage.mockRestore();
      if (!page.isClosed()) await page.close();
    }
  }

  it('keeps the legacy HTML preprocessing snapshot', () => {
    const html = readFileSync(join(__dirname, '__fixtures__', 'sample-report.html'), 'utf-8');
    expect(new HtmlToPdfService().repeatHeaderAfterPageBreaks(html)).toMatchSnapshot();
  });

  it.each(['', '<!doctype html>'])('preserves the actual plate/body drawing with doctype=%s', async (doctype) => {
    const html = doctype + readFileSync(join(__dirname, '__fixtures__', 'cautelar-layout.html'), 'utf-8');
    const legacy = await render(html);
    const conditional = await render(html, { headerExcludedPages: [1], footerExcludedPages: [1], pageNumberStartPage: 2 });
    expect(conditional.pdf.getPageCount()).toBe(legacy.pdf.getPageCount());
    expect(conditional.markup[0]).toBe(legacy.markup[0]);
    expect(conditional.prints[0]).toEqual(legacy.prints[0]);
    legacy.pdf.getPages().forEach((original, index) => {
      const actual = conditional.pdf.getPage(index);
      expect(actual.getSize()).toEqual(original.getSize());
      expect(bodyDrawing(actual)).toBe(bodyDrawing(original));
      const bodyText = (page: PDFPage) => textRuns(page).filter((run) =>
        !run.text.includes('HEADER') && !run.text.includes('FOOTER') && run.y > 50 && run.y < 1000,
      );
      expect(bodyText(actual)).toEqual(bodyText(original));
    });
    const firstText = textRuns(conditional.pdf.getPage(0)).map((run) => run.text).join('');
    expect(firstText).not.toContain('HEADER');
    expect(firstText).not.toContain('FOOTER');
  }, 30000);

  it('uses physical page counters, independent header/footer exclusions and blank pages', async () => {
    const html = '<html><head><style>@page{margin:20px}.page-break{break-before:page}</style></head><body><p>ONE</p><div class="page-break"></div><p>TWO</p><div class="page-break"></div><div class="page-break"></div></body></html>';
    const legacy = await render(html);
    const result = await render(html, { headerExcludedPages: [1], footerExcludedPages: [2], pageNumberStartPage: 3 });
    expect(result.pdf.getPageCount()).toBe(4);
    const all = result.pdf.getPages().map((page) => textRuns(page).map((run) => run.text).join(''));
    expect(all[0]).not.toContain('HEADER');
    expect(all[0]).toContain('FOOTER /');
    expect(all[1]).toContain('HEADER');
    expect(all[1]).not.toContain('FOOTER');
    expect(all[2]).toContain('FOOTER 3/4');
    expect(all[3]).toContain('FOOTER 4/4');
    result.pdf.getPages().slice(2).forEach((page, index) => {
      expect(textRuns(page)).toEqual(textRuns(legacy.pdf.getPage(index + 2)));
      const runs = textRuns(page);
      expect(runs.find((run) => run.text.includes('HEADER'))!.y).toBeLessThan(50);
      expect(runs.find((run) => run.text.includes('FOOTER'))!.y).toBeGreaterThan(1000);
    });
  }, 30000);

  it('groups nonconsecutive exclusions without resetting the native page number', async () => {
    const html = '<style>.page-break{break-before:page}</style>' + Array.from({ length: 5 }, (_, index) =>
      `${index ? '<div class="page-break"></div>' : ''}<p>BODY ${index + 1}</p>`,
    ).join('');
    const result = await render(html, { headerExcludedPages: [2, 4] });
    expect(result.prints).toHaveLength(2);
    expect(result.prints[1].pageRanges).toBe('2,4');
    result.pdf.getPages().forEach((page, index) => {
      const text = textRuns(page).map((run) => run.text).join('');
      expect(text).toContain(`BODY ${index + 1}`);
      expect(text).toContain(`FOOTER ${index + 1}/5`);
      if ([1, 3].includes(index)) expect(text).not.toContain('HEADER');
      else expect(text).toContain('HEADER');
    });
  }, 30000);

  it('keeps automatic overflow pagination and body drawing unchanged', async () => {
    const html = '<style>@page{margin:20px}body{margin:20px;padding:20px}p{margin:0;height:24px}</style>' +
      Array.from({ length: 100 }, (_, i) => `<p>ROW ${i}</p>`).join('');
    const legacy = await render(html);
    const result = await render(html, { headerExcludedPages: [1], footerExcludedPages: [1], pageNumberStartPage: 2 });
    expect(result.pdf.getPageCount()).toBeGreaterThan(1);
    expect(result.pdf.getPageCount()).toBe(legacy.pdf.getPageCount());
    result.pdf.getPages().forEach((page, index) => {
      expect(bodyDrawing(page)).toBe(bodyDrawing(legacy.pdf.getPage(index)));
    });
    const text = result.pdf.getPages().flatMap(textRuns).map((run) => run.text).join(' ');
    for (let i = 0; i < 100; i++) expect(text).toContain(`ROW ${i}`);
  }, 30000);

  it.each(['left', 'center', 'right'])('preserves inline footer alignment %s in both modes', async (alignment) => {
    const templates = { header, footer: `<div style="font-size:10px;text-align:${alignment}">FOOTER</div>` };
    const html = '<style>.page-break{break-before:page}</style><p>BODY</p><div class="page-break"></div><p>BODY TWO</p>';
    const legacy = await render(html, {}, templates);
    const result = await render(html, { headerExcludedPages: [2] }, templates);
    const footerRuns = (page: PDFPage) => textRuns(page).filter((run) => run.text.includes('FOOTER'));
    expect(footerRuns(result.pdf.getPage(1))).toEqual(footerRuns(legacy.pdf.getPage(1)));
    expect(footerRuns(result.pdf.getPage(1))[0].fontSize).toBe(10);
  }, 30000);

  it('does not reprint for empty lists, out-of-range exclusions or start page 1', async () => {
    const result = await render('<p>BODY</p>', { headerExcludedPages: [999], footerExcludedPages: [], pageNumberStartPage: 1 });
    expect(result.prints).toHaveLength(1);
    expect(textRuns(result.pdf.getPage(0)).map((run) => run.text).join('')).toContain('FOOTER 1/1');
  }, 30000);

  it('hides embedded semantic headers without reflowing their reserved space', async () => {
    const html = '<style>.page-break{break-before:page}</style><header style="height:80px">INLINE HEADER</header><p>BODY</p><div class="page-break"></div><p>BODY TWO</p>';
    const templates = { header: '', footer: '' };
    const legacy = await render(html, {}, templates);
    const result = await render(html, { headerExcludedPages: [1] }, templates);
    const runs = textRuns(result.pdf.getPage(0));
    expect(runs.map((run) => run.text).join('')).not.toContain('INLINE HEADER');
    expect(runs.find((run) => run.text === 'BODY')).toEqual(textRuns(legacy.pdf.getPage(0)).find((run) => run.text === 'BODY'));
  }, 30000);

  it('hides embedded footer descendants and keeps adjacent content and external links', async () => {
    const html = '<html><head><style>@page{margin:20px}</style></head><body><footer style="height:60px"><span style="visibility:visible">INLINE FOOTER</span></footer><p>BODY AFTER FOOTER</p><a href="https://example.com/report">REPORT LINK</a></body></html>';
    const templates = { header: '', footer: '' };
    const legacy = await render(html, {}, templates);
    const result = await render(html, { footerExcludedPages: [1] }, templates);
    const runs = textRuns(result.pdf.getPage(0));
    expect(runs.map((run) => run.text).join('')).not.toContain('INLINE FOOTER');
    expect(runs.find((run) => run.text === 'BODY AFTER FOOTER')).toEqual(
      textRuns(legacy.pdf.getPage(0)).find((run) => run.text === 'BODY AFTER FOOTER'),
    );
    expect(result.pdf.getPage(0).node.Annots()?.size()).toBe(legacy.pdf.getPage(0).node.Annots()?.size());
    expect(result.pdf.getPage(0).node.Annots()?.size()).toBeGreaterThan(0);
  }, 30000);
});