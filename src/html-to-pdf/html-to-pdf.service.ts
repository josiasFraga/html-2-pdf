import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { PDFDocument } from 'pdf-lib';
import puppeteer, { Browser, LaunchOptions, Page, PDFOptions } from 'puppeteer';

const PAGE_BREAK_REGEX = /<div class=["']page-break["']><\/div>/i;
const PAGE_BREAK_HTML = '<div class="page-break"></div>';

export interface HtmlToPdfOptions {
  headerExcludedPages?: number[];
  footerExcludedPages?: number[];
  pageNumberStartPage?: number;
}

interface PageVariant {
  hideHeader: boolean;
  hideFooter: boolean;
  hideNumbers: boolean;
  pages: number[];
}

@Injectable()
export class HtmlToPdfService implements OnModuleDestroy {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    const launchOptions: LaunchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };
    this.browser = await puppeteer.launch(launchOptions);
    return this.browser;
  }

  repeatHeaderAfterPageBreaks(html: string): string {
    const match = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/i);
    if (!match) return html;
    const header = match[0];
    const parts = html.replace(header, '').split(PAGE_BREAK_REGEX);
    return parts.map((part) => header + part).join(PAGE_BREAK_HTML);
  }

  private normalizePages(pages?: number[]): Set<number> {
    return new Set((pages ?? []).filter((page) => Number.isInteger(page) && page > 0));
  }

  private prepareTemplate(template?: string): string {
    if (template === undefined) return '<div></div>';
    if (!template) return template;
    // Shared normalization: native flex items otherwise shrink to text width.
    return `<div data-h2p-template style="display:block;width:100%;box-sizing:border-box">${template}</div>`;
  }

  private async composeConditionalPages(
    page: Page,
    originalBytes: Uint8Array,
    printOptions: PDFOptions,
    options: HtmlToPdfOptions,
  ): Promise<Buffer> {
    const original = await PDFDocument.load(originalBytes);
    const excludedHeaders = this.normalizePages(options.headerExcludedPages);
    const excludedFooters = this.normalizePages(options.footerExcludedPages);
    const start = Number.isInteger(options.pageNumberStartPage) && (options.pageNumberStartPage ?? 0) > 0
      ? options.pageNumberStartPage!
      : 1;
    const groups = new Map<string, PageVariant>();
    for (let number = 1; number <= original.getPageCount(); number++) {
      const hideHeader = excludedHeaders.has(number);
      const hideFooter = excludedFooters.has(number);
      const hideNumbers = number < start && !hideFooter;
      if (!hideHeader && !hideFooter && !hideNumbers) continue;
      const key = `${hideHeader}:${hideFooter}:${hideNumbers}`;
      const group = groups.get(key) ?? { hideHeader, hideFooter, hideNumbers, pages: [] };
      group.pages.push(number);
      groups.set(key, group);
    }
    if (!groups.size) return Buffer.from(originalBytes);

    const replacements = new Map<number, { pdf: PDFDocument; index: number }>();
    for (const group of groups.values()) {
      // Hidden semantic elements retain their exact CSS geometry and page breaks.
      const style = await page.addStyleTag({ content: [
        group.hideHeader ? 'header, header * { visibility:hidden !important; }' : '',
        group.hideFooter ? 'footer, footer * { visibility:hidden !important; }' : '',
        group.hideNumbers ? 'footer .pageNumber, footer .totalPages { visibility:hidden !important; }' : '',
      ].join('\n') });
      try {
        const hiddenNumbers = '<style>.pageNumber,.totalPages{visibility:hidden!important}</style>';
        const bytes = await page.pdf({
          ...printOptions,
          // Page selection happens after the SAME native full-document layout.
          pageRanges: group.pages.join(','),
          headerTemplate: group.hideHeader ? '<div></div>' : printOptions.headerTemplate,
          footerTemplate: group.hideFooter ? '<div></div>' :
            (group.hideNumbers ? hiddenNumbers : '') + (printOptions.footerTemplate ?? ''),
        });
        const variant = await PDFDocument.load(bytes);
        if (variant.getPageCount() !== group.pages.length) {
          throw new Error('Conditional print changed the native physical page count');
        }
        group.pages.forEach((number, index) => replacements.set(number, { pdf: variant, index }));
      } finally {
        await style.evaluate((element) => element.remove());
        await style.dispose();
      }
    }

    const result = await PDFDocument.create();
    for (let number = 1; number <= original.getPageCount(); number++) {
      const source = replacements.get(number) ?? { pdf: original, index: number - 1 };
      const [copied] = await result.copyPages(source.pdf, [source.index]);
      result.addPage(copied);
    }
    const title = original.getTitle();
    const author = original.getAuthor();
    const subject = original.getSubject();
    const creator = original.getCreator();
    if (title) result.setTitle(title);
    if (author) result.setAuthor(author);
    if (subject) result.setSubject(subject);
    if (creator) result.setCreator(creator);
    return Buffer.from(await result.save());
  }

  async htmlToPdf(
    html: string,
    headerHtml?: string,
    footerHtml?: string,
    options: HtmlToPdfOptions = {},
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // Never clone, wrap, resize or repaginate HTML based on conditional options.
      await page.setContent(this.repeatHeaderAfterPageBreaks(html), { waitUntil: 'networkidle0' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
      });
      const printOptions: PDFOptions = {
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: !!headerHtml || !!footerHtml,
        headerTemplate: this.prepareTemplate(headerHtml),
        footerTemplate: this.prepareTemplate(footerHtml),
        margin: { top: '0px', bottom: '0px', left: '10px', right: '10px' },
      };
      const original = await page.pdf(printOptions);
      const conditional = options.headerExcludedPages?.length || options.footerExcludedPages?.length || options.pageNumberStartPage;
      return conditional
        ? await this.composeConditionalPages(page, original, printOptions, options)
        : Buffer.from(original);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy() {
    await this.browser?.close();
  }
}