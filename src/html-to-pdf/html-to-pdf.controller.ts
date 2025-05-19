// src/html-to-pdf/pdf.controller.ts
import {
  Controller, Post, Body, Res, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { HtmlToPdfService } from './html-to-pdf.service';
import { StreamableFile } from '@nestjs/common';

@Controller('html-to-pdf')
export class HtmlToPdfController {
  constructor(private readonly pdfService: HtmlToPdfService) {}

  @Post()
  async create(
    @Body() { html, footerHtml, headerHtml }: CreatePdfDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.pdfService.htmlToPdf(html, headerHtml, footerHtml);

    // Cabeçalhos p/ download; remova se quiser inline
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="documento.pdf"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }
}
