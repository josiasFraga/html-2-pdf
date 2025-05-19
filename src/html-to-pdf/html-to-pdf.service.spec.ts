import { Test, TestingModule } from '@nestjs/testing';
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
});
