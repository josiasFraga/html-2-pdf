import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { HtmlToPdfService } from './html-to-pdf.service';

describe('HtmlToPdfService', () => {
  let service: HtmlToPdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HtmlToPdfService],
    }).compile();

    service = module.get<HtmlToPdfService>(HtmlToPdfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('limits active renders until completion, independently of HTTP disconnects', async () => {
    let finish!: (buffer: Buffer) => void;
    const blocked = new Promise<Buffer>((resolve) => { finish = resolve; });
    const render = jest.spyOn(service as unknown as {
      renderPdf(): Promise<Buffer>;
    }, 'renderPdf').mockReturnValue(blocked);
    const pending = Array.from({ length: 2 }, () => service.htmlToPdf('body'));
    try {
      await expect(service.htmlToPdf('third')).rejects.toThrow('ocupado');
      finish(Buffer.from('%PDF-1.7\n'));
      await Promise.all(pending);
      await expect(service.htmlToPdf('fourth')).resolves.toBeInstanceOf(Buffer);
    } finally {
      finish(Buffer.from('%PDF-1.7\n'));
      await Promise.all(pending);
      render.mockRestore();
    }
  });

  it.each([
    { format: 'A5' },
    { orientation: 'horizontal' },
    { format: 'custom', width: '0mm', height: '250mm' },
    { format: 'custom', width: '180mm' },
    { width: '180mm', height: '250mm' },
  ])('rejects invalid page settings before launching Chromium: %j', async (options) => {
    const launch = jest.spyOn(puppeteer, 'launch');
    try {
      await expect(service.htmlToPdf(
        '<p>BODY</p>', undefined, undefined, Object.assign(new CreatePdfDto(), options),
      )).rejects.toBeInstanceOf(BadRequestException);
      expect(launch).not.toHaveBeenCalled();
    } finally {
      launch.mockRestore();
    }
  });

  it('rejects invalid margin parameters before launching Chromium', async () => {
    const getBrowser = jest.spyOn(service as unknown as {
      getBrowser(): Promise<unknown>;
    }, 'getBrowser');
    await expect(service.htmlToPdf('<p>BODY</p>', undefined, undefined, {
      leftMarginText: 123 as unknown as string,
    })).rejects.toThrow('leftMarginText deve ser uma string');
    expect(getBrowser).not.toHaveBeenCalled();
  });

  it('repeats html header after page breaks in legacy mode', () => {
    const html =
      '<header><div>Header</div></header><main>A</main><div class="page-break"></div><main>B</main>';

    const result = service.repeatHeaderAfterPageBreaks(html);

    expect(result).toContain('<header><div>Header</div></header><main>A</main>');
    expect(result).toContain('<div class="page-break"></div><header><div>Header</div></header><main>B</main>');
  });

  it('does not alter CSS, flexbox, document mode or section headers', () => {
    const html = '<html><head><style>@page{margin:20px}.row{display:flex}</style></head><body style="margin:20px;padding:20px"><section id="header"><h1>Report</h1></section><div class="row">Content</div></body></html>';
    expect(service.repeatHeaderAfterPageBreaks(html)).toBe(html);
  });
});
