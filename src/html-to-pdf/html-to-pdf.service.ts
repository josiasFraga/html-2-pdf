import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import puppeteer, { Browser, LaunchOptions } from 'puppeteer';

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
    const m = html.match(/<header[^>]*>[\s\S]*?<\/header>/i);
    if (!m) return html;
    const header = m[0];
    const parts = html.replace(header, '').split(/<div class=["']page-break["']><\/div>/i);
    return parts.map(p => header + p).join('<div class="page-break"></div>');
  }

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
      margin: { top: '40px', bottom: '40px', left: '10px', right: '10px' },
    });

    await page.close();
    return Buffer.isBuffer(pdfU8) ? pdfU8 : Buffer.from(pdfU8);
  }

  async onModuleDestroy() {
    await this.browser?.close();
  }
}
