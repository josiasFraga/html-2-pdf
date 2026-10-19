import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
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
