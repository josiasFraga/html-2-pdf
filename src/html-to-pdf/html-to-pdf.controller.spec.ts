import { Test, TestingModule } from '@nestjs/testing';
import { HtmlToPdfController } from './html-to-pdf.controller';
import { HtmlToPdfService } from './html-to-pdf.service';

describe('HtmlToPdfController', () => {
  let controller: HtmlToPdfController;

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
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
