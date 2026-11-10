import { IsArray, IsIn, IsInt, IsOptional, IsString, IsNumber, Max, Min, ValidateIf } from 'class-validator';
import type { PageOptions } from '../page-options';

export class CreatePdfDto implements PageOptions {
  @IsString()
  html: string;              // html bruto ou <html> completo
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  @Min(0)
  @Max(50)
  marginMm?: number;
  @IsOptional()
  @IsString()
  footerHtml?: string;       // opcional
  @IsOptional()
  @IsString()
  headerHtml?: string;       // opcional

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsIn(['A3', 'A4', 'custom'])
  format?: PageOptions['format'];

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsIn(['portrait', 'landscape'])
  orientation?: PageOptions['orientation'];

  @ValidateIf((object: CreatePdfDto, value: unknown) => object.format === 'custom' || value !== undefined)
  @IsString()
  width?: string;

  @ValidateIf((object: CreatePdfDto, value: unknown) => object.format === 'custom' || value !== undefined)
  @IsString()
  height?: string;

  @IsOptional()
  @IsString()
  leftMarginText?: string;

  @IsOptional()
  @IsString()
  rightMarginText?: string;

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