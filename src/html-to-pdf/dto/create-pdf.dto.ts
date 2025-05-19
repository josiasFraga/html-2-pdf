import { IsString } from 'class-validator';

export class CreatePdfDto {
  @IsString()
  html: string;              // html bruto ou <html> completo
  footerHtml?: string;       // opcional
  headerHtml?: string;       // opcional
}