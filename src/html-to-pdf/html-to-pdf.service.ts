// src/html-to-pdf/html-to-pdf.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import chromium from '@sparticuz/chromium';
import type { Browser, LaunchOptions } from 'puppeteer-core'; // tipos mínimos

type Pptr = typeof import('puppeteer-core');

@Injectable()
export class HtmlToPdfService implements OnModuleDestroy {
  private browser: Browser | null = null;

  /** Carrega dinamicamente puppeteer-core (Lambda) ou puppeteer completo (desenvolvimento / EC2) */
  private async getPuppeteer(): Promise<Pptr> {
    const isLambda = !!process.env.CHROME_PATH;
    /* cast para Pptr resolve diferença de tipos */
    return (isLambda
      ? await import('puppeteer-core')
      : await import('puppeteer')) as Pptr;
  }

  /** Singleton de Browser */
  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    const puppeteer = await this.getPuppeteer();
    const isLambda = !!process.env.CHROME_PATH;

    const launchOptions: LaunchOptions = isLambda
      ? {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath:
            process.env.CHROME_PATH || (await chromium.executablePath()),
          headless: chromium.headless,
        }
      : {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          /* executablePath opcional em Windows/EC2:
             - ficaria undefined → puppeteer usa o Chrome que ele mesmo baixou
             - se você instalou Google Chrome no sistema, pode setar
               executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' */
        };

    this.browser = await puppeteer.launch(launchOptions as any);
    return this.browser;
  }

  /* ---------- duplica <header> entre page-breaks ---------- */
  repeatHeaderAfterPageBreaks(html: string): string {
    const m = html.match(/<header[^>]*>[\s\S]*?<\/header>/i);
    if (!m) return html;
    const header = m[0];
    const parts = html.replace(header, '').split(/<div class=["']page-break["']><\/div>/i);
    return parts.map(p => header + p).join('<div class="page-break"></div>');
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
