import { Test, TestingModule } from '@nestjs/testing';
import { HtmlToPdfController } from './html-to-pdf.controller';

describe('HtmlToPdfController', () => {
  let controller: HtmlToPdfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HtmlToPdfController],
    }).compile();

    controller = module.get<HtmlToPdfController>(HtmlToPdfController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
