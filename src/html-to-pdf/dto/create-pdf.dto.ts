import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePdfDto {
  @IsString()
  html: string;              // html bruto ou <html> completo
  @IsOptional()
  @IsString()
  footerHtml?: string;       // opcional
  @IsOptional()
  @IsString()
  headerHtml?: string;       // opcional

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  headerExcludedPages?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  footerExcludedPages?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNumberStartPage?: number;
}