import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import chromium from '@sparticuz/chromium';

// 👉  use os tipos que vêm com puppeteer-core
import type { Browser } from 'puppeteer-core';

type Pptr = typeof import('puppeteer-core');

@Injectable()
export class HtmlToPdfService implements OnModuleDestroy {
  private browser: Browser | null = null;

  private async getPuppeteer(): Promise<Pptr> {
    const isLambda = !!process.env.CHROME_PATH;
    return (isLambda
      ? await import('puppeteer-core')
      : await import('puppeteer')) as Pptr;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    const puppeteer = await this.getPuppeteer();
    const isLambda = !!process.env.CHROME_PATH;

    const launchOptions = isLambda
      ? {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: process.env.CHROME_PATH || (await chromium.executablePath()),
          headless: chromium.headless,
        }
      : {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        };

    this.browser = await puppeteer.launch(launchOptions as any);
    return this.browser;
  }

  /* ---------- utilidade para repetir header visual ---------- */
  repeatHeaderAfterPageBreaks(html: string): string {
    const headerMatch = html.match(/<header[^>]*>[\s\S]*?<\/header>/i);
    if (!headerMatch) return html;

    const headerHtml = headerMatch[0];
    const htmlWithoutHeader = html.replace(headerHtml, '');
    const parts = htmlWithoutHeader.split(/<div class=["']page-break["']><\/div>/i);
    const processed = parts.map((p) => `${headerHtml}${p}`);
    return processed.join('<div class="page-break"></div>');
  }

  /* ---------- API principal ---------- */
  async htmlToPdf(
    html: string,
    headerHtml?: string,
    footerHtml?: string,
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    const finalHtml = this.repeatHeaderAfterPageBreaks(html);
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    const pdfU8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: !!headerHtml || !!footerHtml,
      headerTemplate: headerHtml ?? '<div></div>',
      footerTemplate: footerHtml ?? '<div></div>',
      margin: { top: '80px', bottom: '80px', left: '10px', right: '10px' },
    });

    await page.close();
    return Buffer.isBuffer(pdfU8) ? pdfU8 : Buffer.from(pdfU8);
  }

  async onModuleDestroy() {
    await this.browser?.close();
  }
}
