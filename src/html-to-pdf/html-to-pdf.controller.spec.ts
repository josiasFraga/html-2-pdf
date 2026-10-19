import { Test, TestingModule } from '@nestjs/testing';
import { HtmlToPdfController } from './html-to-pdf.controller';
import { HtmlToPdfService } from './html-to-pdf.service';
import { Response } from 'express';

describe('HtmlToPdfController', () => {
  let controller: HtmlToPdfController;
  let service: HtmlToPdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HtmlToPdfController],
      providers: [
        {
          provide: HtmlToPdfService,
          useValue: {
            htmlToPdf: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HtmlToPdfController>(HtmlToPdfController);
    service = module.get<HtmlToPdfService>(HtmlToPdfService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards both margin texts and preserves the PDF download response', async () => {
    const buffer = Buffer.from('pdf');
    jest.mocked(service.htmlToPdf).mockResolvedValue(buffer);
    const set = jest.fn();
    const result = await controller.create({
      html: '<p>Laudo</p>',
      leftMarginText: 'CHASSI: 123 | PLACA: ABC1D23',
      rightMarginText: 'APROVADO',
      headerExcludedPages: [1],
      pageNumberStartPage: 2,
    }, { set } as unknown as Response);
    expect(service.htmlToPdf).toHaveBeenCalledWith('<p>Laudo</p>', undefined, undefined, {
      headerExcludedPages: [1],
      footerExcludedPages: undefined,
      pageNumberStartPage: 2,
      leftMarginText: 'CHASSI: 123 | PLACA: ABC1D23',
      rightMarginText: 'APROVADO',
    });
    expect(result.getStream()).toBeDefined();
    expect(set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="documento.pdf"',
      'Content-Length': buffer.length,
    });
  });
});
