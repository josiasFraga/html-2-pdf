import { Module } from '@nestjs/common';
import { HtmlToPdfService } from './html-to-pdf.service';
import { HtmlToPdfController } from './html-to-pdf.controller';

@Module({
  providers: [HtmlToPdfService],
  controllers: [HtmlToPdfController]
})
export class HtmlToPdfModule {}
