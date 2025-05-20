import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import type { Browser, LaunchOptions } from 'puppeteer-core';

type Pptr = typeof import('puppeteer-core');

@Injectable()
export class HtmlToPdfService implements OnModuleDestroy {
  private browser: Browser | null = null;

  private async getPuppeteer(isArmLinux): Promise<Pptr> {
    
    return (isArmLinux
      ? await import('puppeteer-core')
      : await import('puppeteer')) as Pptr;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    const isArmLinux = process.platform === 'linux' && process.arch === 'arm64';
    const isWindows = process.platform === 'win32';

    const puppeteer = await this.getPuppeteer(isArmLinux);

    let launchOptions: LaunchOptions;

    if (isArmLinux) {
      const chromium = (await import('@sparticuz/chromium')).default;

      launchOptions = {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      };
    } else if (isWindows) {
      launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        // Se tiver o Chrome instalado no Windows, pode especificar o caminho:
        // executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      };
    } else {
      // fallback geral (ex: Mac ou Linux x86)
      launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
    }

    this.browser = await puppeteer.launch(launchOptions as any);
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
      margin: { top: '80px', bottom: '80px', left: '10px', right: '10px' },
    });

    await page.close();
    return Buffer.isBuffer(pdfU8) ? pdfU8 : Buffer.from(pdfU8);
  }

  async onModuleDestroy() {
    await this.browser?.close();
  }
}
